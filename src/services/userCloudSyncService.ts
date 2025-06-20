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

// Quota error handling utilities
const clearFirebaseCache = (): void => {
  try {
    console.log('🧹 Clearing Firebase cache due to quota error...');
    const keysToRemove: string[] = [];
    
    // Find all Firebase-related keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('firestore') ||
        key.includes('firebase') ||
        key.includes('mutation') ||
        key.includes('pending') ||
        key.includes('_4255_') ||
        key.includes('_1026_')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all Firebase cache keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed Firebase cache key: ${key.substring(0, 50)}...`);
      } catch (error) {
        console.warn(`⚠️ Failed to remove key ${key}:`, error);
      }
    });
    
    console.log(`✅ Cleared ${keysToRemove.length} Firebase cache entries`);
  } catch (error) {
    console.error('❌ Failed to clear Firebase cache:', error);
  }
};

const handleQuotaExceededError = async (error: any, operation: string): Promise<void> => {
  console.error(`🚨 Quota exceeded during ${operation}:`, error);
  
  // Clear Firebase cache
  clearFirebaseCache();
  
  // Also clear any old backup data
  try {
    localStorage.removeItem('cricket_scorer_backup');
    localStorage.removeItem('cricket_scorer_backup_history');
  } catch (cleanupError) {
    console.warn('⚠️ Failed to clear backup data:', cleanupError);
  }
  
  // Show user-friendly message
  const message = `Storage quota exceeded during ${operation}. Firebase cache has been cleared. Please refresh the page and try again.`;
  console.warn('⚠️', message);
  
  // Dispatch event for UI handling
  window.dispatchEvent(new CustomEvent('quotaExceeded', {
    detail: { operation, message, cleared: true }
  }));
};

const withQuotaErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (error?.message?.includes('QuotaExceededError') || 
        error?.message?.includes('exceeded the quota') ||
        error?.code === 'quota-exceeded') {
      await handleQuotaExceededError(error, operationName);
      throw new Error(`Storage quota exceeded during ${operationName}. Please refresh the page and try again.`);
    }
    throw error;
  }
};

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
    
    return withQuotaErrorHandling(async () => {
      // Clear Firebase cache before large operations
      if (Math.random() < 0.1) { // 10% chance to proactively clear cache
        clearFirebaseCache();
      }
      
      // Clean user data to remove undefined values
      const cleanUserData = {
        ...user,
        name: user.name || 'Unknown',
        email: user.email || null,
        phone: user.phone || null,
        lastUpdated: serverTimestamp(),
        syncVersion: Date.now()
      };
      
      const userRef = doc(db, USERS_COLLECTION, userIdentifier);
      await setDoc(userRef, cleanUserData, { merge: true });
      
      console.log('✅ User profile saved to cloud:', userIdentifier);
    }, 'saveUserToCloud');
  }

  // Sync all user data to cloud (groups, matches, players)
  async syncUserDataToCloud(force: boolean = false): Promise<void> {
    const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) {
      console.warn('⚠️ No user email or phone for cloud sync');
      return;
    }

    return withQuotaErrorHandling(async () => {
      console.log('🔄 Syncing user data to cloud...');
      
      // Clear Firebase cache proactively before large operations
      clearFirebaseCache();
      
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
          ...(match.team1?.players || []),
          ...(match.team2?.players || []),
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

      // Split into smaller chunks to avoid quota issues
      const chunkSize = 10;
      const allItems = [
        ...userGroups.map(g => ({ type: 'group', data: g })),
        ...userMatches.map(m => ({ type: 'match', data: m })),
        ...userPlayers.map(p => ({ type: 'player', data: p }))
      ];

      // Process in chunks
      for (let i = 0; i < allItems.length; i += chunkSize) {
        const chunk = allItems.slice(i, i + chunkSize);
        
        try {
          const batch = writeBatch(db);
          const timestamp = serverTimestamp();

          for (const item of chunk) {
            let ref;
            let data;
            
            switch (item.type) {
              case 'group':
                ref = doc(db, USER_GROUPS_COLLECTION, `${userIdentifier}_${item.data.id}`);
                data = {
                  userIdentifier,
                  groupData: item.data,
                  lastUpdated: timestamp,
                  syncVersion: Date.now()
                };
                break;
              case 'match':
                ref = doc(db, USER_MATCHES_COLLECTION, `${userIdentifier}_${item.data.id}`);
                data = {
                  userIdentifier,
                  matchData: item.data,
                  lastUpdated: timestamp,
                  syncVersion: Date.now()
                };
                break;
              case 'player':
                ref = doc(db, USER_PLAYERS_COLLECTION, `${userIdentifier}_${item.data.id}`);
                data = {
                  userIdentifier,
                  playerData: item.data,
                  lastUpdated: timestamp,
                  syncVersion: Date.now()
                };
                break;
            }
            
            if (ref && data) {
              batch.set(ref, data, { merge: true });
            }
          }

          // Commit chunk
          await batch.commit();
          console.log(`✅ Synced chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(allItems.length/chunkSize)}`);
          
          // Small delay between chunks to avoid overwhelming Firebase
          if (i + chunkSize < allItems.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError: any) {
          if (chunkError?.message?.includes('QuotaExceededError')) {
            clearFirebaseCache();
            throw chunkError; // Re-throw to be handled by outer withQuotaErrorHandling
          }
          console.warn(`⚠️ Failed to sync chunk ${Math.floor(i/chunkSize) + 1}:`, chunkError);
        }
      }

      // Update sync metadata separately
      try {
        const metadataRef = doc(db, SYNC_METADATA_COLLECTION, userIdentifier);
        await setDoc(metadataRef, {
          userIdentifier,
          lastSyncTime: serverTimestamp(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            timestamp: Date.now()
          },
          dataCount: {
            groups: userGroups.length,
            matches: userMatches.length,
            players: userPlayers.length
          }
        }, { merge: true });
      } catch (metadataError) {
        console.warn('⚠️ Failed to update sync metadata:', metadataError);
      }
      
      console.log('✅ User data synced to cloud:', {
        groups: userGroups.length,
        matches: userMatches.length,
        players: userPlayers.length
      });

    }, 'syncUserDataToCloud');
  }

  // Load user data from cloud and merge with local
  async loadUserDataFromCloud(): Promise<void> {
    const userIdentifier = this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) {
      console.warn('⚠️ No user email or phone for cloud load');
      return;
    }

    return withQuotaErrorHandling(async () => {
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

    }, 'loadUserDataFromCloud');
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
    return withQuotaErrorHandling(async () => {
      console.log('🔄 Performing full bidirectional sync...');
      
      // Clear Firebase cache before full sync
      clearFirebaseCache();
      
      // First, upload local changes to cloud
      await this.syncUserDataToCloud();
      
      // Then, download and merge cloud changes
      await this.loadUserDataFromCloud();
      
      console.log('✅ Full sync completed successfully');
    }, 'performFullSync');
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
    } catch (error: any) {
      console.error('❌ Manual sync failed:', error);
      
      // Handle quota exceeded errors specifically
      if (error?.message?.includes('Storage quota exceeded') || 
          error?.message?.includes('QuotaExceededError')) {
        return { 
          success: false, 
          message: 'Storage quota exceeded. Firebase cache has been cleared. Please refresh the page and try again.' 
        };
      }
      
      return { success: false, message: `Sync failed: ${error.message}` };
    }
  }
}

export const userCloudSyncService = new UserCloudSyncService(); 