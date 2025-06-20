import React, { useState, useEffect } from 'react';
import { autoSyncService } from '../services/autoSyncService';

interface SyncStatus {
  isEnabled: boolean;
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  totalOperations: number;
  syncProgress: number;
  errors: string[];
}

const AutoSyncStatus: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isEnabled: true,
    isOnline: navigator.onLine,
    lastSync: null,
    pendingOperations: 0,
    totalOperations: 0,
    syncProgress: 0,
    errors: []
  });

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = autoSyncService.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    // Get initial status
    setSyncStatus(autoSyncService.getSyncStatus());

    return unsubscribe;
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
    return '✅';
  };

  const getSyncStatusText = (): string => {
    if (!syncStatus.isEnabled) return 'Auto-sync disabled';
    if (!syncStatus.isOnline) return 'Offline - queued for sync';
    if (syncStatus.pendingOperations > 0) return `Syncing ${syncStatus.pendingOperations} items...`;
    if (syncStatus.errors.length > 0) return 'Sync errors detected';
    return 'All data synced';
  };

  const getSyncStatusColor = (): string => {
    if (!syncStatus.isEnabled) return 'text-gray-500';
    if (!syncStatus.isOnline) return 'text-yellow-500';
    if (syncStatus.pendingOperations > 0) return 'text-blue-500';
    if (syncStatus.errors.length > 0) return 'text-red-500';
    return 'text-green-500';
  };

  const handleToggleAutoSync = () => {
    if (syncStatus.isEnabled) {
      autoSyncService.disableAutoSync();
    } else {
      autoSyncService.enableAutoSync();
    }
  };

  const handleForceSync = () => {
    autoSyncService.forceSyncNow();
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
              <span className="text-gray-500">Status:</span>
              <div className="flex items-center space-x-2">
                <span className={syncStatus.isOnline ? 'text-green-500' : 'text-red-500'}>
                  {syncStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
            </div>
            
            <div>
              <span className="text-gray-500">Auto-sync:</span>
              <span className={syncStatus.isEnabled ? 'text-green-500' : 'text-gray-500'}>
                {syncStatus.isEnabled ? '✅ Enabled' : '⏸️ Disabled'}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500">Pending:</span>
              <span className="font-medium">{syncStatus.pendingOperations} items</span>
            </div>
            
            <div>
              <span className="text-gray-500">Total synced:</span>
              <span className="font-medium">{syncStatus.totalOperations}</span>
            </div>
          </div>

          {/* Error Messages */}
          {syncStatus.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 font-medium text-sm mb-2">
                Sync Errors:
              </div>
              <div className="space-y-1">
                {syncStatus.errors.map((error, index) => (
                  <div key={index} className="text-red-700 text-xs">
                    • {error}
                  </div>
                ))}
              </div>
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
              🔄 Auto-Sync Information
            </div>
            <div className="text-blue-700 text-xs space-y-1">
              <div>• Data automatically syncs to cloud every 30 seconds</div>
              <div>• Works offline - changes queued until connection restored</div>
              <div>• All groups, players, and matches are backed up automatically</div>
              <div>• No manual export/import needed anymore!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoSyncStatus; 