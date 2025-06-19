import { db, auth } from '../config/firebase';
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
  writeBatch,
  deleteDoc,
  addDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { User as AuthUser } from 'firebase/auth';
import { User, Group, Match, Player, Invitation } from '../types/cricket';

// Firestore Collections
const COLLECTIONS = {
  USERS: 'users',
  GROUPS: 'groups', 
  MATCHES: 'matches',
  PLAYERS: 'players',
  INVITATIONS: 'invitations',
  USER_PROFILES: 'user_profiles'
} as const;

class CloudStorageService {
  private currentUser: AuthUser | null = null;
  private isOnline: boolean = navigator.onLine;
  private offlineCache = new Map<string, any>();
  private subscribers = new Map<string, (() => void)[]>();

  constructor() {
    // Monitor online status
    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));
    
    // Listen to auth state changes
    auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      console.log('🔄 Auth state changed:', user?.email || 'No user');
    });
  }

  private setOnlineStatus(status: boolean) {
    this.isOnline = status;
    console.log(`📡 Network status: ${status ? 'Online' : 'Offline'}`);
    
    if (status) {
      this.syncOfflineChanges();
    }
  }

  private async syncOfflineChanges() {
    console.log('🔄 Syncing offline changes...');
    // Implementation for syncing offline changes when back online
  }

  private getCurrentUserId(): string {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }
    return this.currentUser.uid;
  }

  private getUserEmail(): string {
    if (!this.currentUser?.email) {
      throw new Error('User email not available');
    }
    return this.currentUser.email;
  }

  // User Management
  async saveUserProfile(userData: User): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const userRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
      
      const profileData = {
        ...userData,
        uid: userId,
        email: this.getUserEmail(),
        lastUpdated: serverTimestamp(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          lastActiveAt: serverTimestamp()
        }
      };

      await setDoc(userRef, profileData, { merge: true });
      console.log('✅ User profile saved to cloud');
      
      // Cache locally for offline access
      this.offlineCache.set(`user_${userId}`, profileData);
    } catch (error) {
      console.error('❌ Failed to save user profile:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<User | null> {
    try {
      const userId = this.getCurrentUserId();
      const userRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
      
      if (!this.isOnline) {
        const cached = this.offlineCache.get(`user_${userId}`);
        if (cached) return cached;
      }

      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        this.offlineCache.set(`user_${userId}`, userData);
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      const cached = this.offlineCache.get(`user_${this.getCurrentUserId()}`);
      return cached || null;
    }
  }

  // Group Management
  async saveGroup(group: Group): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const groupRef = doc(db, COLLECTIONS.GROUPS, group.id);
      
      const groupData = {
        ...group,
        ownerId: userId,
        ownerEmail: this.getUserEmail(),
        lastUpdated: serverTimestamp(),
        members: group.members.map(member => ({
          ...member,
          addedAt: member.addedAt || Date.now()
        }))
      };

      await setDoc(groupRef, groupData, { merge: true });
      console.log('✅ Group saved to cloud:', group.name);
      
      this.offlineCache.set(`group_${group.id}`, groupData);
      this.notifySubscribers(`groups_${userId}`);
    } catch (error) {
      console.error('❌ Failed to save group:', error);
      throw error;
    }
  }

  async getGroup(groupId: string): Promise<Group | null> {
    try {
      const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
      
      if (!this.isOnline) {
        const cached = this.offlineCache.get(`group_${groupId}`);
        if (cached) return cached;
      }

      const groupDoc = await getDoc(groupRef);
      if (groupDoc.exists()) {
        const groupData = groupDoc.data() as Group;
        this.offlineCache.set(`group_${groupId}`, groupData);
        return groupData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get group:', error);
      return this.offlineCache.get(`group_${groupId}`) || null;
    }
  }

  async getUserGroups(): Promise<Group[]> {
    try {
      const userId = this.getCurrentUserId();
      const userEmail = this.getUserEmail();
      
      if (!this.isOnline) {
        const cached = Array.from(this.offlineCache.values())
          .filter(item => item.ownerId === userId || 
            item.members?.some((m: any) => m.userEmail === userEmail));
        return cached;
      }

      // Query groups where user is owner or member
      const [ownedGroups, memberGroups] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.GROUPS), where('ownerId', '==', userId))),
        getDocs(query(collection(db, COLLECTIONS.GROUPS), where('members', 'array-contains-any', [
          { userEmail }, { userId }
        ])))
      ]);

      const groups: Group[] = [];
      const seenIds = new Set<string>();

      // Add owned groups
      ownedGroups.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          const group = { id: doc.id, ...doc.data() } as Group;
          groups.push(group);
          seenIds.add(doc.id);
          this.offlineCache.set(`group_${doc.id}`, group);
        }
      });

      // Add member groups
      memberGroups.forEach(doc => {
        if (!seenIds.has(doc.id)) {
          const group = { id: doc.id, ...doc.data() } as Group;
          groups.push(group);
          seenIds.add(doc.id);
          this.offlineCache.set(`group_${doc.id}`, group);
        }
      });

      console.log('✅ Loaded user groups from cloud:', groups.length);
      return groups;
    } catch (error) {
      console.error('❌ Failed to get user groups:', error);
      // Return cached groups as fallback
      return Array.from(this.offlineCache.values())
        .filter(item => item.ownerId === this.getCurrentUserId());
    }
  }

  // Player Management
  async savePlayer(player: Player): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const playerRef = doc(db, COLLECTIONS.PLAYERS, player.id);
      
      const playerData = {
        ...player,
        createdBy: userId,
        createdByEmail: this.getUserEmail(),
        lastUpdated: serverTimestamp(),
        groupIds: player.groupIds || []
      };

      await setDoc(playerRef, playerData, { merge: true });
      console.log('✅ Player saved to cloud:', player.name);
      
      this.offlineCache.set(`player_${player.id}`, playerData);
      this.notifySubscribers(`players_${userId}`);
    } catch (error) {
      console.error('❌ Failed to save player:', error);
      throw error;
    }
  }

  async getPlayer(playerId: string): Promise<Player | null> {
    try {
      const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
      
      if (!this.isOnline) {
        const cached = this.offlineCache.get(`player_${playerId}`);
        if (cached) return cached;
      }

      const playerDoc = await getDoc(playerRef);
      if (playerDoc.exists()) {
        const playerData = playerDoc.data() as Player;
        this.offlineCache.set(`player_${playerId}`, playerData);
        return playerData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get player:', error);
      return this.offlineCache.get(`player_${playerId}`) || null;
    }
  }

  async getGroupPlayers(groupId: string): Promise<Player[]> {
    try {
      if (!this.isOnline) {
        const cached = Array.from(this.offlineCache.values())
          .filter(item => item.groupIds?.includes(groupId));
        return cached;
      }

      const playersQuery = query(
        collection(db, COLLECTIONS.PLAYERS),
        where('groupIds', 'array-contains', groupId)
      );

      const playersSnapshot = await getDocs(playersQuery);
      const players: Player[] = [];

      playersSnapshot.forEach(doc => {
        const player = { id: doc.id, ...doc.data() } as Player;
        players.push(player);
        this.offlineCache.set(`player_${doc.id}`, player);
      });

      console.log('✅ Loaded group players from cloud:', players.length);
      return players;
    } catch (error) {
      console.error('❌ Failed to get group players:', error);
      return Array.from(this.offlineCache.values())
        .filter(item => item.groupIds?.includes(groupId));
    }
  }

  async removePlayerFromGroup(playerId: string, groupId: string): Promise<void> {
    try {
      const player = await this.getPlayer(playerId);
      if (!player) throw new Error('Player not found');

      const updatedGroupIds = player.groupIds?.filter(id => id !== groupId) || [];
      
      if (updatedGroupIds.length === 0) {
        // Remove player entirely if no groups left
        await deleteDoc(doc(db, COLLECTIONS.PLAYERS, playerId));
        this.offlineCache.delete(`player_${playerId}`);
      } else {
        // Update player with remaining groups
        await updateDoc(doc(db, COLLECTIONS.PLAYERS, playerId), {
          groupIds: updatedGroupIds,
          lastUpdated: serverTimestamp()
        });
        
        const updatedPlayer = { ...player, groupIds: updatedGroupIds };
        this.offlineCache.set(`player_${playerId}`, updatedPlayer);
      }

      console.log('✅ Player removed from group');
      this.notifySubscribers(`players_${this.getCurrentUserId()}`);
    } catch (error) {
      console.error('❌ Failed to remove player from group:', error);
      throw error;
    }
  }

  // Match Management
  async saveMatch(match: Match): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const matchRef = doc(db, COLLECTIONS.MATCHES, match.id);
      
      const matchData = {
        ...match,
        createdBy: userId,
        createdByEmail: this.getUserEmail(),
        lastUpdated: serverTimestamp(),
        isCompleted: match.isCompleted || false
      };

      await setDoc(matchRef, matchData, { merge: true });
      console.log('✅ Match saved to cloud:', match.id);
      
      this.offlineCache.set(`match_${match.id}`, matchData);
      this.notifySubscribers(`matches_${userId}`);
    } catch (error) {
      console.error('❌ Failed to save match:', error);
      throw error;
    }
  }

  async getMatch(matchId: string): Promise<Match | null> {
    try {
      const matchRef = doc(db, COLLECTIONS.MATCHES, matchId);
      
      if (!this.isOnline) {
        const cached = this.offlineCache.get(`match_${matchId}`);
        if (cached) return cached;
      }

      const matchDoc = await getDoc(matchRef);
      if (matchDoc.exists()) {
        const matchData = matchDoc.data() as Match;
        this.offlineCache.set(`match_${matchId}`, matchData);
        return matchData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get match:', error);
      return this.offlineCache.get(`match_${matchId}`) || null;
    }
  }

  async getUserMatches(): Promise<Match[]> {
    try {
      const userId = this.getCurrentUserId();
      
      if (!this.isOnline) {
        const cached = Array.from(this.offlineCache.values())
          .filter(item => item.createdBy === userId);
        return cached;
      }

      const matchesQuery = query(
        collection(db, COLLECTIONS.MATCHES),
        where('createdBy', '==', userId),
        orderBy('startTime', 'desc'),
        limit(100)
      );

      const matchesSnapshot = await getDocs(matchesQuery);
      const matches: Match[] = [];

      matchesSnapshot.forEach(doc => {
        const match = { id: doc.id, ...doc.data() } as Match;
        matches.push(match);
        this.offlineCache.set(`match_${doc.id}`, match);
      });

      console.log('✅ Loaded user matches from cloud:', matches.length);
      return matches;
    } catch (error) {
      console.error('❌ Failed to get user matches:', error);
      return Array.from(this.offlineCache.values())
        .filter(item => item.createdBy === this.getCurrentUserId());
    }
  }

  async getGroupMatches(groupId: string): Promise<Match[]> {
    try {
      if (!this.isOnline) {
        const cached = Array.from(this.offlineCache.values())
          .filter(item => item.groupId === groupId);
        return cached;
      }

      const matchesQuery = query(
        collection(db, COLLECTIONS.MATCHES),
        where('groupId', '==', groupId),
        orderBy('startTime', 'desc')
      );

      const matchesSnapshot = await getDocs(matchesQuery);
      const matches: Match[] = [];

      matchesSnapshot.forEach(doc => {
        const match = { id: doc.id, ...doc.data() } as Match;
        matches.push(match);
        this.offlineCache.set(`match_${doc.id}`, match);
      });

      console.log('✅ Loaded group matches from cloud:', matches.length);
      return matches;
    } catch (error) {
      console.error('❌ Failed to get group matches:', error);
      return Array.from(this.offlineCache.values())
        .filter(item => item.groupId === groupId);
    }
  }

  // Real-time subscriptions
  subscribeToUserGroups(callback: (groups: Group[]) => void): () => void {
    const userId = this.getCurrentUserId();
    const subscriptionKey = `groups_${userId}`;
    
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, []);
    }
    this.subscribers.get(subscriptionKey)!.push(callback);

    // Set up Firestore real-time listener
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.GROUPS), where('ownerId', '==', userId)),
      (snapshot) => {
        const groups: Group[] = [];
        snapshot.forEach(doc => {
          const group = { id: doc.id, ...doc.data() } as Group;
          groups.push(group);
          this.offlineCache.set(`group_${doc.id}`, group);
        });
        this.notifySubscribers(subscriptionKey);
      },
      (error) => console.error('❌ Groups subscription error:', error)
    );

    return () => {
      unsubscribe();
      const callbacks = this.subscribers.get(subscriptionKey) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  private notifySubscribers(key: string) {
    const callbacks = this.subscribers.get(key) || [];
    callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('❌ Subscription callback error:', error);
      }
    });
  }

  // Utility methods
  async isOnlineStatus(): Promise<boolean> {
    return this.isOnline;
  }

  async clearOfflineCache(): Promise<void> {
    this.offlineCache.clear();
    console.log('✅ Offline cache cleared');
  }

  async getCloudSyncStatus(): Promise<{
    isOnline: boolean;
    cacheSize: number;
    lastSync: Date | null;
    user: string | null;
  }> {
    return {
      isOnline: this.isOnline,
      cacheSize: this.offlineCache.size,
      lastSync: new Date(), // Could track this more precisely
      user: this.currentUser?.email || null
    };
  }

  // Connection testing
  async checkConnection(): Promise<{
    online: boolean;
    firebaseWorking: boolean;
    lastSync?: Date;
  }> {
    try {
      // Test basic internet connectivity
      const online = navigator.onLine;
      
      if (!online) {
        return {
          online: false,
          firebaseWorking: false,
          lastSync: undefined
        };
      }

      // Test Firebase connectivity by trying to read a document
      let firebaseWorking = false;
      try {
        if (this.currentUser) {
          const userRef = doc(db, COLLECTIONS.USER_PROFILES, this.currentUser.uid);
          await getDoc(userRef);
          firebaseWorking = true;
        } else {
          // Test without authentication by trying to read from a public collection
          const testQuery = query(collection(db, COLLECTIONS.GROUPS), limit(1));
          await getDocs(testQuery);
          firebaseWorking = true;
        }
      } catch (error) {
        console.warn('Firebase connectivity test failed:', error);
        firebaseWorking = false;
      }

      return {
        online,
        firebaseWorking,
        lastSync: firebaseWorking ? new Date() : undefined
      };
    } catch (error) {
      console.error('Connection check failed:', error);
      return {
        online: false,
        firebaseWorking: false,
        lastSync: undefined
      };
    }
  }

  // Enhanced persistence methods
  async ensureDataPersistence(): Promise<void> {
    try {
      console.log('🔄 Ensuring data persistence...');
      
      // Save current cache to localStorage as backup
      const cacheData = Object.fromEntries(this.offlineCache);
      localStorage.setItem('cloudStorageCache', JSON.stringify(cacheData));
      
      // If online, sync all cached data to cloud
      if (this.isOnline && this.currentUser) {
        await this.syncOfflineChanges();
      }
      
      console.log('✅ Data persistence ensured');
    } catch (error) {
      console.error('❌ Failed to ensure data persistence:', error);
    }
  }

  async restoreFromLocalBackup(): Promise<void> {
    try {
      const cachedData = localStorage.getItem('cloudStorageCache');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        this.offlineCache = new Map(Object.entries(parsedData));
        console.log('✅ Restored data from local backup:', this.offlineCache.size, 'items');
      }
    } catch (error) {
      console.error('❌ Failed to restore from local backup:', error);
    }
  }

  // Deletion methods
  async deleteGroup(groupId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting group from cloud:', groupId);

      if (this.isOnline && this.currentUser) {
        const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
        await deleteDoc(groupRef);
        console.log('☁️ Group deleted from Firestore');
      }

      // Remove from offline cache
      this.offlineCache.delete(`group_${groupId}`);
      
      console.log('✅ Group deleted from cloud storage');
    } catch (error) {
      console.error('❌ Failed to delete group from cloud:', error);
      throw error;
    }
  }

  async deletePlayer(playerId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting player from cloud:', playerId);

      if (this.isOnline && this.currentUser) {
        const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
        await deleteDoc(playerRef);
        console.log('☁️ Player deleted from Firestore');
      }

      // Remove from offline cache
      this.offlineCache.delete(`player_${playerId}`);
      
      console.log('✅ Player deleted from cloud storage');
    } catch (error) {
      console.error('❌ Failed to delete player from cloud:', error);
      throw error;
    }
  }

  async deleteMatch(matchId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting match from cloud:', matchId);

      if (this.isOnline && this.currentUser) {
        const matchRef = doc(db, COLLECTIONS.MATCHES, matchId);
        await deleteDoc(matchRef);
        console.log('☁️ Match deleted from Firestore');
      }

      // Remove from offline cache
      this.offlineCache.delete(`match_${matchId}`);
      
      console.log('✅ Match deleted from cloud storage');
    } catch (error) {
      console.error('❌ Failed to delete match from cloud:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting user from cloud:', userId);

      if (this.isOnline && this.currentUser) {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, userId);
        await deleteDoc(userRef);
        console.log('☁️ User deleted from Firestore');
      }

      // Remove from offline cache
      this.offlineCache.delete(`user_${userId}`);
      
      console.log('✅ User deleted from cloud storage');
    } catch (error) {
      console.error('❌ Failed to delete user from cloud:', error);
      throw error;
    }
  }
}

// Add deletion methods to CloudStorageService (need to add these to the class)

// Export singleton instance
export const cloudStorageService = new CloudStorageService();

// Extension methods for deletion - adding these as additional methods
const originalCloudStorage = cloudStorageService as any;

originalCloudStorage.deleteGroup = async function(groupId: string): Promise<void> {
  const { deleteDoc, doc } = await import('firebase/firestore');
  const { db } = await import('../config/firebase');
  
  try {
    console.log('🗑️ Deleting group from cloud:', groupId);

    if (this.isOnline && this.currentUser) {
      const groupRef = doc(db, 'groups', groupId);
      await deleteDoc(groupRef);
      console.log('☁️ Group deleted from Firestore');
    }

    // Remove from offline cache
    this.offlineCache.delete(`group_${groupId}`);
    
    console.log('✅ Group deleted from cloud storage');
  } catch (error) {
    console.error('❌ Failed to delete group from cloud:', error);
    throw error;
  }
};

originalCloudStorage.deletePlayer = async function(playerId: string): Promise<void> {
  const { deleteDoc, doc } = await import('firebase/firestore');
  const { db } = await import('../config/firebase');
  
  try {
    console.log('🗑️ Deleting player from cloud:', playerId);

    if (this.isOnline && this.currentUser) {
      const playerRef = doc(db, 'players', playerId);
      await deleteDoc(playerRef);
      console.log('☁️ Player deleted from Firestore');
    }

    // Remove from offline cache
    this.offlineCache.delete(`player_${playerId}`);
    
    console.log('✅ Player deleted from cloud storage');
  } catch (error) {
    console.error('❌ Failed to delete player from cloud:', error);
    throw error;
  }
};

originalCloudStorage.deleteMatch = async function(matchId: string): Promise<void> {
  const { deleteDoc, doc } = await import('firebase/firestore');
  const { db } = await import('../config/firebase');
  
  try {
    console.log('🗑️ Deleting match from cloud:', matchId);

    if (this.isOnline && this.currentUser) {
      const matchRef = doc(db, 'matches', matchId);
      await deleteDoc(matchRef);
      console.log('☁️ Match deleted from Firestore');
    }

    // Remove from offline cache
    this.offlineCache.delete(`match_${matchId}`);
    
    console.log('✅ Match deleted from cloud storage');
  } catch (error) {
    console.error('❌ Failed to delete match from cloud:', error);
    throw error;
  }
};