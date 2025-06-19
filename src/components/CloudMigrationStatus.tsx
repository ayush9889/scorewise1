import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Download, Upload, CheckCircle, AlertCircle, Loader, X } from 'lucide-react';
import { cloudStorageService } from '../services/cloudStorageService';
import { storageService } from '../services/storage';
import { authService } from '../services/authService';

interface CloudMigrationStatusProps {
  onClose: () => void;
}

export const CloudMigrationStatus: React.FC<CloudMigrationStatusProps> = ({ onClose }) => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [migrationProgress, setMigrationProgress] = useState<{
    step: string;
    current: number;
    total: number;
  }>({ step: '', current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await cloudStorageService.getCloudSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  const migrateToCloud = async () => {
    setMigrationStatus('migrating');
    setError(null);
    
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Please sign in to migrate data to cloud');
      }

      // Step 1: Migrate user profile
      setMigrationProgress({ step: 'Migrating user profile...', current: 1, total: 4 });
      await cloudStorageService.saveUserProfile(currentUser);

      // Step 2: Migrate groups
      setMigrationProgress({ step: 'Migrating groups...', current: 2, total: 4 });
      const localGroups = await storageService.getAllGroups();
      for (const group of localGroups) {
        await cloudStorageService.saveGroup(group);
      }

      // Step 3: Migrate players
      setMigrationProgress({ step: 'Migrating players...', current: 3, total: 4 });
      const localPlayers = await storageService.getAllPlayers();
      for (const player of localPlayers) {
        await cloudStorageService.savePlayer(player);
      }

      // Step 4: Migrate matches
      setMigrationProgress({ step: 'Migrating matches...', current: 4, total: 4 });
      const localMatches = await storageService.getAllMatches();
      for (const match of localMatches) {
        await cloudStorageService.saveMatch(match);
      }

      setMigrationStatus('success');
      await loadSyncStatus();
      
      // Refresh the page data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Migration failed:', error);
      setError(error instanceof Error ? error.message : 'Migration failed');
      setMigrationStatus('error');
    }
  };

  const downloadFromCloud = async () => {
    setMigrationStatus('migrating');
    setError(null);
    
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Please sign in to download data from cloud');
      }

      // Step 1: Download groups
      setMigrationProgress({ step: 'Downloading groups...', current: 1, total: 3 });
      const cloudGroups = await cloudStorageService.getUserGroups();
      for (const group of cloudGroups) {
        await storageService.saveGroup(group);
      }

      // Step 2: Download players
      setMigrationProgress({ step: 'Downloading players...', current: 2, total: 3 });
      for (const group of cloudGroups) {
        const players = await cloudStorageService.getGroupPlayers(group.id);
        for (const player of players) {
          await storageService.savePlayer(player);
        }
      }

      // Step 3: Download matches
      setMigrationProgress({ step: 'Downloading matches...', current: 3, total: 3 });
      const cloudMatches = await cloudStorageService.getUserMatches();
      for (const match of cloudMatches) {
        await storageService.saveMatch(match);
      }

      setMigrationStatus('success');
      await loadSyncStatus();
      
      // Refresh the page data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Download failed:', error);
      setError(error instanceof Error ? error.message : 'Download failed');
      setMigrationStatus('error');
    }
  };

  const clearCloudData = async () => {
    if (!confirm('Are you sure you want to clear all cloud data? This cannot be undone.')) {
      return;
    }

    try {
      await cloudStorageService.clearOfflineCache();
      console.log('Cloud cache cleared');
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to clear cloud data:', error);
      setError('Failed to clear cloud data');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center">
              <Cloud className="w-6 h-6 mr-2" />
              Cloud Storage Migration
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Current Status</h3>
            {syncStatus ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Cloud Connection:</span>
                  <div className="flex items-center">
                    {syncStatus.isOnline ? (
                      <div className="flex items-center text-green-600">
                        <Cloud className="w-4 h-4 mr-1" />
                        <span className="text-sm">Online</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <CloudOff className="w-4 h-4 mr-1" />
                        <span className="text-sm">Offline</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Cached Items:</span>
                  <span className="text-sm font-mono">{syncStatus.cacheSize}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">User:</span>
                  <span className="text-sm font-mono">{syncStatus.user || 'Not signed in'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Sync:</span>
                  <span className="text-sm">{syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-gray-500">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading status...
              </div>
            )}
          </div>

          {/* Migration Progress */}
          {migrationStatus === 'migrating' && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center mb-2">
                <Loader className="w-5 h-5 mr-2 text-blue-600 animate-spin" />
                <span className="font-semibold text-blue-900">Migration in Progress</span>
              </div>
              <p className="text-blue-700 text-sm mb-3">{migrationProgress.step}</p>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="text-right text-sm text-blue-600 mt-1">
                {migrationProgress.current} / {migrationProgress.total}
              </div>
            </div>
          )}

          {/* Success Message */}
          {migrationStatus === 'success' && (
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center text-green-700">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span className="font-semibold">Migration Completed Successfully!</span>
              </div>
              <p className="text-green-600 text-sm mt-1">Your data is now stored in the cloud and will sync across all devices.</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-center text-red-700">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="font-semibold">Migration Failed</span>
              </div>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Migration Actions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Migration Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upload to Cloud */}
              <button
                onClick={migrateToCloud}
                disabled={migrationStatus === 'migrating' || !syncStatus?.user}
                className="p-4 border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center mb-2">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-gray-900">Upload to Cloud</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Move your local data to cloud storage for cross-device sync
                  </p>
                </div>
              </button>

              {/* Download from Cloud */}
              <button
                onClick={downloadFromCloud}
                disabled={migrationStatus === 'migrating' || !syncStatus?.user}
                className="p-4 border-2 border-green-200 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center mb-2">
                  <Download className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-gray-900">Download from Cloud</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Sync your cloud data to this device
                  </p>
                </div>
              </button>
            </div>

            {/* Clear Cache */}
            <button
              onClick={clearCloudData}
              className="w-full p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
            >
              Clear Cloud Cache
            </button>
          </div>

          {/* Info */}
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800">Important Notes</h4>
                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                  <li>• You must be signed in to use cloud storage</li>
                  <li>• Migration will overwrite existing data</li>
                  <li>• Your data will sync automatically across all devices once migrated</li>
                  <li>• Local data will remain as backup after migration</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 