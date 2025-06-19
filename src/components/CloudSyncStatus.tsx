import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';
import { userCloudSyncService } from '../services/userCloudSyncService';
import { DebugCloudSync } from '../services/debugCloudSync';
import { StorageCleanup } from '../services/storageCleanup';

interface CloudSyncStatusProps {
  isOnline: boolean;
  firebaseWorking: boolean;
  lastSync?: Date;
  className?: string;
}

export const CloudSyncStatus: React.FC<CloudSyncStatusProps> = ({
  isOnline,
  firebaseWorking,
  lastSync,
  className = ''
}) => {
  const [syncStatus, setSyncStatus] = useState<{
    lastSyncTime?: Date;
    cloudDataCount: { groups: number; matches: number; players: number };
    isOnline: boolean;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [debugResults, setDebugResults] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    loadSyncStatus();
    
    // Update sync status every 30 seconds
    const interval = setInterval(loadSyncStatus, 30000);
    
    // Listen for sync events
    const handleSyncEvent = () => {
      loadSyncStatus();
    };
    
    window.addEventListener('userDataSynced', handleSyncEvent);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('userDataSynced', handleSyncEvent);
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
    setSyncing(true);
    try {
      const result = await userCloudSyncService.manualSync();
      if (result.success) {
        await loadSyncStatus();
        console.log('✅ Manual sync completed successfully');
      } else {
        console.warn('⚠️ Manual sync failed:', result.message);
        alert(`Sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Manual sync error:', error);
      alert(`Sync error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDebugTests = async () => {
    setShowDebug(true);
    try {
      console.log('🧪 Running debug tests...');
      const results = await DebugCloudSync.runAllTests();
      setDebugResults(results);
      console.log('🧪 Debug tests completed:', results.summary);
    } catch (error) {
      console.error('❌ Debug tests failed:', error);
      setDebugResults({
        tests: [],
        summary: 'Debug tests failed to run'
      });
    }
  };

  const currentUser = authService.getCurrentUser();
  const isSyncEnabled = currentUser && (currentUser.email || currentUser.phone) && !currentUser.isGuest;
  
  const getSyncStatusColor = () => {
    if (!isSyncEnabled) return 'text-gray-400';
    if (!isOnline) return 'text-red-400';
    if (!firebaseWorking) return 'text-orange-400';
    return 'text-green-400';
  };

  const getSyncStatusIcon = () => {
    if (!isSyncEnabled) return CloudOff;
    if (!isOnline) return CloudOff;
    if (!firebaseWorking) return AlertTriangle;
    return Cloud;
  };

  const getSyncStatusText = () => {
    if (!isSyncEnabled) return 'Sync disabled (Guest mode)';
    if (!isOnline) return 'Offline';
    if (!firebaseWorking) return 'Firebase disconnected';
    return 'Synced';
  };

  const StatusIcon = getSyncStatusIcon();

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusIcon className={`w-5 h-5 ${getSyncStatusColor()}`} />
          <div>
            <p className="text-white font-medium text-sm">{getSyncStatusText()}</p>
            {syncStatus?.lastSyncTime && (
              <p className="text-white/60 text-xs">
                Last sync: {syncStatus.lastSyncTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isSyncEnabled && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              title="Manual sync"
            >
              <RefreshCw className={`w-4 h-4 text-white ${syncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Toggle details"
          >
            {showDetails ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="space-y-3">
            {/* User Info */}
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">User Account</p>
              <p className="text-white/60 text-xs">
                {currentUser ? 
                  `${currentUser.name} (${currentUser.email || currentUser.phone || 'No identifier'})` : 
                  'Not signed in'
                }
              </p>
              {currentUser?.isGuest && (
                <p className="text-orange-400 text-xs">Guest mode - sync disabled</p>
              )}
            </div>

            {/* Connection Status */}
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Connection Status</p>
              <div className="flex items-center space-x-4 text-xs">
                <div className={`flex items-center space-x-1 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                  {isOnline ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>Internet: {isOnline ? 'Connected' : 'Offline'}</span>
                </div>
                <div className={`flex items-center space-x-1 ${firebaseWorking ? 'text-green-400' : 'text-red-400'}`}>
                  {firebaseWorking ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>Firebase: {firebaseWorking ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
            </div>

            {/* Data Count */}
            {syncStatus && (
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Cloud Data</p>
                <div className="text-white/60 text-xs space-y-1">
                  <p>Groups: {syncStatus.cloudDataCount.groups}</p>
                  <p>Matches: {syncStatus.cloudDataCount.matches}</p>
                  <p>Players: {syncStatus.cloudDataCount.players}</p>
                </div>
              </div>
            )}

                         {/* Debug Section */}
             <div className="space-y-2">
               <button
                 onClick={handleDebugTests}
                 className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
               >
                 Run Sync Debug Tests
               </button>
               
               <button
                 onClick={async () => {
                   try {
                     const result = await DebugCloudSync.runComprehensiveTest();
                     console.log('🧪 Comprehensive test results:', result);
                     alert(`Debug Test: ${result.details}\n\nCheck console for detailed results.`);
                   } catch (error) {
                     console.error('❌ Debug test failed:', error);
                     alert('Debug test failed: ' + error.message);
                   }
                 }}
                 className="w-full bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
               >
                 🔍 Debug Sync Test
               </button>
               
               <button
                 onClick={async () => {
                   try {
                     const user = authService.getCurrentUser();
                     if (!user || (!user.email && !user.phone)) {
                       alert('No user logged in for sync test');
                       return;
                     }
                     
                     await userCloudSyncService.performFullSync();
                     alert('Full sync completed! Check other devices for updates.');
                   } catch (error) {
                     console.error('❌ Sync test failed:', error);
                     alert('Sync test failed: ' + error.message);
                   }
                 }}
                 className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
               >
                 🔄 Force Full Sync
               </button>
               
               <button
                 onClick={async () => {
                   try {
                     await StorageCleanup.emergencyCleanup();
                     const report = await StorageCleanup.getStorageReport();
                     console.log('📊 Storage report after cleanup:', report);
                     alert(`Storage cleanup completed!\n\nItems: ${report.itemCount}\nTotal size: ${(report.totalSize / 1024).toFixed(1)}KB\nQuota used: ${report.quotaInfo.percentage.toFixed(1)}%`);
                   } catch (error) {
                     console.error('❌ Storage cleanup failed:', error);
                     alert('Storage cleanup failed: ' + error.message);
                   }
                 }}
                 className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
               >
                 🗑️ Clear Storage & Fix Quota
               </button>
             </div>

            {/* Debug Results */}
            {showDebug && debugResults && (
              <div className="mt-3 p-3 bg-black/30 rounded-lg">
                <p className="text-white/80 text-sm font-medium mb-2">Debug Results: {debugResults.summary}</p>
                <div className="space-y-2">
                  {debugResults.tests.map((test: any, index: number) => (
                    <div key={index} className="flex items-center space-x-2 text-xs">
                      {test.result.success ? 
                        <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" /> : 
                        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      }
                      <span className="text-white/70">{test.name}:</span>
                      <span className={test.result.success ? 'text-green-400' : 'text-red-400'}>
                        {test.result.message}
                      </span>
                    </div>
                  ))}
                </div>
                
                {debugResults.summary !== '3/3 tests passed' && (
                  <div className="mt-3 p-2 bg-red-900/30 rounded border border-red-500/30">
                    <p className="text-red-400 text-xs font-medium">Troubleshooting Steps:</p>
                    <ul className="text-red-300 text-xs mt-1 space-y-1 list-disc list-inside">
                      <li>Check internet connection</li>
                      <li>Verify Firebase configuration in .env file</li>
                      <li>Try signing out and signing in again</li>
                      <li>Check browser console for detailed error messages</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 