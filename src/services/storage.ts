import { Match, Player } from '../types/cricket';
import { User, Group, Invitation } from '../types/auth';

const DB_NAME = 'CricketScorerDB';
const DB_VERSION = 5; // Increment version for enhanced persistence
const BACKUP_KEY = 'cricket_scorer_backup';
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

class StorageService {
  private db: IDBDatabase | null = null;
  private backupTimer: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
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

        // Handle groups store - recreate if exists to ensure clean state
        if (db.objectStoreNames.contains('groups')) {
          db.deleteObjectStore('groups');
        }
        const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
        groupsStore.createIndex('inviteCode', 'inviteCode', { unique: true });
        groupsStore.createIndex('createdBy', 'createdBy', { unique: false });

        // Handle invitations store - recreate if exists
        if (db.objectStoreNames.contains('invitations')) {
          db.deleteObjectStore('invitations');
        }
        const invitationsStore = db.createObjectStore('invitations', { keyPath: 'id' });
        invitationsStore.createIndex('groupId', 'groupId', { unique: false });
        invitationsStore.createIndex('invitedEmail', 'invitedEmail', { unique: false });

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
      request.onsuccess = () => resolve();
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
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['players'], 'readonly');
      const store = transaction.objectStore('players');
      const index = store.index('groupIds');
      const request = index.getAll(groupId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const players = request.result || [];
        resolve(players);
      };
    });
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
      request.onsuccess = () => resolve();
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
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readonly');
      const store = transaction.objectStore('matches');
      const index = store.index('groupId');
      const request = index.getAll(groupId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const matches = request.result || [];
        resolve(matches);
      };
    });
  }

  async getIncompleteMatch(): Promise<Match | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['matches'], 'readonly');
      const store = transaction.objectStore('matches');
      const index = store.index('isCompleted');
      const request = index.getAll(false);

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
      const request = index.getAll(false);

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
      request.onsuccess = () => resolve();
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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readwrite');
      const store = transaction.objectStore('groups');
      const request = store.put(group);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['groups'], 'readonly');
      const store = transaction.objectStore('groups');
      const index = store.index('inviteCode');
      const request = index.get(inviteCode);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
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
      const backupData = {
        timestamp: Date.now(),
        version: DB_VERSION,
        data: {
          users: await this.getAllUsers(),
          groups: await this.getAllGroups(),
          players: await this.getAllPlayers(),
          matches: await this.getAllMatches(),
          settings: await this.getAllSettings()
        }
      };

      // Store in localStorage as primary backup
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backupData));
      
      // Also store in sessionStorage as secondary backup
      sessionStorage.setItem(BACKUP_KEY, JSON.stringify(backupData));
      
      // Store multiple backup versions
      const backupHistory = this.getBackupHistory();
      backupHistory.push({
        timestamp: Date.now(),
        size: JSON.stringify(backupData).length
      });
      
      // Keep only last 10 backups
      if (backupHistory.length > 10) {
        backupHistory.splice(0, backupHistory.length - 10);
      }
      
      localStorage.setItem(`${BACKUP_KEY}_history`, JSON.stringify(backupHistory));
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
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
}

export const storageService = new StorageService();