import React, { useState, useEffect } from 'react';
import { autoSyncService } from '../services/autoSyncService';
import { enhancedSyncService } from '../services/enhancedSyncService';
import { realTimeSyncService } from '../services/realTimeSyncService';

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

interface RealTimeStatus {
  enabled: boolean;
  listening: boolean;
  listenersCount: number;
  currentUser: string | null;
  currentGroup: string | null;
}

const AutoSyncStatus: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
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
  });

  const [realTimeStatus, setRealTimeStatus] = useState<RealTimeStatus>({
    enabled: true,
    listening: false,
    listenersCount: 0,
    currentUser: null,
    currentGroup: null
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [lastRealTimeUpdate, setLastRealTimeUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Subscribe to enhanced sync status changes (primary)
    const unsubscribeEnhancedSync = enhancedSyncService.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    // Subscribe to real-time updates
    const unsubscribeRealTime = realTimeSyncService.onRealTimeUpdate('ALL', (updateData) => {
      setLastRealTimeUpdate(new Date());
      console.log('📡 Real-time update received:', updateData);
    });

    // Fallback to auto-sync if enhanced sync fails
    const unsubscribeAutoSync = autoSyncService.onSyncStatusChange((status) => {
      // Only use if enhanced sync is not working
      if (!enhancedSyncService.getSyncStatus().isEnabled) {
        setSyncStatus(status);
      }
    });

    // Get initial statuses
    try {
      setSyncStatus(enhancedSyncService.getSyncStatus());
    } catch (error) {
      console.warn('Enhanced sync not available, falling back to auto-sync');
      setSyncStatus(autoSyncService.getSyncStatus());
    }
    setRealTimeStatus(realTimeSyncService.getConnectionStatus());

    // Update real-time status every 5 seconds
    const statusInterval = setInterval(() => {
      setRealTimeStatus(realTimeSyncService.getConnectionStatus());
    }, 5000);

    return () => {
      unsubscribeEnhancedSync();
      unsubscribeAutoSync();
      unsubscribeRealTime();
      clearInterval(statusInterval);
    };
  }, []);

  const formatLastSync = (lastSync: Date | null): string => {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getSyncStatusIcon = (): string => {
    if (!syncStatus.isEnabled) return '⏸️';
    if (!syncStatus.isOnline) return '📱';
    if (syncStatus.pendingOperations > 0) return '🔄';
    if (syncStatus.errors.length > 0) return '⚠️';
    if (realTimeStatus.listening) return '📡';
    return '✅';
  };

  const getSyncStatusText = (): string => {
    if (!syncStatus.isEnabled) return 'Auto-sync disabled';
    if (!syncStatus.isOnline) return 'Offline - queued for sync';
    if (syncStatus.isBackgroundSyncing) return 'Background sync in progress...';
    if (syncStatus.pendingOperations > 0) return `Syncing ${syncStatus.pendingOperations} items...`;
    if (syncStatus.consecutiveFailures > 3) return `Sync failing (${syncStatus.consecutiveFailures} failures)`;
    if (syncStatus.errors.length > 0) return 'Sync errors detected';
    if (realTimeStatus.listening) return `Real-time sync active (${realTimeStatus.listenersCount} listeners)`;
    return 'All data synced';
  };

  const getSyncStatusColor = (): string => {
    if (!syncStatus.isEnabled) return 'text-gray-500';
    if (!syncStatus.isOnline) return 'text-yellow-500';
    if (syncStatus.consecutiveFailures > 3) return 'text-red-600';
    if (syncStatus.errors.length > 0) return 'text-red-500';
    if (syncStatus.isBackgroundSyncing) return 'text-blue-600';
    if (syncStatus.pendingOperations > 0) return 'text-blue-500';
    return 'text-green-500';
  };

  const handleToggleAutoSync = () => {
    try {
      if (syncStatus.isEnabled) {
        enhancedSyncService.disableAutoSync();
      } else {
        enhancedSyncService.enableAutoSync();
      }
    } catch (error) {
      // Fallback to auto-sync service
      if (syncStatus.isEnabled) {
        autoSyncService.disableAutoSync();
      } else {
        autoSyncService.enableAutoSync();
      }
    }
  };

  const handleForceSync = () => {
    try {
      enhancedSyncService.forceSyncNow();
    } catch (error) {
      // Fallback to auto-sync service
      autoSyncService.forceSyncNow();
    }
  };

  const handleClearErrors = () => {
    try {
      enhancedSyncService.clearSyncErrors();
    } catch (error) {
      console.warn('Enhanced sync not available for error clearing');
    }
  };

  const handleResetSync = () => {
    try {
      enhancedSyncService.resetSyncState();
    } catch (error) {
      console.warn('Enhanced sync not available for reset');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Compact Status Bar */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg">{getSyncStatusIcon()}</span>
          <div>
            <div className={`text-sm font-medium ${getSyncStatusColor()}`}>
              {getSyncStatusText()}
            </div>
            <div className="text-xs text-gray-500">
              Last sync: {formatLastSync(syncStatus.lastSync)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {syncStatus.pendingOperations > 0 && (
            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {syncStatus.pendingOperations}
            </div>
          )}
          <button className="text-gray-400 hover:text-gray-600">
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Sync Progress */}
          {syncStatus.totalOperations > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Sync Progress</span>
                <span>{syncStatus.syncProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncStatus.syncProgress}%` }}
                />
              </div>
            </div>
          )}

                     {/* Status Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Network:</span>
              <div className="flex items-center space-x-2">
                <span className={syncStatus.isOnline ? 'text-green-500' : 'text-red-500'}>
                  {syncStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
            </div>
            
            <div>
              <span className="text-gray-500">Real-time:</span>
              <span className={realTimeStatus.listening ? 'text-green-500' : 'text-gray-500'}>
                {realTimeStatus.listening ? '📡 Live' : '⏸️ Inactive'}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500">Pending:</span>
              <span className="font-medium">{syncStatus.pendingOperations} items</span>
            </div>
            
            <div>
              <span className="text-gray-500">Background:</span>
              <span className={syncStatus.isBackgroundSyncing ? 'text-blue-500' : 'text-gray-500'}>
                {syncStatus.isBackgroundSyncing ? '🔄 Active' : '⏸️ Idle'}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500">Listeners:</span>
              <span className="font-medium">{realTimeStatus.listenersCount}</span>
            </div>
            
            <div>
              <span className="text-gray-500">Failures:</span>
              <span className={syncStatus.consecutiveFailures > 0 ? 'text-red-500 font-medium' : 'text-green-500'}>
                {syncStatus.consecutiveFailures > 0 ? syncStatus.consecutiveFailures : '0'}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500">Auto-sync:</span>
              <span className={syncStatus.isEnabled ? 'text-green-500' : 'text-gray-500'}>
                {syncStatus.isEnabled ? '✅ Enhanced' : '⏸️ Disabled'}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500">Last update:</span>
              <span className="font-medium">
                {lastRealTimeUpdate ? formatLastSync(lastRealTimeUpdate) : 'Never'}
              </span>
            </div>
          </div>

          {/* Error Messages */}
          {(syncStatus.errors.length > 0 || syncStatus.consecutiveFailures > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-red-800 font-medium text-sm">
                  Sync Issues Detected
                </div>
                <button
                  onClick={handleClearErrors}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear Errors
                </button>
              </div>
              
              {syncStatus.consecutiveFailures > 0 && (
                <div className="text-red-700 text-xs mb-2">
                  • {syncStatus.consecutiveFailures} consecutive sync failures
                </div>
              )}
              
              {syncStatus.lastError && (
                <div className="text-red-700 text-xs mb-2">
                  • Latest error: {syncStatus.lastError}
                </div>
              )}
              
              <div className="space-y-1">
                {syncStatus.errors.map((error, index) => (
                  <div key={index} className="text-red-700 text-xs">
                    • {error}
                  </div>
                ))}
              </div>
              
              {syncStatus.consecutiveFailures > 3 && (
                <div className="mt-2">
                  <button
                    onClick={handleResetSync}
                    className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                  >
                    Reset Sync State
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <button
              onClick={handleToggleAutoSync}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                syncStatus.isEnabled
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {syncStatus.isEnabled ? 'Disable Auto-Sync' : 'Enable Auto-Sync'}
            </button>
            
            <button
              onClick={handleForceSync}
              disabled={!syncStatus.isOnline || syncStatus.pendingOperations === 0}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Force Sync Now
            </button>
          </div>

                     {/* Sync Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-blue-800 font-medium text-sm mb-2">
              📡 Real-Time Sync Information
            </div>
            <div className="text-blue-700 text-xs space-y-1">
              <div>• Changes sync instantly across all devices in real-time</div>
              <div>• Live listeners automatically detect and apply updates</div>
              <div>• Conflict resolution ensures data consistency</div>
              <div>• Background backup every 30 seconds for safety</div>
              <div>• Works offline - updates queue for later sync</div>
              <div>• Device ID: {realTimeStatus.currentUser ? realTimeSyncService.getDeviceId().slice(-8) : 'Not authenticated'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoSyncStatus; 