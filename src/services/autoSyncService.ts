import { storageService } from './storage';
import { cloudStorageService } from './cloudStorageService';
import { rigidGroupManager } from './rigidGroupManager';
import { auth } from '../config/firebase';
import { User, Group, Player, Match } from '../types/cricket';

interface SyncStatus {
  isEnabled: boolean;
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  totalOperations: number;
  syncProgress: number;
  errors: string[];
}

interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'USER' | 'GROUP' | 'PLAYER' | 'MATCH';
  data: any;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

class AutoSyncService {
  private static readonly SYNC_INTERVAL = 30 * 1000; // 30 seconds
  private static readonly BATCH_SIZE = 10; // Sync 10 items at a time
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly OFFLINE_QUEUE_KEY = 'auto_sync_queue';
  private static readonly SYNC_STATUS_KEY = 'auto_sync_status';
  
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private isEnabled = true;
  private offlineQueue: SyncOperation[] = [];
  private currentStatus: SyncStatus;
  private syncListeners: ((status: SyncStatus) => void)[] = [];

  constructor() {
    this.currentStatus = {
      isEnabled: true,
      isOnline: navigator.onLine,
      lastSync: null,
      pendingOperations: 0,
      totalOperations: 0,
      syncProgress: 0,
      errors: []
    };

    this.init();
  }

  private async init(): Promise<void> {
    console.log('🔄 Initializing Auto-Sync Service...');

    // Restore offline queue
    await this.restoreOfflineQueue();

    // Monitor network status
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Monitor auth state
    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('🔄 User authenticated, starting auto-sync');
        this.startAutoSync();
      } else {
        console.log('🔄 User signed out, stopping auto-sync');
        this.stopAutoSync();
      }
    });

    // Start sync if user is already authenticated
    if (auth.currentUser) {
      this.startAutoSync();
    }

    console.log('✅ Auto-Sync Service initialized');
  }

  // PUBLIC API

  /**
   * Enable automatic synchronization
   */
  enableAutoSync(): void {
    console.log('🔄 Enabling auto-sync');
    this.isEnabled = true;
    this.updateStatus({ isEnabled: true });
    this.startAutoSync();
  }

  /**
   * Disable automatic synchronization
   */
  disableAutoSync(): void {
    console.log('🔄 Disabling auto-sync');
    this.isEnabled = false;
    this.updateStatus({ isEnabled: false });
    this.stopAutoSync();
  }

  /**
   * Force an immediate sync
   */
  async forceSyncNow(): Promise<void> {
    console.log('🔄 Force sync requested');
    await this.performSync();
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  /**
   * Subscribe to sync status changes
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Queue a sync operation for later execution
   */
  queueSyncOperation(
    type: SyncOperation['type'],
    entity: SyncOperation['entity'],
    data: any
  ): void {
    const operation: SyncOperation = {
      id: `${entity}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entity,
      data,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: AutoSyncService.MAX_RETRY_ATTEMPTS
    };

    this.offlineQueue.push(operation);
    this.saveOfflineQueue();
    
    console.log(`🔄 Queued ${type} operation for ${entity}:`, operation.id);
    
    this.updateStatus({ 
      pendingOperations: this.offlineQueue.length,
      totalOperations: this.currentStatus.totalOperations + 1
    });

    // Try to sync immediately if online
    if (this.currentStatus.isOnline && this.isEnabled) {
      this.performSync();
    }
  }

  // AUTOMATIC SYNC OPERATIONS

  /**
   * Auto-sync user profile changes
   */
  async autoSyncUser(user: User): Promise<void> {
    this.queueSyncOperation('UPDATE', 'USER', user);
  }

  /**
   * Auto-sync group changes
   */
  async autoSyncGroup(group: Group): Promise<void> {
    this.queueSyncOperation('UPDATE', 'GROUP', group);
  }

  /**
   * Auto-sync player changes
   */
  async autoSyncPlayer(player: Player): Promise<void> {
    this.queueSyncOperation('UPDATE', 'PLAYER', player);
  }

  /**
   * Auto-sync match changes
   */
  async autoSyncMatch(match: Match): Promise<void> {
    this.queueSyncOperation('UPDATE', 'MATCH', match);
  }

  /**
   * Auto-sync group deletion
   */
  async autoSyncGroupDeletion(groupId: string): Promise<void> {
    this.queueSyncOperation('DELETE', 'GROUP', { id: groupId });
  }

  /**
   * Auto-sync player deletion
   */
  async autoSyncPlayerDeletion(playerId: string): Promise<void> {
    this.queueSyncOperation('DELETE', 'PLAYER', { id: playerId });
  }

  /**
   * Auto-sync match deletion
   */
  async autoSyncMatchDeletion(matchId: string): Promise<void> {
    this.queueSyncOperation('DELETE', 'MATCH', { id: matchId });
  }

  // PRIVATE METHODS

  private startAutoSync(): void {
    if (!this.isEnabled || this.syncTimer) return;

    console.log('🔄 Starting auto-sync timer');
    this.syncTimer = setInterval(() => {
      this.performSync();
    }, AutoSyncService.SYNC_INTERVAL);

    // Perform initial sync
    this.performSync();
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      console.log('🔄 Stopping auto-sync timer');
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async performSync(): Promise<void> {
    if (this.isSyncing || !this.isEnabled || this.offlineQueue.length === 0) {
      return;
    }

    if (!this.currentStatus.isOnline) {
      console.log('📱 Offline - skipping sync');
      return;
    }

    this.isSyncing = true;
    console.log(`🔄 Starting sync of ${this.offlineQueue.length} operations`);

    try {
      // Process operations in batches
      const batch = this.offlineQueue.slice(0, AutoSyncService.BATCH_SIZE);
      const processedIds: string[] = [];
      const errors: string[] = [];

      for (const operation of batch) {
        try {
          await this.executeSyncOperation(operation);
          processedIds.push(operation.id);
          console.log(`✅ Synced ${operation.entity} ${operation.type}: ${operation.id}`);
        } catch (error) {
          operation.attempts++;
          
          if (operation.attempts >= operation.maxAttempts) {
            // Max attempts reached - remove from queue and log error
            processedIds.push(operation.id);
            const errorMsg = `Failed to sync ${operation.entity} ${operation.type} after ${operation.attempts} attempts`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}:`, error);
          } else {
            console.warn(`⚠️ Sync attempt ${operation.attempts}/${operation.maxAttempts} failed for ${operation.id}:`, error);
          }
        }
      }

      // Remove processed operations from queue
      this.offlineQueue = this.offlineQueue.filter(op => !processedIds.includes(op.id));
      await this.saveOfflineQueue();

      // Update sync status
      const now = new Date();
      this.updateStatus({
        lastSync: now,
        pendingOperations: this.offlineQueue.length,
        syncProgress: this.calculateSyncProgress(),
        errors: errors.length > 0 ? errors : []
      });

      console.log(`✅ Sync completed. ${processedIds.length} operations processed, ${this.offlineQueue.length} remaining`);

    } catch (error) {
      console.error('❌ Sync batch failed:', error);
      this.updateStatus({
        errors: [`Sync batch failed: ${error}`]
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    const { type, entity, data } = operation;

    switch (entity) {
      case 'USER':
        if (type === 'UPDATE') {
          await cloudStorageService.saveUserProfile(data);
        }
        break;

      case 'GROUP':
        if (type === 'UPDATE') {
          await cloudStorageService.saveGroup(data);
        } else if (type === 'DELETE') {
          await cloudStorageService.deleteGroup(data.id);
        }
        break;

      case 'PLAYER':
        if (type === 'UPDATE') {
          await cloudStorageService.savePlayer(data);
        } else if (type === 'DELETE') {
          await cloudStorageService.deletePlayer(data.id);
        }
        break;

      case 'MATCH':
        if (type === 'UPDATE') {
          await cloudStorageService.saveMatch(data);
        } else if (type === 'DELETE') {
          await cloudStorageService.deleteMatch(data.id);
        }
        break;

      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }
  }

  private handleNetworkChange(isOnline: boolean): void {
    console.log(`📡 Network status changed: ${isOnline ? 'Online' : 'Offline'}`);
    
    this.updateStatus({ isOnline });

    if (isOnline && this.isEnabled) {
      // Back online - start syncing
      setTimeout(() => this.performSync(), 1000); // Delay to ensure connection is stable
    }
  }

  private calculateSyncProgress(): number {
    if (this.currentStatus.totalOperations === 0) return 100;
    
    const completed = this.currentStatus.totalOperations - this.offlineQueue.length;
    return Math.round((completed / this.currentStatus.totalOperations) * 100);
  }

  private updateStatus(updates: Partial<SyncStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...updates };
    
    // Notify listeners
    this.syncListeners.forEach(listener => {
      try {
        listener(this.getSyncStatus());
      } catch (error) {
        console.error('❌ Sync status listener error:', error);
      }
    });

    // Save status to storage
    this.saveSyncStatus();
  }

  private async restoreOfflineQueue(): Promise<void> {
    try {
      const queueData = localStorage.getItem(AutoSyncService.OFFLINE_QUEUE_KEY);
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
        console.log(`🔄 Restored ${this.offlineQueue.length} operations from offline queue`);
      }

      const statusData = localStorage.getItem(AutoSyncService.SYNC_STATUS_KEY);
      if (statusData) {
        const savedStatus = JSON.parse(statusData);
        this.currentStatus = {
          ...this.currentStatus,
          ...savedStatus,
          isOnline: navigator.onLine, // Always check current online status
          pendingOperations: this.offlineQueue.length
        };
      }
    } catch (error) {
      console.error('❌ Failed to restore offline queue:', error);
      this.offlineQueue = [];
    }
  }

  private async saveOfflineQueue(): Promise<void> {
    try {
      localStorage.setItem(
        AutoSyncService.OFFLINE_QUEUE_KEY,
        JSON.stringify(this.offlineQueue)
      );
    } catch (error) {
      console.error('❌ Failed to save offline queue:', error);
    }
  }

  private async saveSyncStatus(): Promise<void> {
    try {
      const statusToSave = {
        ...this.currentStatus,
        lastSync: this.currentStatus.lastSync?.toISOString() || null
      };
      
      localStorage.setItem(
        AutoSyncService.SYNC_STATUS_KEY,
        JSON.stringify(statusToSave)
      );
    } catch (error) {
      console.error('❌ Failed to save sync status:', error);
    }
  }

  // COMPREHENSIVE DATA SYNC

  /**
   * Perform a comprehensive sync of all user data
   */
  async performComprehensiveSync(): Promise<void> {
    console.log('🔄 Starting comprehensive data sync...');

    try {
      // Get all local data
      const [users, groups, players, matches] = await Promise.all([
        storageService.getAllUsers(),
        storageService.getAllGroups(),
        storageService.getAllPlayers(),
        storageService.getAllMatches()
      ]);

      // Queue all data for sync
      users.forEach(user => this.queueSyncOperation('UPDATE', 'USER', user));
      groups.forEach(group => {
        if (!rigidGroupManager.isGroupDeleted(group.id)) {
          this.queueSyncOperation('UPDATE', 'GROUP', group);
        }
      });
      players.forEach(player => this.queueSyncOperation('UPDATE', 'PLAYER', player));
      matches.forEach(match => this.queueSyncOperation('UPDATE', 'MATCH', match));

      console.log(`🔄 Queued comprehensive sync of ${users.length} users, ${groups.length} groups, ${players.length} players, ${matches.length} matches`);

      // Start immediate sync
      await this.performSync();

    } catch (error) {
      console.error('❌ Comprehensive sync failed:', error);
      throw error;
    }
  }

  /**
   * Download all data from cloud and update local storage
   */
  async downloadFromCloud(): Promise<void> {
    console.log('☁️ Downloading all data from cloud...');

    try {
      // Get current user profile
      const userProfile = await cloudStorageService.getUserProfile();
      if (userProfile) {
        await storageService.saveUserProfile(userProfile);
      }

      // Get user groups
      const cloudGroups = await cloudStorageService.getUserGroups();
      for (const group of cloudGroups) {
        if (!rigidGroupManager.isGroupDeleted(group.id)) {
          await storageService.saveGroup(group);
          rigidGroupManager.setGroupVisibility(group.id, true);
        }
      }

      // Get all matches
      const cloudMatches = await cloudStorageService.getUserMatches();
      for (const match of cloudMatches) {
        await storageService.saveMatch(match);
      }

      // Get players for each group
      for (const group of cloudGroups) {
        if (!rigidGroupManager.isGroupDeleted(group.id)) {
          const groupPlayers = await cloudStorageService.getGroupPlayers(group.id);
          for (const player of groupPlayers) {
            await storageService.savePlayer(player);
          }
        }
      }

      console.log(`✅ Downloaded and saved ${cloudGroups.length} groups, ${cloudMatches.length} matches from cloud`);

    } catch (error) {
      console.error('❌ Download from cloud failed:', error);
      throw error;
    }
  }
}

export const autoSyncService = new AutoSyncService(); 