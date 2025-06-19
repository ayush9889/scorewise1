import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Smartphone, Laptop, Bug } from 'lucide-react';
import { userCloudSyncService } from '../services/userCloudSyncService';
import { authService } from '../services/authService';
import { DebugCloudSync } from '../services/debugCloudSync';

interface CloudSyncStatusProps {
  className?: string;
}

export const CloudSyncStatus: React.FC<CloudSyncStatusProps> = ({ className = '' }) => {
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime?: Date;
    cloudDataCount: { groups: number; matches: number; players: number };
    isOnline: boolean;
  }>({ cloudDataCount: { groups: 0, matches: 0, players: 0 }, isOnline: false });
  
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [debugResult, setDebugResult] = useState<string | null>(null);

  useEffect(() => {
    loadSyncStatus();
    
    // Listen for data sync events
    const handleDataSynced = () => {
      loadSyncStatus();
      setLastSyncResult('Data synced successfully across devices!');
      setTimeout(() => setLastSyncResult(null), 3000);
    };

    window.addEventListener('userDataSynced', handleDataSynced);
    
    // Refresh status every 30 seconds
    const interval = setInterval(loadSyncStatus, 30000);
    
    return () => {
      window.removeEventListener('userDataSynced', handleDataSynced);
      clearInterval(interval);
    };
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await userCloudSyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    setLastSyncResult(null);
    
    try {
      const result = await userCloudSyncService.manualSync();
      setLastSyncResult(result.message);
      
      if (result.success) {
        await loadSyncStatus();
      }
    } catch (error) {
      setLastSyncResult('Sync failed. Please try again.');
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setLastSyncResult(null), 3000);
    }
  };

  const handleDebugTest = async () => {
    setDebugResult('Running debug tests...');
    try {
      const result = await DebugCloudSync.runAllTests();
      setDebugResult(`Debug: ${result.summary}. Check console for details.`);
      console.log('🧪 Debug test results:', result);
    } catch (error) {
      setDebugResult('Debug test failed. Check console for details.');
      console.error('🧪 Debug test error:', error);
    }
    setTimeout(() => setDebugResult(null), 5000);
  };

  const currentUser = authService.getCurrentUser();
  
  // Don't show for guest users or users without email/phone
  if (!currentUser || currentUser.isGuest || (!currentUser.email && !currentUser.phone)) {
    return null;
  }

  const formatLastSync = (date?: Date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getSyncStatusColor = () => {
    if (!syncStatus.isOnline) return 'text-red-500';
    if (!syncStatus.lastSyncTime) return 'text-yellow-500';
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - syncStatus.lastSyncTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return 'text-green-500';
    if (diffMinutes < 30) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getSyncStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline';
    if (!syncStatus.lastSyncTime) return 'Not synced';
    
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - syncStatus.lastSyncTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return 'Up to date';
    if (diffMinutes < 30) return 'Recent sync';
    return 'Needs sync';
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${syncStatus.isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
              {syncStatus.isOnline ? (
                <Cloud className="w-5 h-5 text-green-600" />
              ) : (
                <CloudOff className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-gray-900">Cloud Sync</h3>
                <span className={`text-sm font-medium ${getSyncStatusColor()}`}>
                  {getSyncStatusText()}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Last sync: {formatLastSync(syncStatus.lastSyncTime)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 rounded transition-colors"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>
            
            <button
              onClick={handleDebugTest}
              className="flex items-center space-x-1 px-2 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs"
              title="Run debug tests to check cloud sync"
            >
              <Bug className="w-3 h-3" />
              <span>Debug</span>
            </button>
            
            <button
              onClick={handleManualSync}
              disabled={isManualSyncing || !syncStatus.isOnline}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Sync Result Message */}
        {lastSyncResult && (
          <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">{lastSyncResult}</span>
            </div>
          </div>
        )}

        {/* Debug Result Message */}
        {debugResult && (
          <div className="mt-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center space-x-2">
              <Bug className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-800">{debugResult}</span>
            </div>
          </div>
        )}

        {/* Detailed Status */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Cloud Data</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Groups:</span>
                    <span>{syncStatus.cloudDataCount.groups}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Matches:</span>
                    <span>{syncStatus.cloudDataCount.matches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Players:</span>
                    <span>{syncStatus.cloudDataCount.players}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Benefits</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-3 h-3" />
                    <span>Mobile sync</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Laptop className="w-3 h-3" />
                    <span>Desktop sync</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-3 h-3" />
                    <span>Real-time updates</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-3 p-3 rounded-lg bg-gray-50">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="text-xs text-gray-600">
                  <p><strong>Cross-device sync:</strong> Your cricket data is automatically synchronized across all devices using the same email account.</p>
                  <p className="mt-1"><strong>Account:</strong> {currentUser.email || currentUser.phone}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 