# Enhanced Sync System Troubleshooting Guide

## Overview

The Enhanced Sync System provides robust, real-time synchronization across devices with advanced error handling, data consistency checks, and automatic recovery mechanisms.

## Quick Fixes for Common Issues

### 1. "Sync Errors Detected" Message

**Symptoms:**
- Red error indicators in sync status
- Failed sync operations
- Data not updating across devices

**Quick Solutions:**
1. **Clear Sync Errors**: Click "Clear Errors" button in sync status panel
2. **Force Sync**: Use "Force Sync Now" button
3. **Reset Sync State**: If consecutive failures > 3, use "Reset Sync State" button

**Advanced Solutions:**
```javascript
// Manual sync reset via browser console
enhancedSyncService.resetSyncState();
enhancedSyncService.queueComprehensiveSync();
```

### 2. Different Data on Different Devices

**Symptoms:**
- Players/matches/groups showing different information
- Changes not appearing on other devices
- Inconsistent data across devices

**Immediate Actions:**
1. **Check Network Connection**: Ensure all devices are online
2. **Verify Authentication**: Make sure same user account on all devices
3. **Force Background Sync**: Wait for background sync (every 30 seconds)
4. **Manual Refresh**: Force sync on each device

**Data Consistency Resolution:**
```javascript
// Force comprehensive data download
enhancedSyncService.queueComprehensiveSync();
enhancedSyncService.forceSyncNow();
```

### 3. "Syncing" Status Stuck

**Symptoms:**
- Sync status showing "Syncing..." indefinitely
- Pending operations not decreasing
- Sync progress not advancing

**Solutions:**
1. **Wait for Timeout**: Operations timeout after 20 seconds
2. **Check Connection**: Verify stable internet connection
3. **Restart Sync**: Disable and re-enable auto-sync
4. **Clear Queue**: Reset sync state to clear stuck operations

## Detailed Troubleshooting

### Network-Related Issues

#### Offline Sync Recovery
```javascript
// Check if device was offline and has pending operations
const status = enhancedSyncService.getSyncStatus();
console.log('Pending operations:', status.pendingOperations);

// Force sync when back online
if (navigator.onLine && status.pendingOperations > 0) {
  enhancedSyncService.forceSyncNow();
}
```

#### Connection Timeout Issues
- **Default timeout**: 20 seconds per operation
- **Retry logic**: 5 attempts with exponential backoff
- **Fallback**: Operations queue for later retry

### Data Consistency Issues

#### Conflict Resolution
The system uses timestamp-based conflict resolution:
- **Local preference**: Changes within 10 seconds prefer local data
- **Remote preference**: Newer timestamps from cloud take priority
- **Merge strategy**: Critical data gets merged with user intent preservation

#### Manual Conflict Resolution
```javascript
// Check for consistency issues
const consistencyStatus = enhancedSyncService.getConsistencyStatus();
console.log('Data consistency:', consistencyStatus);

// Force data re-download and merge
enhancedSyncService.queueSyncOperation('DOWNLOAD', 'ALL', {}, 'HIGH');
```

### Performance Optimization

#### Sync Frequency Settings
- **Auto-sync**: Every 15 seconds (configurable)
- **Background sync**: Every 30 seconds
- **Real-time updates**: Instant (< 1 second)
- **Batch size**: 5 operations per sync cycle

#### Memory Management
- **Queue limits**: Max 1000 pending operations
- **Failed updates**: Max 20 cached for retry
- **Real-time updates**: 24-hour expiration
- **Automatic cleanup**: Removes expired data

## Advanced Diagnostics

### Sync Status Monitoring
```javascript
// Subscribe to detailed sync status
const unsubscribe = enhancedSyncService.onSyncStatusChange((status) => {
  console.log('Sync Status:', {
    enabled: status.isEnabled,
    online: status.isOnline,
    pending: status.pendingOperations,
    errors: status.errors,
    consecutiveFailures: status.consecutiveFailures,
    backgroundSyncing: status.isBackgroundSyncing
  });
});
```

### Real-Time Connection Diagnostics
```javascript
// Check real-time sync status
const realTimeStatus = realTimeSyncService.getConnectionStatus();
console.log('Real-time Status:', {
  enabled: realTimeStatus.enabled,
  listening: realTimeStatus.listening,
  listenersCount: realTimeStatus.listenersCount,
  deviceId: realTimeSyncService.getDeviceId()
});
```

### Queue Analysis
```javascript
// Analyze pending operations
const queueSize = enhancedSyncService.getOfflineQueueSize();
console.log(`Queue contains ${queueSize} pending operations`);

// Get detailed status
const fullStatus = enhancedSyncService.getSyncStatus();
console.log('Detailed sync analysis:', {
  totalOperations: fullStatus.totalOperations,
  completedOperations: fullStatus.totalOperations - fullStatus.pendingOperations,
  successRate: ((fullStatus.totalOperations - fullStatus.pendingOperations) / fullStatus.totalOperations * 100).toFixed(1) + '%',
  averageFailures: fullStatus.consecutiveFailures
});
```

## Recovery Procedures

### Complete Sync Reset
```javascript
// Nuclear option - complete sync reset
async function completeSyncReset() {
  // 1. Clear all sync state
  await enhancedSyncService.resetSyncState();
  
  // 2. Clear real-time sync
  realTimeSyncService.disableRealTimeSync();
  await new Promise(resolve => setTimeout(resolve, 1000));
  realTimeSyncService.enableRealTimeSync();
  
  // 3. Force comprehensive sync
  enhancedSyncService.queueComprehensiveSync();
  await enhancedSyncService.forceSyncNow();
  
  console.log('Complete sync reset performed');
}
```

### Data Recovery from Cloud
```javascript
// Download fresh data from cloud and merge
async function recoverFromCloud() {
  enhancedSyncService.queueSyncOperation('DOWNLOAD', 'ALL', {}, 'HIGH');
  await enhancedSyncService.forceSyncNow();
  console.log('Data recovery from cloud completed');
}
```

### Local Data Backup
```javascript
// Create emergency local backup
async function createEmergencyBackup() {
  const exportData = await storageService.exportData();
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `cricket-data-backup-${new Date().toISOString()}.json`;
  a.click();
  
  console.log('Emergency backup created');
}
```

## Prevention Strategies

### Regular Maintenance
1. **Monitor sync status**: Check for errors daily
2. **Clear old data**: Remove expired sync operations weekly
3. **Backup data**: Export data monthly as backup
4. **Update devices**: Keep app updated on all devices

### Best Practices
1. **Stable connection**: Use reliable internet for critical operations
2. **Sequential changes**: Avoid simultaneous edits on multiple devices
3. **Verify updates**: Check that changes appear on other devices
4. **Report issues**: Document and report persistent sync problems

### Automated Monitoring
```javascript
// Set up automated sync health monitoring
setInterval(() => {
  const status = enhancedSyncService.getSyncStatus();
  
  if (status.consecutiveFailures > 5) {
    console.warn('🚨 Sync health degraded - multiple consecutive failures');
    // Automatic recovery attempt
    enhancedSyncService.resetSyncState();
  }
  
  if (status.pendingOperations > 50) {
    console.warn('🚨 Large sync queue detected - may indicate connectivity issues');
  }
  
  if (!status.isOnline) {
    console.info('📱 Device offline - sync operations queued');
  }
}, 60000); // Check every minute
```

## Error Code Reference

### Sync Error Codes
- **NETWORK_ERROR**: Connection timeout or network unavailable
- **AUTH_ERROR**: Authentication failed or expired
- **PERMISSION_ERROR**: Insufficient permissions for operation
- **DATA_ERROR**: Invalid data format or structure
- **CONFLICT_ERROR**: Data conflict couldn't be resolved automatically
- **QUOTA_ERROR**: Storage quota exceeded
- **FIRESTORE_ERROR**: Firebase/Firestore service error

### Resolution Actions
- **NETWORK_ERROR**: Check internet connection, retry later
- **AUTH_ERROR**: Re-authenticate user, refresh tokens
- **PERMISSION_ERROR**: Verify user permissions, check group membership
- **DATA_ERROR**: Validate data format, report to developers
- **CONFLICT_ERROR**: Manual resolution required, use latest data
- **QUOTA_ERROR**: Clear old data, upgrade storage plan
- **FIRESTORE_ERROR**: Check Firebase status, retry operation

## Support Information

### Debug Information Collection
```javascript
// Collect comprehensive debug information
function collectDebugInfo() {
  const syncStatus = enhancedSyncService.getSyncStatus();
  const realTimeStatus = realTimeSyncService.getConnectionStatus();
  const consistencyStatus = enhancedSyncService.getConsistencyStatus();
  
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    syncStatus,
    realTimeStatus,
    consistencyStatus,
    deviceId: realTimeSyncService.getDeviceId(),
    queueSize: enhancedSyncService.getOfflineQueueSize()
  };
}

// Export debug info for support
const debugInfo = collectDebugInfo();
console.log('Debug Information:', JSON.stringify(debugInfo, null, 2));
```

### Performance Metrics
- **Sync latency**: < 2 seconds for most operations
- **Real-time updates**: < 1 second cross-device
- **Background sync**: Every 30 seconds
- **Conflict resolution**: Automatic within 5 seconds
- **Recovery time**: < 10 seconds after network restoration

### Known Limitations
- **Offline duration**: Max 7 days offline sync queue
- **Concurrent users**: Optimized for 2-5 simultaneous devices
- **Data size**: Best performance with < 10,000 total records
- **Network**: Requires stable internet for real-time features
- **Browser**: Modern browsers required for full functionality

## Quick Reference Commands

```javascript
// Emergency commands for immediate use
enhancedSyncService.clearSyncErrors();           // Clear all errors
enhancedSyncService.resetSyncState();            // Nuclear reset
enhancedSyncService.forceSyncNow();              // Force immediate sync
realTimeSyncService.processFailedUpdates();     // Retry failed updates
storageService.createBackup();                  // Create local backup

// Status checks
enhancedSyncService.getSyncStatus();             // Get sync status
realTimeSyncService.getConnectionStatus();      // Get real-time status
enhancedSyncService.getConsistencyStatus();     // Get data consistency
```

Remember: Most sync issues resolve automatically within 1-2 minutes. If problems persist beyond 5 minutes, use the recovery procedures above. 