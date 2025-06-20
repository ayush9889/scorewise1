import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Download, Upload, CheckCircle, AlertCircle, Loader, X, HardDrive, Database } from 'lucide-react';
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
    details?: string;
  }>({ step: '', current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    available: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    loadSyncStatus();
    checkStorageQuota();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await cloudStorageService.getCloudSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  const checkStorageQuota = async () => {
    try {
      // Check localStorage usage
      let localStorageUsed = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageUsed += localStorage[key].length + key.length;
        }
      }
      
      // Estimate available space (5MB typical mobile limit)
      const estimatedLimit = 5 * 1024 * 1024; // 5MB
      const percentage = (localStorageUsed / estimatedLimit) * 100;
      
      setStorageInfo({
        used: localStorageUsed,
        available: estimatedLimit - localStorageUsed,
        percentage: Math.round(percentage)
      });
    } catch (error) {
      console.warn('Failed to check storage quota:', error);
    }
  };

  const clearFirebaseCache = async (): Promise<void> => {
    console.log('🧹 Clearing Firebase cache to free up storage...');
    
    try {
      // Clear Firebase-related localStorage entries
      const firebaseKeys = Object.keys(localStorage).filter(key => 
        key.includes('firebase') || 
        key.includes('firestore') ||
        key.includes('mutation') ||
        key.includes('pending')
      );
      
      console.log(`🗑️ Removing ${firebaseKeys.length} Firebase cache entries`);
      firebaseKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove key ${key}:`, error);
        }
      });
      
      // Also clear session storage
      sessionStorage.clear();
      
      // Update storage info
      await checkStorageQuota();
      
      console.log('✅ Firebase cache cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear Firebase cache:', error);
      throw error;
    }
  };

  const migrateInChunks = async <T,>(
    items: T[],
    chunkSize: number,
    migrationFn: (item: T) => Promise<void>,
    stepName: string
  ): Promise<void> => {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    
    console.log(`📦 Migrating ${items.length} ${stepName} in ${chunks.length} chunks of ${chunkSize}`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkStart = i * chunkSize + 1;
      const chunkEnd = Math.min((i + 1) * chunkSize, items.length);
      
      setMigrationProgress(prev => ({
        ...prev,
        details: `${stepName}: ${chunkStart}-${chunkEnd} of ${items.length}`
      }));
      
      // Process chunk with error handling
      try {
        await Promise.all(chunk.map(item => migrationFn(item)));
        console.log(`✅ Migrated chunk ${i + 1}/${chunks.length} of ${stepName}`);
        
        // Clear cache between chunks to prevent quota issues
        if (i < chunks.length - 1) {
          await clearFirebaseCache();
          // Small delay to allow Firebase to sync
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Failed to migrate chunk ${i + 1} of ${stepName}:`, error);
        throw new Error(`Failed to migrate ${stepName} (chunk ${i + 1}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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

      // Check storage quota before starting
      await checkStorageQuota();
      if (storageInfo && storageInfo.percentage > 70) {
        console.warn('⚠️ Storage quota high, clearing cache before migration');
        await clearFirebaseCache();
      }

      // Step 1: Migrate user profile (single item)
      setMigrationProgress({ step: 'Migrating user profile...', current: 1, total: 4 });
      try {
        await cloudStorageService.saveUserProfile(currentUser);
        console.log('✅ User profile migrated');
      } catch (error) {
        console.error('❌ User profile migration failed:', error);
        // Continue with other migrations even if user profile fails
      }

      // Step 2: Migrate groups (small chunks)
      setMigrationProgress({ step: 'Migrating groups...', current: 2, total: 4 });
      const localGroups = await storageService.getAllGroups();
      console.log(`📊 Found ${localGroups.length} groups to migrate`);
      
      if (localGroups.length > 0) {
        await migrateInChunks(
          localGroups,
          2, // Small chunks for groups
          async (group) => await cloudStorageService.saveGroup(group),
          'groups'
        );
      }

      // Step 3: Migrate players (medium chunks)
      setMigrationProgress({ step: 'Migrating players...', current: 3, total: 4 });
      const localPlayers = await storageService.getAllPlayers();
      console.log(`📊 Found ${localPlayers.length} players to migrate`);
      
      if (localPlayers.length > 0) {
        await migrateInChunks(
          localPlayers,
          5, // Medium chunks for players
          async (player) => await cloudStorageService.savePlayer(player),
          'players'
        );
      }

      // Step 4: Migrate matches (small chunks due to size)
      setMigrationProgress({ step: 'Migrating matches...', current: 4, total: 4 });
      const localMatches = await storageService.getAllMatches();
      console.log(`📊 Found ${localMatches.length} matches to migrate`);
      
      if (localMatches.length > 0) {
        await migrateInChunks(
          localMatches,
          3, // Small chunks for matches (they're large)
          async (match) => await cloudStorageService.saveMatch(match),
          'matches'
        );
      }

      // Final cleanup
      await clearFirebaseCache();
      
      setMigrationStatus('success');
      await loadSyncStatus();
      
      console.log('🎉 Migration completed successfully!');
      
      // Refresh the page data after a delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('💥 Migration failed:', error);
      
      // Enhanced error handling for quota errors
      if (error instanceof Error) {
        if (error.message.includes('QuotaExceededError') || error.message.includes('exceeded the quota')) {
          setError(`Storage quota exceeded. Please clear browser data and try again with fewer items. Error: ${error.message}`);
        } else if (error.message.includes('FIRESTORE')) {
          setError(`Firebase error occurred. Please try again later. Error: ${error.message}`);
        } else {
          setError(error.message);
        }
      } else {
        setError('Migration failed with unknown error');
      }
      
      setMigrationStatus('error');
      
      // Attempt to clear cache to free up space
      try {
        await clearFirebaseCache();
      } catch (cleanupError) {
        console.error('Failed to cleanup after migration failure:', cleanupError);
      }
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

      // Check and clear storage quota before downloading
      await checkStorageQuota();
      if (storageInfo && storageInfo.percentage > 60) {
        console.warn('⚠️ Storage quota high, clearing cache before download');
        await clearFirebaseCache();
      }

      // Step 1: Download groups
      setMigrationProgress({ step: 'Downloading groups...', current: 1, total: 3 });
      const cloudGroups = await cloudStorageService.getUserGroups();
      console.log(`📥 Found ${cloudGroups.length} groups in cloud`);
      
      for (const group of cloudGroups) {
        await storageService.saveGroup(group);
      }

      // Step 2: Download players
      setMigrationProgress({ step: 'Downloading players...', current: 2, total: 3 });
      let totalPlayers = 0;
      for (const group of cloudGroups) {
        const players = await cloudStorageService.getGroupPlayers(group.id);
        totalPlayers += players.length;
        
        // Save players in batches to avoid quota issues
        if (players.length > 0) {
          await storageService.savePlayersBatch(players);
        }
        
        // Clear cache between groups
        if (cloudGroups.length > 1) {
          await clearFirebaseCache();
        }
      }
      console.log(`📥 Downloaded ${totalPlayers} players`);

      // Step 3: Download matches
      setMigrationProgress({ step: 'Downloading matches...', current: 3, total: 3 });
      const cloudMatches = await cloudStorageService.getUserMatches();
      console.log(`📥 Found ${cloudMatches.length} matches in cloud`);
      
      // Download matches in chunks
      for (let i = 0; i < cloudMatches.length; i += 5) {
        const chunk = cloudMatches.slice(i, i + 5);
        for (const match of chunk) {
          await storageService.saveMatch(match);
        }
        
        // Clear cache between chunks
        if (i + 5 < cloudMatches.length) {
          await clearFirebaseCache();
        }
      }

      // Final cleanup
      await clearFirebaseCache();
      
      setMigrationStatus('success');
      await loadSyncStatus();
      
      console.log('🎉 Download completed successfully!');
      
      // Refresh the page data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('💥 Download failed:', error);
      setError(error instanceof Error ? error.message : 'Download failed');
      setMigrationStatus('error');
      
      // Cleanup after failure
      try {
        await clearFirebaseCache();
      } catch (cleanupError) {
        console.error('Failed to cleanup after download failure:', cleanupError);
      }
    }
  };

  const clearCloudData = async () => {
    if (!confirm('Are you sure you want to clear all cloud data? This cannot be undone.')) {
      return;
    }

    try {
      await cloudStorageService.clearOfflineCache();
      await clearFirebaseCache();
      console.log('Cloud cache cleared');
      await loadSyncStatus();
      await checkStorageQuota();
    } catch (error) {
      console.error('Failed to clear cloud data:', error);
      setError('Failed to clear cloud data');
    }
  };

  const forceCleanStorage = async () => {
    if (!confirm('This will clear all local Firebase cache and may require re-authentication. Continue?')) {
      return;
    }
    
    try {
      await clearFirebaseCache();
      await checkStorageQuota();
      console.log('✅ Storage cleaned successfully');
    } catch (error) {
      console.error('❌ Failed to clean storage:', error);
      setError('Failed to clean storage');
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
              <div className="text-center py-4">
                <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                <p className="text-sm text-gray-500 mt-2">Loading status...</p>
              </div>
            )}
          </div>

          {/* Storage Information */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <HardDrive className="w-5 h-5 mr-2 text-orange-600" />
              Storage Usage
            </h3>
            {storageInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Used:</span>
                  <span className="text-sm font-mono">{(storageInfo.used / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Available:</span>
                  <span className="text-sm font-mono">{(storageInfo.available / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Usage:</span>
                    <span className={`text-sm font-bold ${
                      storageInfo.percentage > 80 ? 'text-red-600' : 
                      storageInfo.percentage > 60 ? 'text-orange-600' : 
                      'text-green-600'
                    }`}>
                      {storageInfo.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        storageInfo.percentage > 80 ? 'bg-red-500' : 
                        storageInfo.percentage > 60 ? 'bg-orange-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                    />
                  </div>
                </div>
                {storageInfo.percentage > 70 && (
                  <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 mt-3">
                    <div className="flex items-center">
                      <AlertCircle className="w-4 h-4 text-orange-600 mr-2" />
                      <p className="text-sm text-orange-800">
                        High storage usage detected. Consider clearing cache before migration.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <Loader className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                <p className="text-xs text-gray-500 mt-1">Checking storage...</p>
              </div>
            )}
          </div>

          {/* Storage Management */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Database className="w-5 h-5 mr-2 text-blue-600" />
              Storage Management
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={forceCleanStorage}
                className="flex items-center justify-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                <HardDrive className="w-4 h-4 mr-2" />
                Clear Firebase Cache
              </button>
              <button
                onClick={clearCloudData}
                className="flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                <Database className="w-4 h-4 mr-2" />
                Clear All Cache
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Use these if you encounter quota exceeded errors during migration.
            </p>
          </div>

          {/* Migration Progress */}
          {migrationStatus === 'migrating' && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center mb-2">
                <Loader className="w-5 h-5 mr-2 text-blue-600 animate-spin" />
                <div>
                  <span className="font-semibold text-blue-900">Migration in Progress</span>
                  {migrationProgress.details && (
                    <p className="text-sm text-blue-700 mt-1">{migrationProgress.details}</p>
                  )}
                </div>
              </div>
              <p className="text-blue-700 text-sm mb-3">{migrationProgress.step}</p>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-blue-600 mt-2">
                <span>Step {migrationProgress.current} of {migrationProgress.total}</span>
                <span>{Math.round((migrationProgress.current / migrationProgress.total) * 100)}%</span>
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
              <div className="flex items-center text-red-700 mb-2">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="font-semibold">Migration Failed</span>
              </div>
              <p className="text-red-600 text-sm mb-3">{error}</p>
              
              {(error.includes('QuotaExceededError') || error.includes('exceeded the quota')) && (
                <div className="bg-orange-100 border border-orange-200 rounded-lg p-3">
                  <h4 className="font-semibold text-orange-800 mb-2">Storage Quota Solution:</h4>
                  <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
                    <li>Click "Clear Firebase Cache" above to free up space</li>
                    <li>Try migration again with smaller data chunks</li>
                    <li>Clear browser data if problem persists</li>
                    <li>Contact support if issue continues</li>
                  </ol>
                </div>
              )}
              
              {error.includes('FIRESTORE') && (
                <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-800 mb-2">Firebase Issue Detected:</h4>
                  <p className="text-sm text-blue-700">
                    This is a temporary Firebase service issue. Please wait a few minutes and try again.
                  </p>
                </div>
              )}
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