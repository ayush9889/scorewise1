import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { storageService } from './storage';
import { rigidGroupManager } from './rigidGroupManager';
import { User, Group } from '../types/auth';
import { Player, Match } from '../types/cricket';

interface RealTimeUpdate {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'USER' | 'GROUP' | 'PLAYER' | 'MATCH';
  data: any;
  deviceId: string;
  timestamp: number;
  userId: string;
}

interface SyncListener {
  id: string;
  unsubscribe: () => void;
  entity: string;
  callback: (data: any) => void;
}

interface ConflictResolution {
  strategy: 'TIMESTAMP' | 'USER_INTENT' | 'MERGE' | 'MANUAL';
  resolver?: (local: any, remote: any) => any;
}

class RealTimeSyncService {
  private static readonly DEVICE_ID_KEY = 'device_id';
  private static readonly LAST_SYNC_KEY = 'last_real_time_sync';
  
  private listeners: Map<string, SyncListener> = new Map();
  private isEnabled = true;
  private deviceId: string;
  private currentUserId: string | null = null;
  private currentGroupId: string | null = null;
  private conflictQueue: RealTimeUpdate[] = [];
  private updateQueue: RealTimeUpdate[] = [];
  private isProcessingUpdates = false;
  
  // Event listeners for real-time updates
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
  
  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.init();
  }

  private async init(): Promise<void> {
    console.log('🔄 Initializing Real-Time Sync Service...');
    
    // Monitor auth state for user changes
    auth.onAuthStateChanged((user) => {
      if (user && user.uid !== this.currentUserId) {
        this.currentUserId = user.uid;
        this.startUserDataListeners();
      } else if (!user) {
        this.currentUserId = null;
        this.stopAllListeners();
      }
    });

    // Start with current user if already authenticated
    if (auth.currentUser) {
      this.currentUserId = auth.currentUser.uid;
      this.startUserDataListeners();
    }

    console.log('✅ Real-Time Sync Service initialized');
  }

  // PUBLIC API

  /**
   * Enable real-time synchronization
   */
  enableRealTimeSync(): void {
    console.log('🔄 Enabling real-time sync');
    this.isEnabled = true;
    if (this.currentUserId) {
      this.startUserDataListeners();
    }
  }

  /**
   * Disable real-time synchronization
   */
  disableRealTimeSync(): void {
    console.log('🔄 Disabling real-time sync');
    this.isEnabled = false;
    this.stopAllListeners();
  }

  /**
   * Set current group for real-time sync
   */
  setCurrentGroup(groupId: string): void {
    if (groupId !== this.currentGroupId) {
      this.currentGroupId = groupId;
      this.restartGroupListeners();
    }
  }

  /**
   * Subscribe to real-time updates for specific entity types
   */
  onRealTimeUpdate(
    entity: string, 
    callback: (type: string, data: any) => void
  ): () => void {
    const listeners = this.eventListeners.get(entity) || [];
    listeners.push(callback);
    this.eventListeners.set(entity, listeners);
    
    // Return unsubscribe function
    return () => {
      const currentListeners = this.eventListeners.get(entity) || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
        this.eventListeners.set(entity, currentListeners);
      }
    };
  }

  /**
   * Push an update to all other devices instantly with retry logic
   */
  async pushInstantUpdate(
    type: RealTimeUpdate['type'],
    entity: RealTimeUpdate['entity'],
    data: any,
    retryCount: number = 0
  ): Promise<void> {
    if (!this.isEnabled || !this.currentUserId) {
      console.log('📡 Real-time sync not enabled, queuing update for later');
      this.queueFailedUpdate(type, entity, data);
      return;
    }

    const update: RealTimeUpdate = {
      type,
      entity,
      data: {
        ...data,
        lastModified: Date.now(),
        modifiedBy: this.currentUserId,
        modifiedDevice: this.deviceId
      },
      deviceId: this.deviceId,
      timestamp: Date.now(),
      userId: this.currentUserId
    };

    try {
      // Save to Firestore immediately for other devices to pick up
      const updatesRef = collection(db, 'realtime_updates');
      const batch = writeBatch(db);
      
      const updateDoc = doc(updatesRef);
      batch.set(updateDoc, {
        ...update,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire after 24 hours
        retryCount
      });

      await batch.commit();
      console.log(`📡 Pushed instant update: ${entity} ${type} (attempt ${retryCount + 1})`);
      
      // Process any queued failed updates
      this.processFailedUpdates();

    } catch (error) {
      console.error('❌ Failed to push instant update:', error);
      
      // Retry with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`📡 Retrying instant update in ${delay}ms...`);
        
        setTimeout(() => {
          this.pushInstantUpdate(type, entity, data, retryCount + 1);
        }, delay);
      } else {
        console.error('📡 Giving up on instant update after 3 retries, queuing for fallback');
        this.queueFailedUpdate(type, entity, data);
      }
    }
  }

  // Queue for failed updates to retry later
  private failedUpdates: Array<{
    type: RealTimeUpdate['type'];
    entity: RealTimeUpdate['entity'];
    data: any;
    timestamp: number;
  }> = [];

  private queueFailedUpdate(
    type: RealTimeUpdate['type'],
    entity: RealTimeUpdate['entity'],
    data: any
  ): void {
    this.failedUpdates.push({
      type,
      entity,
      data,
      timestamp: Date.now()
    });
    
    // Keep only last 20 failed updates to prevent memory issues
    if (this.failedUpdates.length > 20) {
      this.failedUpdates = this.failedUpdates.slice(-20);
    }
    
    console.log(`📡 Queued failed update: ${type} ${entity} (${this.failedUpdates.length} total)`);
  }

  private processFailedUpdates(): void {
    if (this.failedUpdates.length === 0) return;
    
    console.log(`📡 Processing ${this.failedUpdates.length} failed updates...`);
    
    const updates = [...this.failedUpdates];
    this.failedUpdates = [];
    
    updates.forEach((update, index) => {
      // Small delay between updates to prevent overwhelming
      setTimeout(() => {
        this.pushInstantUpdate(update.type, update.entity, update.data);
      }, index * 200);
    });
  }

  // REAL-TIME LISTENERS

  private startUserDataListeners(): void {
    if (!this.isEnabled || !this.currentUserId) return;

    console.log('🔄 Starting real-time listeners for user:', this.currentUserId);

    // Listen to user profile changes
    this.startUserProfileListener();
    
    // Listen to user groups changes
    this.startUserGroupsListener();
    
    // Listen to real-time updates feed
    this.startRealTimeUpdatesListener();
    
    // Start group-specific listeners if group is selected
    if (this.currentGroupId) {
      this.startGroupDataListeners();
    }
  }

  private startUserProfileListener(): void {
    if (!this.currentUserId) return;

    const userRef = doc(db, 'user_profiles', this.currentUserId);
    
    const unsubscribe = onSnapshot(userRef, 
      (doc: DocumentSnapshot) => {
        if (doc.exists()) {
          const userData = doc.data() as User;
          this.handleUserProfileUpdate(userData);
        }
      },
      (error) => {
        console.error('❌ User profile listener error:', error);
      }
    );

    this.addListener('user_profile', unsubscribe, 'USER', this.handleUserProfileUpdate.bind(this));
  }

  private startUserGroupsListener(): void {
    if (!this.currentUserId) return;

    const groupsRef = collection(db, 'groups');
    const q = query(
      groupsRef,
      where('ownerId', '==', this.currentUserId)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot: QuerySnapshot) => {
        const groups: Group[] = [];
        snapshot.forEach((doc) => {
          groups.push({ id: doc.id, ...doc.data() } as Group);
        });
        this.handleUserGroupsUpdate(groups);
      },
      (error) => {
        console.error('❌ User groups listener error:', error);
      }
    );

    this.addListener('user_groups', unsubscribe, 'GROUP', this.handleUserGroupsUpdate.bind(this));
  }

  private startRealTimeUpdatesListener(): void {
    if (!this.currentUserId) return;

    const updatesRef = collection(db, 'realtime_updates');
    const q = query(
      updatesRef,
      where('userId', '==', this.currentUserId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot: QuerySnapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const updateData = change.doc.data() as RealTimeUpdate;
            
            // Ignore updates from this device to avoid loops
            if (updateData.deviceId !== this.deviceId) {
              this.processRealTimeUpdate(updateData);
            }
          }
        });
      },
      (error) => {
        console.error('❌ Real-time updates listener error:', error);
      }
    );

    this.addListener('realtime_updates', unsubscribe, 'UPDATE', this.processRealTimeUpdate.bind(this));
  }

  private startGroupDataListeners(): void {
    if (!this.currentGroupId) return;

    console.log('🔄 Starting group data listeners for:', this.currentGroupId);

    // Listen to group players
    this.startGroupPlayersListener();
    
    // Listen to group matches
    this.startGroupMatchesListener();
  }

  private startGroupPlayersListener(): void {
    if (!this.currentGroupId) return;

    const playersRef = collection(db, 'players');
    const q = query(
      playersRef,
      where('groupIds', 'array-contains', this.currentGroupId)
    );

    const unsubscribe = onSnapshot(q,
      (snapshot: QuerySnapshot) => {
        const players: Player[] = [];
        snapshot.forEach((doc) => {
          players.push({ id: doc.id, ...doc.data() } as Player);
        });
        this.handleGroupPlayersUpdate(players);
      },
      (error) => {
        console.error('❌ Group players listener error:', error);
      }
    );

    this.addListener('group_players', unsubscribe, 'PLAYER', this.handleGroupPlayersUpdate.bind(this));
  }

  private startGroupMatchesListener(): void {
    if (!this.currentGroupId) return;

    try {
      const matchesRef = collection(db, 'matches');
      const q = query(
        matchesRef,
        where('groupId', '==', this.currentGroupId),
        orderBy('startTime', 'desc')
      );

      const unsubscribe = onSnapshot(q,
        (snapshot: QuerySnapshot) => {
          const matches: Match[] = [];
          snapshot.forEach((doc) => {
            matches.push({ id: doc.id, ...doc.data() } as Match);
          });
          this.handleGroupMatchesUpdate(matches);
        },
        (error) => {
          console.error('❌ Group matches listener error:', error);
          console.warn('🔧 Firebase index required. Create composite index for "matches" collection with fields: groupId (asc), startTime (desc)');
          console.warn('🔗 Create index here: https://console.firebase.google.com/v1/r/project/scorewise-e5b59/firestore/indexes');
          
          // Fallback: Use simple query without orderBy to avoid index requirement
          console.log('📋 Using fallback query without sorting...');
          this.startGroupMatchesListenerFallback();
        }
      );

      this.addListener('group_matches', unsubscribe, 'MATCH', this.handleGroupMatchesUpdate.bind(this));
    } catch (error) {
      console.error('❌ Failed to start group matches listener:', error);
      this.startGroupMatchesListenerFallback();
    }
  }

  private startGroupMatchesListenerFallback(): void {
    if (!this.currentGroupId) return;

    console.log('📋 Starting fallback group matches listener (no sorting)...');
    
    try {
      const matchesRef = collection(db, 'matches');
      // Simplified query - only filter by groupId, no orderBy
      const q = query(
        matchesRef,
        where('groupId', '==', this.currentGroupId)
      );

      const unsubscribe = onSnapshot(q,
        (snapshot: QuerySnapshot) => {
          const matches: Match[] = [];
          snapshot.forEach((doc) => {
            matches.push({ id: doc.id, ...doc.data() } as Match);
          });
          
          // Sort locally to maintain desired order
          matches.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
          
          this.handleGroupMatchesUpdate(matches);
        },
        (error) => {
          console.error('❌ Fallback group matches listener error:', error);
        }
      );

      this.addListener('group_matches_fallback', unsubscribe, 'MATCH', this.handleGroupMatchesUpdate.bind(this));
      console.log('✅ Fallback group matches listener started successfully');
    } catch (error) {
      console.error('❌ Failed to start fallback group matches listener:', error);
    }
  }

  // UPDATE HANDLERS

  private async handleUserProfileUpdate(userData: User): Promise<void> {
    try {
      // Update local storage with conflict resolution
      const localUser = await storageService.getUser(userData.id);
      const resolvedUser = this.resolveConflict(localUser, userData, 'USER');
      
      await storageService.saveUser(resolvedUser);
      this.notifyListeners('USER', 'UPDATE', resolvedUser);
      
      console.log('✅ User profile updated from real-time sync');
    } catch (error) {
      console.error('❌ Failed to handle user profile update:', error);
    }
  }

  private async handleUserGroupsUpdate(groups: Group[]): Promise<void> {
    try {
      // Update local storage for each group
      for (const group of groups) {
        if (!rigidGroupManager.isGroupDeleted(group.id)) {
          const localGroup = await storageService.getGroup(group.id);
          const resolvedGroup = this.resolveConflict(localGroup, group, 'GROUP');
          
          await storageService.saveGroup(resolvedGroup);
          rigidGroupManager.setGroupVisibility(group.id, true);
        }
      }
      
      this.notifyListeners('GROUP', 'UPDATE', groups);
      console.log(`✅ ${groups.length} groups updated from real-time sync`);
    } catch (error) {
      console.error('❌ Failed to handle user groups update:', error);
    }
  }

  private async handleGroupPlayersUpdate(players: Player[]): Promise<void> {
    try {
      // Update local storage for each player
      for (const player of players) {
        const localPlayer = await storageService.getPlayer(player.id);
        const resolvedPlayer = this.resolveConflict(localPlayer, player, 'PLAYER');
        
        await storageService.savePlayer(resolvedPlayer);
      }
      
      this.notifyListeners('PLAYER', 'UPDATE', players);
      console.log(`✅ ${players.length} players updated from real-time sync`);
    } catch (error) {
      console.error('❌ Failed to handle group players update:', error);
    }
  }

  private async handleGroupMatchesUpdate(matches: Match[]): Promise<void> {
    try {
      // Update local storage for each match
      for (const match of matches) {
        const localMatch = await storageService.getMatch(match.id);
        const resolvedMatch = this.resolveConflict(localMatch, match, 'MATCH');
        
        await storageService.saveMatch(resolvedMatch);
      }
      
      this.notifyListeners('MATCH', 'UPDATE', matches);
      console.log(`✅ ${matches.length} matches updated from real-time sync`);
    } catch (error) {
      console.error('❌ Failed to handle group matches update:', error);
    }
  }

  private async processRealTimeUpdate(update: RealTimeUpdate): Promise<void> {
    console.log(`📡 Processing real-time update: ${update.entity} ${update.type}`);
    
    try {
      switch (update.entity) {
        case 'USER':
          await this.handleUserProfileUpdate(update.data);
          break;
        case 'GROUP':
          await this.handleUserGroupsUpdate([update.data]);
          break;
        case 'PLAYER':
          await this.handleGroupPlayersUpdate([update.data]);
          break;
        case 'MATCH':
          await this.handleGroupMatchesUpdate([update.data]);
          break;
      }
      
      // Notify UI components of the update
      this.notifyListeners(update.entity, update.type, update.data);
      
    } catch (error) {
      console.error('❌ Failed to process real-time update:', error);
      
      // Queue for retry
      this.updateQueue.push(update);
      this.processUpdateQueue();
    }
  }

  // CONFLICT RESOLUTION

  private resolveConflict(local: any, remote: any, entity: string): any {
    if (!local) return remote;
    if (!remote) return local;

    // Timestamp-based resolution with user intent preservation
    const localTimestamp = local.lastModified || local.updatedAt || 0;
    const remoteTimestamp = remote.lastModified || remote.updatedAt || 0;

    // If timestamps are very close (within 5 seconds), prefer local for better UX
    if (Math.abs(localTimestamp - remoteTimestamp) < 5000) {
      console.log(`🔄 Preferring local ${entity} due to close timestamps`);
      return { ...remote, ...local, lastModified: Date.now() };
    }

    // Otherwise, use most recent
    if (remoteTimestamp > localTimestamp) {
      console.log(`🔄 Using remote ${entity} (newer timestamp)`);
      return remote;
    } else {
      console.log(`🔄 Using local ${entity} (newer timestamp)`);
      return { ...local, lastModified: Date.now() };
    }
  }

  // UTILITY METHODS

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem(RealTimeSyncService.DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(RealTimeSyncService.DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  }

  private addListener(
    id: string, 
    unsubscribe: () => void, 
    entity: string, 
    callback: (data: any) => void
  ): void {
    // Remove existing listener if any
    const existing = this.listeners.get(id);
    if (existing) {
      existing.unsubscribe();
    }

    this.listeners.set(id, {
      id,
      unsubscribe,
      entity,
      callback
    });
  }

  private stopAllListeners(): void {
    console.log('🔄 Stopping all real-time listeners');
    
    this.listeners.forEach((listener) => {
      try {
        listener.unsubscribe();
      } catch (error) {
        console.warn('Warning: Failed to unsubscribe listener:', error);
      }
    });
    
    this.listeners.clear();
  }

  private restartGroupListeners(): void {
    // Stop group-specific listeners
    ['group_players', 'group_matches'].forEach(key => {
      const listener = this.listeners.get(key);
      if (listener) {
        listener.unsubscribe();
        this.listeners.delete(key);
      }
    });

    // Start new group listeners
    if (this.currentGroupId) {
      this.startGroupDataListeners();
    }
  }

  private notifyListeners(entity: string, type: string, data: any): void {
    const listeners = this.eventListeners.get(entity) || [];
    listeners.forEach(callback => {
      try {
        callback(type, data);
      } catch (error) {
        console.error('❌ Real-time listener callback error:', error);
      }
    });

    // Also notify generic listeners
    const allListeners = this.eventListeners.get('ALL') || [];
    allListeners.forEach(callback => {
      try {
        callback({ entity, type, data });
      } catch (error) {
        console.error('❌ Real-time ALL listener callback error:', error);
      }
    });
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingUpdates || this.updateQueue.length === 0) return;

    this.isProcessingUpdates = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift();
        if (update) {
          await this.processRealTimeUpdate(update);
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isProcessingUpdates = false;
    }
  }

  // PUBLIC STATUS METHODS

  getActiveListenersCount(): number {
    return this.listeners.size;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  isRealTimeSyncEnabled(): boolean {
    return this.isEnabled;
  }

  getConnectionStatus(): {
    enabled: boolean;
    listening: boolean;
    listenersCount: number;
    currentUser: string | null;
    currentGroup: string | null;
  } {
    return {
      enabled: this.isEnabled,
      listening: this.listeners.size > 0,
      listenersCount: this.listeners.size,
      currentUser: this.currentUserId,
      currentGroup: this.currentGroupId
    };
  }
}

export const realTimeSyncService = new RealTimeSyncService(); 