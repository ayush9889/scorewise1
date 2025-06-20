import { storageService } from './storage';
import { cloudStorageService } from './cloudStorageService';
import { realTimeSyncService } from './realTimeSyncService';
import { rigidGroupManager } from './rigidGroupManager';
import { auth } from '../config/firebase';
import { User, Group } from '../types/auth';
import { Player, Match } from '../types/cricket';

// Enhanced Sync Quota Error Handling Utilities
class EnhancedSyncQuotaHandler {
  static clearFirebaseCache(): void {
    console.log('🧹 Enhanced Sync: Clearing Firebase cache to resolve quota issues...');
    
    let clearedKeys = 0;
    const keysToRemove: string[] = [];
    
    // Find all Firebase-related keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('firebase') || 
        key.includes('firestore') ||
        key.includes('mutation') ||
        key.includes('pending') ||
        key.includes('_5643_') ||  // Specific mutation ID from error
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
        clearedKeys++;
      } catch (error) {
        console.warn('⚠️ Enhanced Sync: Failed to remove cache key:', key);
      }
    });
    
    console.log(`✅ Enhanced Sync: Cleared ${clearedKeys} Firebase cache entries`);
  }

  static isQuotaExceededError(error: any): boolean {
    if (!error) return false;
    
    const errorString = error.toString().toLowerCase();
    const errorMessage = error.message?.toLowerCase() || '';
    
    return (
      errorString.includes('quotaexceedederror') ||
      errorString.includes('quota') ||
      errorString.includes('storage full') ||
      errorMessage.includes('quotaexceedederror') ||
      errorMessage.includes('exceeded the quota') ||
      errorMessage.includes('setitem') ||
      (error.code && error.code.includes('quota')) ||
      (error.name && error.name.includes('QuotaExceededError'))
    );
  }

  static async handleQuotaError(operation: string, error: any): Promise<void> {
    console.error(`❌ Enhanced Sync: Quota exceeded during ${operation}`);
    console.error('Full error:', error);
    
    // Clear Firebase cache immediately
    this.clearFirebaseCache();
    
    // Show user-friendly guidance
    console.log(`
🚨 Enhanced Sync Quota Error Recovery
─────────────────────────────────────
Operation: ${operation}
Status: Firebase storage quota exceeded
Action: Automatically cleared Firebase cache
Next: Please retry the operation

If the problem persists:
1. Clear browser storage manually
2. Refresh the page
3. Try the operation again
    `);
    
    // Wait a moment for cache clearing to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

interface SyncStatus {
  isEnabled: boolean;
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  totalOperations: number;
  syncProgress: number;
  errors: string[];
  lastError: string | null;
  consecutiveFailures: number;
  isBackgroundSyncing: boolean;
}

interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'DOWNLOAD';
  entity: 'USER' | 'GROUP' | 'PLAYER' | 'MATCH' | 'ALL';
  data: any;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  source: 'LOCAL' | 'REMOTE' | 'CONFLICT_RESOLUTION';
}

interface DataConsistencyCheck {
  entity: string;
  localCount: number;
  cloudCount: number;
  lastChecked: Date;
  inconsistencies: string[];
}

class EnhancedSyncService {
  private static readonly SYNC_INTERVAL = 15 * 1000; // 15 seconds
  private static readonly BATCH_SIZE = 5; // Smaller batches for reliability
  private static readonly MAX_RETRY_ATTEMPTS = 5;
  private static readonly OFFLINE_QUEUE_KEY = 'enhanced_sync_queue';
  private static readonly SYNC_STATUS_KEY = 'enhanced_sync_status';
  private static readonly CONSISTENCY_CHECK_KEY = 'consistency_check';
  private static readonly BACKGROUND_SYNC_INTERVAL = 30 * 1000; // 30 seconds
  
  private syncTimer: NodeJS.Timeout | null = null;
  private backgroundSyncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private isBackgroundSyncing = false;
  private isEnabled = true;
  private offlineQueue: SyncOperation[] = [];
  private currentStatus: SyncStatus;
  private syncListeners: ((status: SyncStatus) => void)[] = [];
  private consistencyChecks: Map<string, DataConsistencyCheck> = new Map();
  
  // Retry configuration
  private retryDelays = [1000, 3000, 5000, 10000, 20000]; // Progressive delays
  
  constructor() {
    this.currentStatus = {
      isEnabled: true,
      isOnline: navigator.onLine,
      lastSync: null,
      pendingOperations: 0,
      totalOperations: 0,
      syncProgress: 0,
      errors: [],
      lastError: null,
      consecutiveFailures: 0,
      isBackgroundSyncing: false
    };

    this.init();
  }

  private async init(): Promise<void> {
    console.log('🔄 Initializing Enhanced Sync Service...');
    
    // Restore state
    await this.restoreState();
    
    // Setup network monitoring
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    
    // Start sync services
    this.startAutoSync();
    this.startBackgroundSync();
    this.startConsistencyChecking();
    
    // Monitor auth state
    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('🔄 User authenticated, starting comprehensive sync...');
        this.queueComprehensiveSync();
      } else {
        console.log('🔄 User signed out, stopping sync...');
        this.stopAllSync();
      }
    });

    console.log('✅ Enhanced Sync Service initialized');
  }

  // PUBLIC API

  enableAutoSync(): void {
    console.log('🔄 Enabling enhanced auto-sync');
    this.isEnabled = true;
    this.startAutoSync();
    this.startBackgroundSync();
    this.updateStatus({ isEnabled: true });
  }

  disableAutoSync(): void {
    console.log('🔄 Disabling enhanced auto-sync');
    this.isEnabled = false;
    this.stopAutoSync();
    this.stopBackgroundSync();
    this.updateStatus({ isEnabled: false });
  }

  async forceSyncNow(): Promise<boolean> {
    console.log('🔄 Force sync requested');
    try {
      await this.performSync(true);
      return true;
    } catch (error) {
      console.error('❌ Force sync failed:', error);
      return false;
    }
  }

  getSyncStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  // QUEUE MANAGEMENT

  queueSyncOperation(
    type: SyncOperation['type'],
    entity: SyncOperation['entity'],
    data: any,
    priority: SyncOperation['priority'] = 'NORMAL'
  ): void {
    const operation: SyncOperation = {
      id: `${entity}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entity,
      data: JSON.parse(JSON.stringify(data)), // Deep clone to prevent references
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: EnhancedSyncService.MAX_RETRY_ATTEMPTS,
      priority,
      source: 'LOCAL'
    };

    // Check for duplicate operations and remove older ones
    this.offlineQueue = this.offlineQueue.filter(op => 
      !(op.entity === entity && op.type === type && 
        JSON.stringify(op.data) === JSON.stringify(operation.data))
    );

    this.offlineQueue.push(operation);
    this.prioritizeQueue();
    this.saveState();
    
    console.log(`🔄 Queued ${priority} priority ${type} operation for ${entity}:`, operation.id);
    
    this.updateStatus({ 
      pendingOperations: this.offlineQueue.length,
      totalOperations: this.currentStatus.totalOperations + 1
    });

    // Try immediate sync for high priority operations
    if (priority === 'HIGH' && this.currentStatus.isOnline && this.isEnabled) {
      setTimeout(() => this.performSync(false), 100);
    }
  }

  private prioritizeQueue(): void {
    this.offlineQueue.sort((a, b) => {
      // Priority order: HIGH > NORMAL > LOW
      const priorityOrder = { HIGH: 3, NORMAL: 2, LOW: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      // Then by timestamp (newer first for same priority)
      return b.timestamp - a.timestamp;
    });
  }

  queueComprehensiveSync(): void {
    console.log('🔄 Queueing comprehensive sync...');
    this.queueSyncOperation('DOWNLOAD', 'ALL', {}, 'HIGH');
  }

  // AUTO-SYNC METHODS

  async autoSyncUser(user: User): Promise<void> {
    this.queueSyncOperation('UPDATE', 'USER', user, 'HIGH');
  }

  async autoSyncGroup(group: Group): Promise<void> {
    this.queueSyncOperation('UPDATE', 'GROUP', group, 'HIGH');
  }

  async autoSyncPlayer(player: Player): Promise<void> {
    this.queueSyncOperation('UPDATE', 'PLAYER', player, 'NORMAL');
  }

  async autoSyncMatch(match: Match): Promise<void> {
    this.queueSyncOperation('UPDATE', 'MATCH', match, 'HIGH');
  }

  async autoSyncGroupDeletion(groupId: string): Promise<void> {
    this.queueSyncOperation('DELETE', 'GROUP', { id: groupId }, 'HIGH');
  }

  async autoSyncPlayerDeletion(playerId: string): Promise<void> {
    this.queueSyncOperation('DELETE', 'PLAYER', { id: playerId }, 'NORMAL');
  }

  async autoSyncMatchDeletion(matchId: string): Promise<void> {
    this.queueSyncOperation('DELETE', 'MATCH', { id: matchId }, 'HIGH');
  }

  // SYNC EXECUTION

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (this.isEnabled && this.currentStatus.isOnline) {
        await this.performSync(false);
      }
    }, EnhancedSyncService.SYNC_INTERVAL);

    console.log(`🔄 Auto-sync started with ${EnhancedSyncService.SYNC_INTERVAL}ms interval`);
  }

  private startBackgroundSync(): void {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
    }

    this.backgroundSyncTimer = setInterval(async () => {
      if (this.isEnabled && this.currentStatus.isOnline && !this.isSyncing) {
        await this.performBackgroundSync();
      }
    }, EnhancedSyncService.BACKGROUND_SYNC_INTERVAL);

    console.log(`🔄 Background sync started with ${EnhancedSyncService.BACKGROUND_SYNC_INTERVAL}ms interval`);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private stopBackgroundSync(): void {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
      this.backgroundSyncTimer = null;
    }
  }

  private stopAllSync(): void {
    this.stopAutoSync();
    this.stopBackgroundSync();
  }

  private async performSync(isForced: boolean): Promise<void> {
    if (this.isSyncing && !isForced) {
      return;
    }

    if (!this.isEnabled || this.offlineQueue.length === 0) {
      return;
    }

    if (!this.currentStatus.isOnline) {
      console.log('📱 Offline - skipping sync');
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();
    console.log(`🔄 Starting sync of ${this.offlineQueue.length} operations${isForced ? ' (forced)' : ''}`);

    try {
      const batch = this.offlineQueue.slice(0, EnhancedSyncService.BATCH_SIZE);
      const processedIds: string[] = [];
      const errors: string[] = [];
      let successCount = 0;

      for (const operation of batch) {
        try {
          await this.executeSyncOperation(operation);
          processedIds.push(operation.id);
          successCount++;
          console.log(`✅ Synced ${operation.entity} ${operation.type}: ${operation.id}`);
          
          // Small delay between operations to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          await this.handleSyncError(operation, error);
          
          if (operation.attempts >= operation.maxAttempts) {
            processedIds.push(operation.id);
            const errorMsg = `Failed to sync ${operation.entity} ${operation.type} after ${operation.attempts} attempts: ${error.message}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        }
      }

      // Remove processed operations
      this.offlineQueue = this.offlineQueue.filter(op => !processedIds.includes(op.id));
      await this.saveState();

      // Update status
      const now = new Date();
      this.updateStatus({
        lastSync: now,
        pendingOperations: this.offlineQueue.length,
        syncProgress: this.calculateSyncProgress(),
        errors: errors.length > 0 ? errors : [],
        lastError: errors.length > 0 ? errors[0] : null,
        consecutiveFailures: errors.length > 0 ? this.currentStatus.consecutiveFailures + 1 : 0
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed in ${duration}ms. ${successCount} operations processed, ${this.offlineQueue.length} remaining`);

    } catch (error) {
      console.error('❌ Sync batch failed:', error);
      this.updateStatus({
        errors: [`Sync batch failed: ${error.message}`],
        lastError: error.message,
        consecutiveFailures: this.currentStatus.consecutiveFailures + 1
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async performBackgroundSync(): Promise<void> {
    if (this.isBackgroundSyncing) return;

    this.isBackgroundSyncing = true;
    this.updateStatus({ isBackgroundSyncing: true });

    try {
      console.log('🔄 Starting background consistency sync...');
      
      // Download latest data from cloud
      await this.downloadAndMergeCloudData();
      
      // Run consistency checks
      await this.runDataConsistencyCheck();
      
      console.log('✅ Background sync completed');
      
    } catch (error) {
      console.error('❌ Background sync failed:', error);
    } finally {
      this.isBackgroundSyncing = false;
      this.updateStatus({ isBackgroundSyncing: false });
    }
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    const { type, entity, data } = operation;

    try {
      switch (entity) {
        case 'ALL':
          if (type === 'DOWNLOAD') {
            await this.downloadAndMergeCloudData();
          }
          break;

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
    } catch (error) {
      // Check for quota exceeded errors and handle them specifically
      if (EnhancedSyncQuotaHandler.isQuotaExceededError(error)) {
        console.log('🚨 Enhanced Sync: Quota exceeded error detected');
        await EnhancedSyncQuotaHandler.handleQuotaError(`${entity} ${type}`, error);
        
        // After clearing cache, retry the operation once
        try {
          console.log('🔄 Enhanced Sync: Retrying operation after quota cleanup...');
          
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
          }
          
          console.log('✅ Enhanced Sync: Operation succeeded after quota cleanup');
          return; // Success after retry
          
        } catch (retryError) {
          console.error('❌ Enhanced Sync: Operation failed even after quota cleanup:', retryError);
          throw new Error(`Enhanced Sync quota error: ${entity} ${type} failed. Cache cleared but operation still failed. Please refresh the page and try again.`);
        }
      }
      
      // Add more context to non-quota errors
      throw new Error(`Enhanced Sync operation failed for ${entity} ${type}: ${error.message}`);
    }
  }

  private async handleSyncError(operation: SyncOperation, error: any): Promise<void> {
    operation.attempts++;
    
    if (operation.attempts < operation.maxAttempts) {
      // Calculate retry delay with exponential backoff
      const delayIndex = Math.min(operation.attempts - 1, this.retryDelays.length - 1);
      const delay = this.retryDelays[delayIndex];
      
      console.warn(`⚠️ Sync attempt ${operation.attempts}/${operation.maxAttempts} failed for ${operation.id}, retrying in ${delay}ms:`, error.message);
      
      // Schedule retry
      setTimeout(() => {
        if (this.currentStatus.isOnline && this.isEnabled) {
          this.performSync(false);
        }
      }, delay);
    }
  }

  // DATA CONSISTENCY

  private async downloadAndMergeCloudData(): Promise<void> {
    try {
      console.log('☁️ Downloading and merging cloud data...');
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('❌ No authenticated user for cloud download');
        return;
      }

      // Download user profile
      try {
        const userProfile = await cloudStorageService.getUserProfile();
        if (userProfile) {
          const localUser = await storageService.getUser(userProfile.id);
          const mergedUser = this.mergeData(localUser, userProfile, 'USER');
          await storageService.saveUser(mergedUser);
        }
      } catch (error) {
        console.warn('⚠️ Failed to download user profile:', error.message);
      }

      // Download groups
      try {
        const cloudGroups = await cloudStorageService.getUserGroups();
        for (const cloudGroup of cloudGroups) {
          if (!rigidGroupManager.isGroupDeleted(cloudGroup.id)) {
            const localGroup = await storageService.getGroup(cloudGroup.id);
            const mergedGroup = this.mergeData(localGroup, cloudGroup, 'GROUP');
            await storageService.saveGroup(mergedGroup);
            rigidGroupManager.setGroupVisibility(cloudGroup.id, true);
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to download groups:', error.message);
      }

      // Download matches
      try {
        const cloudMatches = await cloudStorageService.getUserMatches();
        for (const cloudMatch of cloudMatches) {
          const localMatch = await storageService.getMatch(cloudMatch.id);
          const mergedMatch = this.mergeData(localMatch, cloudMatch, 'MATCH');
          await storageService.saveMatch(mergedMatch);
        }
      } catch (error) {
        console.warn('⚠️ Failed to download matches:', error.message);
      }

      // Download players for current groups
      try {
        const userGroups = await storageService.getAllGroups();
        for (const group of userGroups) {
          if (!rigidGroupManager.isGroupDeleted(group.id)) {
            const cloudPlayers = await cloudStorageService.getGroupPlayers(group.id);
            for (const cloudPlayer of cloudPlayers) {
              const localPlayer = await storageService.getPlayer(cloudPlayer.id);
              const mergedPlayer = this.mergeData(localPlayer, cloudPlayer, 'PLAYER');
              await storageService.savePlayer(mergedPlayer);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to download players:', error.message);
      }

      console.log('✅ Cloud data download and merge completed');
      
    } catch (error) {
      console.error('❌ Cloud data download failed:', error);
      throw error;
    }
  }

  private mergeData(local: any, remote: any, entity: string): any {
    if (!local) return remote;
    if (!remote) return local;

    const localTimestamp = local.lastModified || local.updatedAt || 0;
    const remoteTimestamp = remote.lastModified || remote.updatedAt || 0;

    // If timestamps are very close (within 10 seconds), prefer local for better UX
    if (Math.abs(localTimestamp - remoteTimestamp) < 10000) {
      console.log(`🔄 Preferring local ${entity} due to close timestamps`);
      return { 
        ...remote, 
        ...local, 
        lastModified: Date.now(),
        mergedAt: Date.now(),
        source: 'MERGED_LOCAL_PREFERRED'
      };
    }

    // Use most recent data
    if (remoteTimestamp > localTimestamp) {
      console.log(`🔄 Using remote ${entity} (newer timestamp)`);
      return { 
        ...remote, 
        mergedAt: Date.now(),
        source: 'REMOTE'
      };
    } else {
      console.log(`🔄 Using local ${entity} (newer timestamp)`);
      return { 
        ...local, 
        lastModified: Date.now(),
        mergedAt: Date.now(),
        source: 'LOCAL'
      };
    }
  }

  private async runDataConsistencyCheck(): Promise<void> {
    try {
      console.log('🔍 Running data consistency check...');
      
      const [localUsers, localGroups, localPlayers, localMatches] = await Promise.all([
        storageService.getAllUsers(),
        storageService.getAllGroups(),
        storageService.getAllPlayers(),
        storageService.getAllMatches()
      ]);

      // Save consistency check results
      const check: DataConsistencyCheck = {
        entity: 'ALL',
        localCount: localUsers.length + localGroups.length + localPlayers.length + localMatches.length,
        cloudCount: 0, // We'll update this as we get cloud data
        lastChecked: new Date(),
        inconsistencies: []
      };

      this.consistencyChecks.set('ALL', check);
      this.saveConsistencyChecks();
      
      console.log(`🔍 Consistency check completed: ${check.localCount} local items`);
      
    } catch (error) {
      console.error('❌ Consistency check failed:', error);
    }
  }

  private startConsistencyChecking(): void {
    // Run consistency check every 5 minutes
    setInterval(() => {
      if (this.isEnabled && this.currentStatus.isOnline) {
        this.runDataConsistencyCheck();
      }
    }, 5 * 60 * 1000);
  }

  // UTILITIES

  private handleNetworkChange(isOnline: boolean): void {
    console.log(`📡 Network status changed: ${isOnline ? 'Online' : 'Offline'}`);
    
    this.updateStatus({ isOnline });

    if (isOnline && this.isEnabled) {
      // Back online - start syncing after delay to ensure connection is stable
      setTimeout(() => {
        this.performSync(false);
        this.queueComprehensiveSync(); // Full sync after coming back online
      }, 2000);
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

    this.saveState();
  }

  // PERSISTENCE

  private async restoreState(): Promise<void> {
    try {
      // Restore offline queue
      const queueData = localStorage.getItem(EnhancedSyncService.OFFLINE_QUEUE_KEY);
      if (queueData) {
        this.offlineQueue = JSON.parse(queueData);
        console.log(`🔄 Restored ${this.offlineQueue.length} operations from offline queue`);
      }

      // Restore sync status
      const statusData = localStorage.getItem(EnhancedSyncService.SYNC_STATUS_KEY);
      if (statusData) {
        const savedStatus = JSON.parse(statusData);
        this.currentStatus = {
          ...this.currentStatus,
          ...savedStatus,
          isOnline: navigator.onLine, // Always check current online status
          pendingOperations: this.offlineQueue.length,
          lastSync: savedStatus.lastSync ? new Date(savedStatus.lastSync) : null
        };
      }

      // Restore consistency checks
      const consistencyData = localStorage.getItem(EnhancedSyncService.CONSISTENCY_CHECK_KEY);
      if (consistencyData) {
        const checksArray = JSON.parse(consistencyData);
        this.consistencyChecks = new Map(checksArray);
      }

    } catch (error) {
      console.error('❌ Failed to restore sync state:', error);
      this.offlineQueue = [];
      this.consistencyChecks = new Map();
    }
  }

  private async saveState(): Promise<void> {
    try {
      // Save offline queue
      localStorage.setItem(
        EnhancedSyncService.OFFLINE_QUEUE_KEY,
        JSON.stringify(this.offlineQueue)
      );

      // Save sync status
      const statusToSave = {
        ...this.currentStatus,
        lastSync: this.currentStatus.lastSync?.toISOString() || null
      };
      localStorage.setItem(
        EnhancedSyncService.SYNC_STATUS_KEY,
        JSON.stringify(statusToSave)
      );

    } catch (error) {
      console.error('❌ Failed to save sync state:', error);
    }
  }

  private saveConsistencyChecks(): void {
    try {
      const checksArray = Array.from(this.consistencyChecks.entries());
      localStorage.setItem(
        EnhancedSyncService.CONSISTENCY_CHECK_KEY,
        JSON.stringify(checksArray)
      );
    } catch (error) {
      console.error('❌ Failed to save consistency checks:', error);
    }
  }

  // PUBLIC STATUS METHODS

  getConsistencyStatus(): DataConsistencyCheck[] {
    return Array.from(this.consistencyChecks.values());
  }

  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  clearSyncErrors(): void {
    this.updateStatus({ 
      errors: [], 
      lastError: null, 
      consecutiveFailures: 0 
    });
  }

  async resetSyncState(): Promise<void> {
    console.log('🔄 Resetting sync state...');
    
    this.offlineQueue = [];
    this.consistencyChecks.clear();
    this.updateStatus({
      lastSync: null,
      pendingOperations: 0,
      totalOperations: 0,
      syncProgress: 0,
      errors: [],
      lastError: null,
      consecutiveFailures: 0
    });
    
    // Clear storage
    localStorage.removeItem(EnhancedSyncService.OFFLINE_QUEUE_KEY);
    localStorage.removeItem(EnhancedSyncService.SYNC_STATUS_KEY);
    localStorage.removeItem(EnhancedSyncService.CONSISTENCY_CHECK_KEY);
    
    // Queue comprehensive sync
    this.queueComprehensiveSync();
    
    console.log('✅ Sync state reset completed');
  }
}

export const enhancedSyncService = new EnhancedSyncService(); 