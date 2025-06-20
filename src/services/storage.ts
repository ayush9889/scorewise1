import { Match, Player } from '../types/cricket';
import { User, Group, Invitation } from '../types/auth';
// Import sync services but avoid circular dependency
let autoSyncService: any = null;
let realTimeSyncService: any = null;

const DB_NAME = 'CricketScorerDB';
const DB_VERSION = 6; // Increment version to fix group indexing issues
const BACKUP_KEY = 'cricket_scorer_backup';
const AUTO_BACKUP_INTERVAL = 15 * 60 * 1000; // 15 minutes - reduced frequency to prevent crashes

class StorageService {
  private db: IDBDatabase | null = null;
  private backupTimer: NodeJS.Timeout | null = null;

  // Initialize sync services (lazy loading to avoid circular dependency)
  private initAutoSync(): void {
    try {
      if (!autoSyncService) {
        // Dynamically import to avoid circular dependency
        import('./autoSyncService').then(module => {
          autoSyncService = module.autoSyncService;
          console.log('🔄 Auto-sync service integrated with storage');
        });
      }
      
      if (!realTimeSyncService) {
        // Dynamically import real-time sync service
        import('./realTimeSyncService').then(module => {
          realTimeSyncService = module.realTimeSyncService;
          console.log('📡 Real-time sync service integrated with storage');
        });
      }
    } catch (error) {
      console.warn('⚠️ Sync services not available:', error);
    }
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        // Initialize auto-sync service after storage is ready
        this.initAutoSync();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create players store
        if (!db.objectStoreNames.contains('players')) {
          const playersStore = db.createObjectStore('players', { keyPath: 'id' });
          playersStore.createIndex('name', 'name', { unique: false });
          playersStore.createIndex('isGroupMember', 'isGroupMember', { unique: false });
          playersStore.createIndex('groupIds', 'groupIds', { unique: false, multiEntry: true });
        }

        // Create matches store
        if (!db.objectStoreNames.contains('matches')) {
          const matchesStore = db.createObjectStore('matches', { keyPath: 'id' });
          matchesStore.createIndex('startTime', 'startTime', { unique: false });
          matchesStore.createIndex('groupId', 'groupId', { unique: false });
          matchesStore.createIndex('isCompleted', 'isCompleted', { unique: false });
        }

        // Handle users store - recreate if exists to fix unique constraint
        if (db.objectStoreNames.contains('users')) {
          db.deleteObjectStore('users');
        }
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('email', 'email', { unique: false }); // Changed to non-unique
        usersStore.createIndex('phone', 'phone', { unique: false });

        // Handle groups store - Create if not exists with proper indexes
        if (!db.objectStoreNames.contains('groups')) {
          const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
          groupsStore.createIndex('inviteCode', 'inviteCode', { unique: true });
          groupsStore.createIndex('createdBy', 'createdBy', { unique: false });
          console.log('✅ Created groups store with inviteCode index');
        }
        // Note: For existing stores, the manual search fallback handles missing indexes

        // Handle invitations store - only recreate if needed to fix structure
        if (!db.objectStoreNames.contains('invitations')) {
          const invitationsStore = db.createObjectStore('invitations', { keyPath: 'id' });
          invitationsStore.createIndex('groupId', 'groupId', { unique: false });
          invitationsStore.createIndex('invitedEmail', 'invitedEmail', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Player methods
  async savePlayer(player: Player): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['players'], 'readwrite');
      const store = transaction.objectStore('players');
      const request = store.put(player);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Auto-sync player to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncPlayer(player);
        }
        // Push instant real-time update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('UPDATE', 'PLAYER', player);
        }
        resolve();
      };
    });
  }

  // Fast save method for immediate UI feedback
  savePlayerFast(player: Player): void {
    // Save in background without blocking UI
    this.savePlayer(player).catch((error) => {
      console.error('Background player save failed:', error);
    });
  }

  // Batch save multiple players efficiently
  async savePlayersBatch(players: Player[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (players.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['players'], 'readwrite');
      const store = transaction.objectStore('players');
      let completed = 0;
      let hasError = false;

      transaction.oncomplete = () => {
        if (!hasError) resolve();
      };

      transaction.onerror = () => {
        hasError = true;
        reject(transaction.error);
      };

      players.forEach(player => {
        const request = store.put(player);
        request.onerror = () => {
          hasError = true;
          reject(request.error);
        };
        request.onsuccess = () => {
          completed++;
        };
      });
    });
  }

  async getPlayer(id: string): Promise<Player | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['players'], 'readonly');
      const store = transaction.objectStore('players');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllPlayers(): Promise<Player[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction =  this.db!.transaction(['players'], 'readonly');
      const store = transaction.objectStore('players');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getGroupPlayers(groupId: string): Promise<Player[]> {
    try {
      const allPlayers = await this.getAllPlayers();
      return allPlayers.filter(player => 
        player.isGroupMember && 
        player.groupIds?.includes(groupId)
      );
    } catch (error) {
      console.error('Failed to get group players:', error);
      return [];
    }
  }

  async removePlayerFromGroup(playerId: string, groupId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const player = await this.getPlayer(playerId);
      if (!player) {
        throw new Error('Player not found');
      }

      // If player only belongs to this group, delete them entirely
      if (player.groupIds && player.groupIds.length === 1 && player.groupIds[0] === groupId) {
        return new Promise((resolve, reject) => {
          const transaction = this.db!.transaction(['players'], 'readwrite');
          const store = transaction.objectStore('players');
          const request = store.delete(playerId);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
      } else if (player.groupIds) {
        // Remove group from player's groupIds
        const updatedPlayer = {
          ...player,
          groupIds: player.groupIds.filter(id => id !== groupId)
        };

        return this.savePlayer(updatedPlayer);
      }
    } catch (error) {
      console.error('Failed to remove player from group:', error);
      throw error;
    }
  }

  async searchPlayers(query: string): Promise<Player[]> {
    const allPlayers = await this.getAllPlayers();
    return allPlayers.filter(player => 
      player.name.toLowerCase().includes(query.toLowerCase()) ||
      (player.shortId && player.shortId.toLowerCase().includes(query.toLowerCase()))
    );
  }

  // Match methods
  async saveMatch(match: Match): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readwrite');
      const store = transaction.objectStore('matches');
      const request = store.put(match);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Auto-sync match to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncMatch(match);
        }
        // Push instant real-time update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('UPDATE', 'MATCH', match);
        }
        resolve();
      };
    });
  }

  async getMatch(id: string): Promise<Match | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readonly');
      const store = transaction.objectStore('matches');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllMatches(): Promise<Match[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readonly');
      const store = transaction.objectStore('matches');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getGroupMatches(groupId: string): Promise<Match[]> {
    try {
      const allMatches = await this.getAllMatches();
      return allMatches.filter(match => {
        // Check if any players in the match belong to this group
        const allMatchPlayers = [
          ...match.team1.players,
          ...match.team2.players,
          ...(match.battingTeam?.players || []),
          ...(match.bowlingTeam?.players || [])
        ];
        
        return allMatchPlayers.some(player => 
          player.isGroupMember && 
          player.groupIds?.includes(groupId)
        );
      });
    } catch (error) {
      console.error('Failed to get group matches:', error);
      return [];
    }
  }

  async getIncompleteMatch(): Promise<Match | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readonly');
      const store = transaction.objectStore('matches');
      const index = store.index('isCompleted');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const matches = request.result || [];
        // Sort by most recent first
        matches.sort((a, b) => b.startTime - a.startTime);
        resolve(matches[0] || null);
      };
    });
  }

  async saveMatchState(match: Match): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readwrite');
      const store = transaction.objectStore('matches');
      
      // Add lastUpdated timestamp
      const matchWithTimestamp = {
        ...match,
        lastUpdated: new Date().toISOString()
      };
      
      const request = store.put(matchWithTimestamp);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearIncompleteMatches(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readwrite');
      const store = transaction.objectStore('matches');
      const index = store.index('isCompleted');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const incompleteMatches = request.result || [];
        
        // Delete each incomplete match
        const deletePromises = incompleteMatches.map(match => {
          return new Promise<void>((resolveDelete, rejectDelete) => {
            const deleteRequest = store.delete(match.id);
            deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
            deleteRequest.onsuccess = () => resolveDelete();
          });
        });

        Promise.all(deletePromises)
          .then(() => resolve())
          .catch(reject);
      };
    });
  }

  // User methods
  async saveUser(user: User): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.put(user);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Auto-sync user to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncUser(user);
        }
        // Push instant real-time update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('UPDATE', 'USER', user);
        }
        resolve();
      };
    });
  }

  async getUser(id: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('phone');
      const request = index.get(phone);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // Group methods
  async saveGroup(group: Group): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('💾 Storage: Saving group with invite code:', group.inviteCode);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readwrite');
      const store = transaction.objectStore('groups');
      const request = store.put(group);

      request.onerror = () => {
        console.error('❌ Storage: Failed to save group:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        console.log('✅ Storage: Group saved successfully:', group.name);
        // Auto-sync group to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncGroup(group);
        }
        // Push instant real-time update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('UPDATE', 'GROUP', group);
        }
        resolve();
      };
    });
  }

  async getGroup(id: string): Promise<Group | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readonly');
      const store = transaction.objectStore('groups');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getGroupByInviteCode(inviteCode: string): Promise<Group | null> {
    if (!this.db) throw new Error('Database not initialized');

    // Clean and normalize the invite code
    const cleanInviteCode = inviteCode.trim().toUpperCase();
    console.log('📊 Storage: Searching for invite code:', cleanInviteCode);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readonly');
      const store = transaction.objectStore('groups');
      
      // First try index-based search
      console.log('📊 Storage: Attempting index-based search...');
      try {
        const index = store.index('inviteCode');
        const request = index.get(cleanInviteCode);

        request.onerror = () => {
          console.warn('📊 Storage: Index search failed, falling back to manual search');
          this.performManualSearch(store, cleanInviteCode, resolve);
        };
        
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            console.log('✅ Storage: Found group via index:', result.name);
            resolve(result);
          } else {
            console.log('📊 Storage: Index search returned null, trying manual search...');
            this.performManualSearch(store, cleanInviteCode, resolve);
          }
        };
      } catch (indexError) {
        console.warn('📊 Storage: Index not available, using manual search only:', indexError);
        this.performManualSearch(store, cleanInviteCode, resolve);
      }
    });
  }

  private performManualSearch(store: IDBObjectStore, cleanInviteCode: string, resolve: (value: Group | null) => void): void {
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = () => {
      const allGroups = getAllRequest.result;
      console.log(`📊 Storage: Manual search through ${allGroups.length} groups...`);
      
      // Debug: Log all invite codes for comparison
      const allCodes = allGroups.map(g => g.inviteCode).filter(Boolean);
      console.log('📊 Storage: Available invite codes:', allCodes);
      
      const foundGroup = allGroups.find(group => 
        group.inviteCode && group.inviteCode.trim().toUpperCase() === cleanInviteCode
      );
      
      if (foundGroup) {
        console.log('✅ Storage: Found group via manual search:', foundGroup.name);
      } else {
        console.log('❌ Storage: Group not found in manual search');
        console.log('🔍 Storage: Searched for:', cleanInviteCode);
        console.log('🔍 Storage: Available codes:', allCodes);
      }
      
      resolve(foundGroup || null);
    };
    getAllRequest.onerror = () => {
      console.error('❌ Storage: Manual search failed');
      resolve(null);
    };
  }

  // Invitation methods
  async saveInvitation(invitation: Invitation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['invitations'], 'readwrite');
      const store = transaction.objectStore('invitations');
      const request = store.put(invitation);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getInvitation(id: string): Promise<Invitation | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['invitations'], 'readonly');
      const store = transaction.objectStore('invitations');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // Clear all data (for debugging)
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['players', 'matches', 'users', 'groups', 'invitations', 'settings'], 'readwrite');
      
      const stores = ['players', 'matches', 'users', 'groups', 'invitations', 'settings'];
      let completed = 0;
      
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) {
            resolve();
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Export/Import methods
  async exportData(): Promise<string> {
    const players = await this.getAllPlayers();
    const matches = await this.getAllMatches();
    const users = await this.getAllUsers();
    const groups = await this.getAllGroups();
    
    return JSON.stringify({
      players,
      matches,
      users,
      groups,
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.players) {
        for (const player of data.players) {
          await this.savePlayer(player);
        }
      }
      
      if (data.matches) {
        for (const match of data.matches) {
          await this.saveMatch(match);
        }
      }
      
      if (data.users) {
        for (const user of data.users) {
          await this.saveUser(user);
        }
      }
      
      if (data.groups) {
        for (const group of data.groups) {
          await this.saveGroup(group);
        }
      }
    } catch (error) {
      throw new Error('Invalid import data format');
    }
  }

  async getMatches(): Promise<Match[]> {
    return this.getAllMatches();
  }

  async getPlayers(): Promise<Player[]> {
    return this.getAllPlayers();
  }
  
  async getAllUsers(): Promise<User[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }
  
  async getAllGroups(): Promise<Group[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readonly');
      const store = transaction.objectStore('groups');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // Enhanced Persistence Methods
  async startAutoBackup(): Promise<void> {
    // Clear existing timer
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    // Create automatic backup every 5 minutes
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup();
        console.log('🔄 Auto-backup completed');
      } catch (error) {
        console.error('❌ Auto-backup failed:', error);
      }
    }, AUTO_BACKUP_INTERVAL);

    // Create initial backup
    await this.createBackup();
    console.log('✅ Auto-backup system started');
  }

  async stopAutoBackup(): Promise<void> {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
      console.log('🛑 Auto-backup system stopped');
    }
  }

  async createBackup(): Promise<void> {
    try {
      // Check storage quota before creating backup
      const quotaCheck = await this.checkStorageQuota();
      if (quotaCheck.percentage > 80) {
        console.warn('⚠️ Storage quota high, skipping backup to prevent quota exceeded error');
        return;
      }

      // Create smaller, more efficient backup - only essential data
      const users = await this.getAllUsers();
      const groups = await this.getAllGroups();
      
      // Only backup recent/important data to save space
      const recentMatches = (await this.getAllMatches())
        .filter(match => {
          const matchDate = new Date(match.startTime);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return matchDate > thirtyDaysAgo || !match.isCompleted;
        })
        .slice(-50); // Max 50 recent matches

      const activePlayers = (await this.getAllPlayers())
        .filter(player => player.isGroupMember)
        .slice(-100); // Max 100 active players

      const backupData = {
        timestamp: Date.now(),
        version: DB_VERSION,
        data: {
          users: users.slice(-20), // Max 20 recent users
          groups: groups.slice(-10), // Max 10 recent groups
          players: activePlayers,
          matches: recentMatches,
          settings: [] // Skip settings to save space
        }
      };

      const backupString = JSON.stringify(backupData);
      
      // Check if backup size is reasonable (max 1MB)
      if (backupString.length > 1024 * 1024) {
        console.warn('⚠️ Backup too large, creating minimal backup instead');
        
        // Create minimal backup with only users and current group
        const minimalBackup = {
          timestamp: Date.now(),
          version: DB_VERSION,
          data: {
            users: users.slice(-5),
            groups: groups.slice(-2),
            players: [],
            matches: recentMatches.slice(-10),
            settings: []
          }
        };
        
        try {
          localStorage.setItem(BACKUP_KEY, JSON.stringify(minimalBackup));
          console.log('✅ Minimal backup created successfully');
        } catch (error) {
          console.warn('⚠️ Even minimal backup failed, skipping backup');
          return;
        }
      } else {
        try {
          // Try to store backup
          localStorage.setItem(BACKUP_KEY, backupString);
          console.log('✅ Backup created successfully');
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('⚠️ Storage quota exceeded, clearing old backups and retrying with minimal backup');
            
            // Clear old backup data
            localStorage.removeItem(BACKUP_KEY);
            localStorage.removeItem(`${BACKUP_KEY}_history`);
            
            // Try minimal backup
            const minimalBackup = {
              timestamp: Date.now(),
              version: DB_VERSION,
              data: {
                users: users.slice(-3),
                groups: groups.slice(-1),
                players: [],
                matches: [],
                settings: []
              }
            };
            
            try {
              localStorage.setItem(BACKUP_KEY, JSON.stringify(minimalBackup));
              console.log('✅ Emergency minimal backup created');
            } catch (retryError) {
              console.error('❌ All backup attempts failed, skipping backup');
              return;
            }
          } else {
            throw error;
          }
        }
      }
      
      // Skip backup history to save space
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      // Don't throw error to prevent app crashes
    }
  }
  
  private async checkStorageQuota(): Promise<{percentage: number}> {
    try {
      let used = 0;
      let total = 5 * 1024 * 1024; // 5MB default
      
      // Calculate current localStorage usage
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      const percentage = (used / total) * 100;
      return { percentage };
    } catch (error) {
      return { percentage: 0 };
    }
  }

  async restoreFromBackup(): Promise<boolean> {
    try {
      // Try localStorage first
      let backupData = localStorage.getItem(BACKUP_KEY);
      
      // Fallback to sessionStorage
      if (!backupData) {
        backupData = sessionStorage.getItem(BACKUP_KEY);
      }

      if (!backupData) {
        console.log('ℹ️ No backup data found');
        return false;
      }

      const backup = JSON.parse(backupData);
      
      if (!backup.data) {
        console.error('❌ Invalid backup format');
        return false;
      }

      console.log('🔄 Restoring from backup...');

      // Clear existing data
      await this.clearAllData();

      // Restore data
      const { users, groups, players, matches, settings } = backup.data;

      // Restore users
      if (users && users.length > 0) {
        for (const user of users) {
          await this.saveUser(user);
        }
      }

      // Restore groups
      if (groups && groups.length > 0) {
        for (const group of groups) {
          await this.saveGroup(group);
        }
      }

      // Restore players
      if (players && players.length > 0) {
        await this.savePlayersBatch(players);
      }

      // Restore matches
      if (matches && matches.length > 0) {
        for (const match of matches) {
          await this.saveMatch(match);
        }
      }

      // Restore settings
      if (settings && settings.length > 0) {
        for (const setting of settings) {
          await this.saveSetting(setting.key, setting.value);
        }
      }

      console.log('✅ Data restored from backup successfully');
      return true;

    } catch (error) {
      console.error('❌ Backup restoration failed:', error);
      return false;
    }
  }

  getBackupHistory(): Array<{timestamp: number, size: number}> {
    try {
      const history = localStorage.getItem(`${BACKUP_KEY}_history`);
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  }

  async getAllSettings(): Promise<Array<{key: string, value: any}>> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value || null);
    });
  }

  // Enhanced data persistence for critical operations
  async saveUserPersistent(user: User): Promise<void> {
    await this.saveUser(user);
    await this.createBackup(); // Immediate backup after user changes
  }

  async saveMatchPersistent(match: Match): Promise<void> {
    await this.saveMatch(match);
    await this.createBackup(); // Immediate backup after match changes
  }

  async savePlayerPersistent(player: Player): Promise<void> {
    await this.savePlayer(player);
    await this.createBackup(); // Immediate backup after player changes
  }

  // Data integrity check
  async checkDataIntegrity(): Promise<{
    isHealthy: boolean;
    issues: string[];
    stats: {
      users: number;
      groups: number;
      players: number;
      matches: number;
    };
  }> {
    const issues: string[] = [];
    
    try {
      const users = await this.getAllUsers();
      const groups = await this.getAllGroups();
      const players = await this.getAllPlayers();
      const matches = await this.getAllMatches();

      // Check for orphaned data
      const userIds = new Set(users.map(u => u.id));
      const groupIds = new Set(groups.map(g => g.id));

      // Check if players reference valid groups
      players.forEach(player => {
        if (player.isGroupMember && player.groupIds) {
          player.groupIds.forEach(groupId => {
            if (!groupIds.has(groupId)) {
              issues.push(`Player ${player.name} references non-existent group ${groupId}`);
            }
          });
        }
      });

      // Check if groups reference valid creators
      groups.forEach(group => {
        if (!userIds.has(group.createdBy)) {
          issues.push(`Group ${group.name} references non-existent creator ${group.createdBy}`);
        }
      });

      return {
        isHealthy: issues.length === 0,
        issues,
        stats: {
          users: users.length,
          groups: groups.length,
          players: players.length,
          matches: matches.length
        }
      };

    } catch (error) {
      return {
        isHealthy: false,
        issues: [`Database access error: ${error}`],
        stats: { users: 0, groups: 0, players: 0, matches: 0 }
      };
    }
  }

  // USER-CENTRIC DATA STORAGE METHODS

  // Enhanced user methods with comprehensive profile data
  async saveUserProfile(user: User): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('💾 Saving comprehensive user profile:', user.email || user.phone);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      
      // Ensure user has complete profile structure
      const completeUser = this.ensureCompleteUserProfile(user);
      
      const request = store.put(completeUser);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('✅ User profile saved successfully');
        resolve();
      };
    });
  }

  // Get comprehensive user data by email/phone
  async getUserProfileByIdentifier(identifier: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🔍 Loading user profile by identifier:', identifier);

    // Try to find by email first, then phone
    let user = await this.getUserByEmail(identifier);
    if (!user) {
      user = await this.getUserByPhone(identifier);
    }

    if (user) {
      console.log('✅ User profile loaded:', user.name);
      // Ensure user has complete profile structure
      return this.ensureCompleteUserProfile(user);
    }

    console.log('❌ No user found with identifier:', identifier);
    return null;
  }

  // Ensure user has complete profile structure with defaults
  private ensureCompleteUserProfile(user: User): User {
    const now = Date.now();
    
    return {
      ...user,
      profile: user.profile || {
        playingRole: 'none',
        battingStyle: 'unknown',
        bowlingStyle: 'none'
      },
      statistics: user.statistics || {
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        highestScore: 0,
        battingAverage: 0,
        strikeRate: 0,
        centuries: 0,
        halfCenturies: 0,
        fours: 0,
        sixes: 0,
        ducks: 0,
        totalWickets: 0,
        totalBallsBowled: 0,
        totalRunsConceded: 0,
        bestBowlingFigures: '0/0',
        bowlingAverage: 0,
        economyRate: 0,
        maidenOvers: 0,
        fiveWicketHauls: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        manOfTheMatchAwards: 0,
        manOfTheSeriesAwards: 0,
        achievements: [],
        recentMatches: [],
        favoriteGroups: [],
        lastUpdated: now,
        performanceRating: 0,
        consistency: 0
      },
      preferences: user.preferences || {
        theme: 'auto',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: {
          matchInvites: true,
          groupUpdates: true,
          achievements: true,
          weeklyStats: false,
          email: true,
          sms: false,
          push: true
        },
        privacy: {
          profileVisibility: 'public',
          statsVisibility: 'public',
          contactVisibility: 'friends',
          allowGroupInvites: true,
          allowFriendRequests: true
        },
        matchSettings: {
          defaultFormat: 'T20',
          preferredRole: 'any',
          autoSaveFrequency: 5,
          scoringShortcuts: true,
          soundEffects: true,
          vibration: true
        }
      },
      socialProfile: user.socialProfile || {
        friends: [],
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        socialLinks: {}
      }
    };
  }

  // Get all user groups with comprehensive data
  async getUserGroups(userId: string): Promise<Group[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🔍 Loading user groups for:', userId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readonly');
      const store = transaction.objectStore('groups');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allGroups = request.result || [];
        // Filter groups where user is a member or creator
        const userGroups = allGroups.filter(group => 
          group.createdBy === userId || 
          group.members.some((member: any) => member.userId === userId)
        );
        
        console.log(`✅ Found ${userGroups.length} groups for user`);
        resolve(userGroups);
      };
    });
  }

  // Get all user matches with comprehensive data
  async getUserMatches(userId: string): Promise<Match[]> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🔍 Loading user matches for:', userId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readonly');
      const store = transaction.objectStore('matches');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allMatches = request.result || [];
        // Filter matches where user participated
        const userMatches = allMatches.filter(match => 
          this.isUserInMatch(match, userId)
        );
        
        console.log(`✅ Found ${userMatches.length} matches for user`);
        resolve(userMatches);
      };
    });
  }

  // Check if user participated in a match
  private isUserInMatch(match: Match, userId: string): boolean {
    // Check if user is in either team
    const inTeam1 = match.team1?.players?.some(player => player.id === userId);
    const inTeam2 = match.team2?.players?.some(player => player.id === userId);
    
    // Check if user scored the match
    const isScorer = (match as any).scoredBy === userId;
    
    return inTeam1 || inTeam2 || isScorer;
  }

  // Update user statistics after a match
  async updateUserStatistics(userId: string, matchStats: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('📊 Updating user statistics for:', userId);

    const user = await this.getUser(userId);
    if (!user) {
      console.warn('User not found for statistics update:', userId);
      return;
    }

    const completeUser = this.ensureCompleteUserProfile(user);
    
    // Update statistics based on match performance
    completeUser.statistics = this.calculateUpdatedStatistics(
      completeUser.statistics, 
      matchStats
    );
    
    completeUser.statistics.lastUpdated = Date.now();
    
    await this.saveUserProfile(completeUser);
    console.log('✅ User statistics updated successfully');
  }

  // Calculate updated statistics
  private calculateUpdatedStatistics(current: any, matchStats: any): any {
    return {
      ...current,
      totalMatches: current.totalMatches + 1,
      totalRuns: current.totalRuns + (matchStats.runs || 0),
      totalBallsFaced: current.totalBallsFaced + (matchStats.ballsFaced || 0),
      totalWickets: current.totalWickets + (matchStats.wickets || 0),
      totalBallsBowled: current.totalBallsBowled + (matchStats.ballsBowled || 0),
      totalRunsConceded: current.totalRunsConceded + (matchStats.runsConceded || 0),
      catches: current.catches + (matchStats.catches || 0),
      runOuts: current.runOuts + (matchStats.runOuts || 0),
      fours: current.fours + (matchStats.fours || 0),
      sixes: current.sixes + (matchStats.sixes || 0),
      
      // Update averages and rates
      battingAverage: current.totalBallsFaced > 0 ? 
        (current.totalRuns / current.totalBallsFaced) * 100 : 0,
      strikeRate: current.totalBallsFaced > 0 ? 
        (current.totalRuns / current.totalBallsFaced) * 100 : 0,
      bowlingAverage: current.totalWickets > 0 ? 
        current.totalRunsConceded / current.totalWickets : 0,
      economyRate: current.totalBallsBowled > 0 ? 
        (current.totalRunsConceded / (current.totalBallsBowled / 6)) : 0,
      
      // Update highest score
      highestScore: Math.max(current.highestScore, matchStats.runs || 0),
      
      // Update centuries and half-centuries
      centuries: current.centuries + (matchStats.runs >= 100 ? 1 : 0),
      halfCenturies: current.halfCenturies + (matchStats.runs >= 50 && matchStats.runs < 100 ? 1 : 0),
      
      // Update ducks
      ducks: current.ducks + (matchStats.runs === 0 && matchStats.ballsFaced > 0 ? 1 : 0),
      
      // Update match results
      totalWins: current.totalWins + (matchStats.result === 'win' ? 1 : 0),
      totalLosses: current.totalLosses + (matchStats.result === 'loss' ? 1 : 0),
      totalDraws: current.totalDraws + (matchStats.result === 'draw' ? 1 : 0),
      
      // Update MOTM awards
      manOfTheMatchAwards: current.manOfTheMatchAwards + (matchStats.isMotm ? 1 : 0)
    };
  }

  // Get user's complete cricket profile
  async getUserCricketProfile(identifier: string): Promise<{
    user: User;
    groups: Group[];
    matches: Match[];
    recentActivity: any[];
  } | null> {
    console.log('🏏 Loading complete cricket profile for:', identifier);

    try {
      const user = await this.getUserProfileByIdentifier(identifier);
      if (!user) return null;

      const [groups, matches] = await Promise.all([
        this.getUserGroups(user.id),
        this.getUserMatches(user.id)
      ]);

      // Get recent activity (last 10 matches)
      const recentActivity = matches
        .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))
        .slice(0, 10)
        .map(match => ({
          type: 'match',
          matchId: match.id,
          groupId: match.groupId,
          date: match.endTime || match.startTime,
          summary: `${match.team1.name} vs ${match.team2.name}`
        }));

      console.log('✅ Complete cricket profile loaded successfully');
      return {
        user,
        groups,
        matches,
        recentActivity
      };

    } catch (error) {
      console.error('❌ Failed to load cricket profile:', error);
      return null;
    }
  }

  // Export user's complete data
  async exportUserData(identifier: string): Promise<string | null> {
    console.log('📤 Exporting complete user data for:', identifier);

    try {
      const profile = await this.getUserCricketProfile(identifier);
      if (!profile) return null;

      const exportData = {
        ...profile,
        exportedAt: Date.now(),
        version: '1.0',
        format: 'ScoreWise User Data Export'
      };

      const jsonData = JSON.stringify(exportData, null, 2);
      console.log('✅ User data exported successfully');
      return jsonData;

    } catch (error) {
      console.error('❌ Failed to export user data:', error);
      return null;
    }
  }

  // Group-specific data retrieval methods for multi-group support
  async getGroupStats(groupId: string): Promise<any> {
    try {
      const groupPlayers = await this.getGroupPlayers(groupId);
      const groupMatches = await this.getGroupMatches(groupId);
      
      return {
        totalPlayers: groupPlayers.length,
        totalMatches: groupMatches.length,
        activePlayers: groupPlayers.filter(p => 
          p.stats && (p.stats.matchesPlayed || 0) > 0
        ).length,
        completedMatches: groupMatches.filter(m => m.isCompleted).length
      };
    } catch (error) {
      console.error('Failed to get group stats:', error);
      return {
        totalPlayers: 0,
        totalMatches: 0,
        activePlayers: 0,
        completedMatches: 0
      };
    }
  }

  // Delete methods
  async deleteMatch(matchId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🗑️ Deleting match from local storage:', matchId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readwrite');
      const store = transaction.objectStore('matches');
      const request = store.delete(matchId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('✅ Match deleted from local storage');
        // Auto-sync match deletion to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncMatchDeletion(matchId);
        }
        // Push instant real-time deletion update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('DELETE', 'MATCH', { id: matchId });
        }
        resolve();
      };
    });
  }

  async deletePlayer(playerId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🗑️ Deleting player from local storage:', playerId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['players'], 'readwrite');
      const store = transaction.objectStore('players');
      const request = store.delete(playerId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('✅ Player deleted from local storage');
        // Auto-sync player deletion to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncPlayerDeletion(playerId);
        }
        // Push instant real-time deletion update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('DELETE', 'PLAYER', { id: playerId });
        }
        resolve();
      };
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🗑️ Deleting group from local storage:', groupId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readwrite');
      const store = transaction.objectStore('groups');
      const request = store.delete(groupId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('✅ Group deleted from local storage');
        // Auto-sync group deletion to cloud
        if (autoSyncService) {
          autoSyncService.autoSyncGroupDeletion(groupId);
        }
        // Push instant real-time deletion update
        if (realTimeSyncService) {
          realTimeSyncService.pushInstantUpdate('DELETE', 'GROUP', { id: groupId });
        }
        resolve();
      };
    });
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('🗑️ Deleting user from local storage:', userId);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.delete(userId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('✅ User deleted from local storage');
        resolve();
      };
    });
  }
}

export const storageService = new StorageService();