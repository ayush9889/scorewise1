export class StorageCleanup {
  static async clearAllBackups(): Promise<void> {
    try {
      // Clear all backup-related localStorage items
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('cricket_scorer_backup') || 
          key.includes('backup') ||
          key.includes('CricketScorer')
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Removed backup key:', key);
      });
      
      // Also clear sessionStorage backups
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.includes('cricket_scorer_backup') || 
          key.includes('backup') ||
          key.includes('CricketScorer')
        )) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      console.log(`✅ Cleared ${keysToRemove.length} localStorage backups and ${sessionKeysToRemove.length} sessionStorage backups`);
      
    } catch (error) {
      console.error('❌ Failed to clear backups:', error);
    }
  }
  
  static async checkStorageQuota(): Promise<{
    used: number;
    total: number;
    available: number;
    percentage: number;
  }> {
    try {
      let used = 0;
      let total = 0;
      
      // Calculate localStorage usage
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      // Estimate total quota (most browsers have 5-10MB)
      total = 5 * 1024 * 1024; // 5MB estimate
      
      // Try to get actual quota if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          total = estimate.quota;
        }
        if (estimate.usage) {
          used = estimate.usage;
        }
      }
      
      const available = total - used;
      const percentage = (used / total) * 100;
      
      return { used, total, available, percentage };
      
    } catch (error) {
      console.warn('❌ Could not check storage quota:', error);
      return { used: 0, total: 0, available: 0, percentage: 0 };
    }
  }
  
  static async emergencyCleanup(): Promise<void> {
    console.log('🚨 Emergency storage cleanup initiated...');
    
    // 1. Clear all backups
    await this.clearAllBackups();
    
    // 2. Clear any other large data items
    const largeKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value && value.length > 50000) { // Items larger than 50KB
          largeKeys.push({ key, size: value.length });
        }
      }
    }
    
    // Remove largest items first
    largeKeys.sort((a, b) => b.size - a.size);
    largeKeys.forEach(item => {
      console.log(`🗑️ Removing large item: ${item.key} (${(item.size / 1024).toFixed(1)}KB)`);
      localStorage.removeItem(item.key);
    });
    
    // 3. Clear any old/expired data
    const keysToCheck = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('temp_') ||
        key.includes('cache_') ||
        key.includes('old_') ||
        key.includes('expired_')
      )) {
        keysToCheck.push(key);
      }
    }
    
    keysToCheck.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('✅ Emergency cleanup completed');
  }
  
  static async getStorageReport(): Promise<{
    quotaInfo: any;
    itemCount: number;
    largestItems: Array<{key: string; size: number}>;
    totalSize: number;
  }> {
    const quotaInfo = await this.checkStorageQuota();
    
    const items = [];
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          const size = value.length + key.length;
          items.push({ key, size });
          totalSize += size;
        }
      }
    }
    
    // Sort by size, largest first
    items.sort((a, b) => b.size - a.size);
    
    return {
      quotaInfo,
      itemCount: items.length,
      largestItems: items.slice(0, 10), // Top 10 largest
      totalSize
    };
  }
}

// Auto-run emergency cleanup if quota is exceeded
try {
  StorageCleanup.checkStorageQuota().then(quota => {
    if (quota.percentage > 90) {
      console.warn('⚠️ Storage quota nearly exceeded, running emergency cleanup...');
      StorageCleanup.emergencyCleanup();
    }
  });
} catch (error) {
  console.warn('Could not check storage quota on module load');
}

// Make available globally for debugging
(window as any).StorageCleanup = StorageCleanup; 