import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { User, Group, Match, Player } from '../types/cricket';
import { storageService } from './storage';

const USERS_COLLECTION = 'users';
const USER_GROUPS_COLLECTION = 'user_groups';
const USER_MATCHES_COLLECTION = 'user_matches';
const USER_PLAYERS_COLLECTION = 'user_players';
const SYNC_METADATA_COLLECTION = 'sync_metadata';

class UserCloudSyncService {
  private currentUser: User | null = null;
  private syncSubscriptions: (() => void)[] = [];

  // Initialize sync for a specific user
  async initializeUserSync(user: User): Promise<void> {
    this.currentUser = user;
    const userIdentifier = user.email || user.phone;
    console.log('🔄 Initializing cloud sync for user:', userIdentifier);
    
    if (!userIdentifier) {
      console.warn('⚠️ Cannot sync user without email or phone');
      return;
    }

    try {
      // Save user profile to cloud
      await this.saveUserToCloud(user);
      
      // Start real-time sync subscriptions
      await this.startRealtimeSync();
      
      // Perform initial sync
      await this.performFullSync();
      
      console.log('✅ User cloud sync initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize user sync:', error);
      throw error;
    }
  }

  // Save user profile to cloud
  private async saveUserToCloud(user: User): Promise<void> {
    const userIdentifier = user.email || user.phone;
    if (!userIdentifier) return;
    
    const userRef = doc(db, USERS_COLLECTION, userIdentifier);
    await setDoc(userRef, {
      ...user,
      lastUpdated: serverTimestamp(),
      syncVersion: Date.now()
    }, { merge: true });
    
    console.log('✅ User profile saved to cloud:', userIdentifier);
  }

  // Sync all user data to cloud (groups, matches, players)
  async syncUserDataToCloud(force: boolean = false): Promise<void> {
    const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) {
      console.warn('⚠️ No user email or phone for cloud sync');
      return;
    }

    try {
      console.log('🔄 Syncing user data to cloud...');
      
      // Get local data
      const [localGroups, localMatches, localPlayers] = await Promise.all([
        storageService.getAllGroups(),
        storageService.getAllMatches(),
        storageService.getAllPlayers()
      ]);

      // Filter data relevant to current user
      const userGroups = localGroups.filter(group => 
        group.members.some(member => member.userId === this.currentUser?.id)
      );
      
      const userMatches = localMatches.filter(match => {
        const allPlayers = [
          ...match.team1.players,
          ...match.team2.players,
          ...(match.battingTeam?.players || []),
          ...(match.bowlingTeam?.players || [])
        ];
        return allPlayers.some(player => 
          player.isGroupMember && 
          userGroups.some(group => player.groupIds?.includes(group.id))
        );
      });
      
      const userPlayers = localPlayers.filter(player =>
        player.isGroupMember && 
        userGroups.some(group => player.groupIds?.includes(group.id))
      );

      // Use batch writes for efficiency
      const batch = writeBatch(db);
      const userIdentifier = this.currentUser.email || this.currentUser.phone;
      const timestamp = serverTimestamp();

      // Sync groups
      for (const group of userGroups) {
        const groupRef = doc(db, USER_GROUPS_COLLECTION, `${userIdentifier}_${group.id}`);
        batch.set(groupRef, {
          userIdentifier,
          groupData: group,
          lastUpdated: timestamp,
          syncVersion: Date.now()
        }, { merge: true });
      }

      // Sync matches
      for (const match of userMatches) {
        const matchRef = doc(db, USER_MATCHES_COLLECTION, `${userIdentifier}_${match.id}`);
        batch.set(matchRef, {
          userIdentifier,
          matchData: match,
          lastUpdated: timestamp,
          syncVersion: Date.now()
        }, { merge: true });
      }

      // Sync players
      for (const player of userPlayers) {
        const playerRef = doc(db, USER_PLAYERS_COLLECTION, `${userIdentifier}_${player.id}`);
        batch.set(playerRef, {
          userIdentifier,
          playerData: player,
          lastUpdated: timestamp,
          syncVersion: Date.now()
        }, { merge: true });
      }

      // Update sync metadata
      const metadataRef = doc(db, SYNC_METADATA_COLLECTION, userIdentifier);
      batch.set(metadataRef, {
        userIdentifier,
        lastSyncTime: timestamp,
        deviceInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        },
        dataCount: {
          groups: userGroups.length,
          matches: userMatches.length,
          players: userPlayers.length
        }
      });

      // Commit all changes
      await batch.commit();
      
      console.log('✅ User data synced to cloud:', {
        groups: userGroups.length,
        matches: userMatches.length,
        players: userPlayers.length
      });

    } catch (error) {
      console.error('❌ Failed to sync user data to cloud:', error);
      throw error;
    }
  }

  // Load user data from cloud and merge with local
  async loadUserDataFromCloud(): Promise<void> {
    const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) {
      console.warn('⚠️ No user email or phone for cloud load');
      return;
    }

    try {
      console.log('🔄 Loading user data from cloud...');
      const userIdentifier = this.currentUser.email || this.currentUser.phone;

      // Load groups
      const groupsQuery = query(
        collection(db, USER_GROUPS_COLLECTION),
        where('userIdentifier', '==', userIdentifier),
        orderBy('lastUpdated', 'desc')
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const cloudGroups = groupsSnapshot.docs.map(doc => doc.data().groupData as Group);

      // Load matches
      const matchesQuery = query(
        collection(db, USER_MATCHES_COLLECTION),
        where('userIdentifier', '==', userIdentifier),
        orderBy('lastUpdated', 'desc')
      );
      const matchesSnapshot = await getDocs(matchesQuery);
      const cloudMatches = matchesSnapshot.docs.map(doc => doc.data().matchData as Match);

      // Load players
      const playersQuery = query(
        collection(db, USER_PLAYERS_COLLECTION),
        where('userIdentifier', '==', userIdentifier),
        orderBy('lastUpdated', 'desc')
      );
      const playersSnapshot = await getDocs(playersQuery);
      const cloudPlayers = playersSnapshot.docs.map(doc => doc.data().playerData as Player);

      // Get local data for comparison
      const [localGroups, localMatches, localPlayers] = await Promise.all([
        storageService.getAllGroups(),
        storageService.getAllMatches(),
        storageService.getAllPlayers()
      ]);

      // Merge cloud data with local data (cloud takes precedence for newer items)
      const mergedGroups = this.mergeData(localGroups, cloudGroups, 'id', 'lastUpdated');
      const mergedMatches = this.mergeData(localMatches, cloudMatches, 'id', 'lastUpdated');
      const mergedPlayers = this.mergeData(localPlayers, cloudPlayers, 'id', 'lastUpdated');

      // Save merged data to local storage
      for (const group of mergedGroups) {
        await storageService.saveGroup(group);
      }
      
      for (const match of mergedMatches) {
        await storageService.saveMatch(match);
      }
      
      await storageService.savePlayersBatch(mergedPlayers);

      console.log('✅ User data loaded and merged from cloud:', {
        groups: mergedGroups.length,
        matches: mergedMatches.length,
        players: mergedPlayers.length
      });

      // Trigger UI refresh
      window.dispatchEvent(new CustomEvent('userDataSynced', {
        detail: { 
          groups: mergedGroups.length, 
          matches: mergedMatches.length, 
          players: mergedPlayers.length 
        }
      }));

    } catch (error) {
      console.error('❌ Failed to load user data from cloud:', error);
      throw error;
    }
  }

  // Merge local and cloud data arrays
  private mergeData<T extends { id: string; lastUpdated?: number }>(
    localData: T[], 
    cloudData: T[], 
    idField: keyof T, 
    timestampField: keyof T
  ): T[] {
    const merged = new Map<string, T>();

    // Add all local data first
    localData.forEach(item => {
      merged.set(item[idField] as string, item);
    });

    // Add cloud data, replacing local if cloud is newer
    cloudData.forEach(cloudItem => {
      const id = cloudItem[idField] as string;
      const localItem = merged.get(id);
      
      if (!localItem) {
        // New item from cloud
        merged.set(id, cloudItem);
      } else {
        // Compare timestamps - use newer one
        const localTime = (localItem[timestampField] as number) || 0;
        const cloudTime = (cloudItem[timestampField] as number) || 0;
        
        if (cloudTime > localTime) {
          merged.set(id, cloudItem);
        }
      }
    });

    return Array.from(merged.values());
  }

  // Start real-time synchronization subscriptions
  private async startRealtimeSync(): Promise<void> {
    const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) return;

    console.log('🔄 Starting real-time sync subscriptions for:', userIdentifier);

    // Subscribe to groups changes
    const groupsQuery = query(
      collection(db, USER_GROUPS_COLLECTION),
      where('userIdentifier', '==', userIdentifier)
    );
    
    const unsubscribeGroups = onSnapshot(groupsQuery, async (snapshot) => {
      console.log('🔄 Groups updated in cloud, syncing...');
      await this.loadUserDataFromCloud();
    });

    // Subscribe to matches changes
    const matchesQuery = query(
      collection(db, USER_MATCHES_COLLECTION),
      where('userIdentifier', '==', userIdentifier)
    );
    
    const unsubscribeMatches = onSnapshot(matchesQuery, async (snapshot) => {
      console.log('🔄 Matches updated in cloud, syncing...');
      await this.loadUserDataFromCloud();
    });

    // Subscribe to players changes
    const playersQuery = query(
      collection(db, USER_PLAYERS_COLLECTION),
      where('userIdentifier', '==', userIdentifier)
    );
    
    const unsubscribePlayers = onSnapshot(playersQuery, async (snapshot) => {
      console.log('🔄 Players updated in cloud, syncing...');
      await this.loadUserDataFromCloud();
    });

    // Store unsubscribe functions
    this.syncSubscriptions = [unsubscribeGroups, unsubscribeMatches, unsubscribePlayers];
  }

  // Perform full bidirectional sync
  async performFullSync(): Promise<void> {
    try {
      console.log('🔄 Performing full bidirectional sync...');
      
      // First, upload local changes to cloud
      await this.syncUserDataToCloud();
      
      // Then, download and merge cloud changes
      await this.loadUserDataFromCloud();
      
      console.log('✅ Full sync completed successfully');
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      throw error;
    }
  }

  // Stop all sync subscriptions
  stopSync(): void {
    console.log('🛑 Stopping cloud sync subscriptions...');
    this.syncSubscriptions.forEach(unsubscribe => unsubscribe());
    this.syncSubscriptions = [];
    this.currentUser = null;
  }

  // Check sync status
  async getSyncStatus(): Promise<{
    lastSyncTime?: Date;
    cloudDataCount: { groups: number; matches: number; players: number };
    isOnline: boolean;
  }> {
    const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) {
      return { cloudDataCount: { groups: 0, matches: 0, players: 0 }, isOnline: false };
    }

    try {
      const metadataRef = doc(db, SYNC_METADATA_COLLECTION, userIdentifier);
      const metadataDoc = await getDoc(metadataRef);
      
      const metadata = metadataDoc.exists() ? metadataDoc.data() : null;
      
      return {
        lastSyncTime: metadata?.lastSyncTime?.toDate(),
        cloudDataCount: metadata?.dataCount || { groups: 0, matches: 0, players: 0 },
        isOnline: navigator.onLine
      };
    } catch (error) {
      console.error('❌ Failed to get sync status:', error);
      return { cloudDataCount: { groups: 0, matches: 0, players: 0 }, isOnline: false };
    }
  }

  // Manual sync trigger
  async manualSync(): Promise<{ success: boolean; message: string }> {
    try {
      const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
      if (!userIdentifier) {
        return { success: false, message: 'No user logged in for sync' };
      }

      if (!navigator.onLine) {
        return { success: false, message: 'Device is offline' };
      }

      await this.performFullSync();
      return { success: true, message: 'Sync completed successfully' };
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      return { success: false, message: `Sync failed: ${error.message}` };
    }
  }
}

export const userCloudSyncService = new UserCloudSyncService(); 