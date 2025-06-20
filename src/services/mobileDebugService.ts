// Mobile Debug Service for diagnosing mobile-specific issues
import { storageService } from './storage';
import { authService } from './authService';
import { cloudStorageService } from './cloudStorageService';

export class MobileDebugService {
  static async runMobileDiagnostics(): Promise<void> {
    console.log('🔧 === MOBILE DIAGNOSTICS STARTING ===');
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('📱 Device type:', isMobile ? 'Mobile' : 'Desktop');
    console.log('🌐 User agent:', navigator.userAgent);
    console.log('📶 Online status:', navigator.onLine);
    
    // Check storage quota
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usageInMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(2);
        const quotaInMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(2);
        const usagePercent = estimate.quota ? ((estimate.usage || 0) / estimate.quota * 100).toFixed(1) : 'Unknown';
        
        console.log('💾 Storage usage:', `${usageInMB}MB / ${quotaInMB}MB (${usagePercent}%)`);
        
        if (parseFloat(usagePercent) > 80) {
          console.warn('⚠️ Storage quota is high - this may cause mobile issues');
        }
      } else {
        console.log('💾 Storage API not available');
      }
    } catch (error) {
      console.error('❌ Storage quota check failed:', error);
    }
    
    // Check IndexedDB availability
    try {
      if ('indexedDB' in window) {
        console.log('✅ IndexedDB is available');
        
        // Test IndexedDB connection
        const testDbName = 'mobile_test_db';
        const testRequest = indexedDB.open(testDbName, 1);
        
        testRequest.onsuccess = () => {
          console.log('✅ IndexedDB connection test successful');
          testRequest.result.close();
          indexedDB.deleteDatabase(testDbName);
        };
        
        testRequest.onerror = () => {
          console.error('❌ IndexedDB connection test failed:', testRequest.error);
        };
        
        testRequest.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.createObjectStore('test', { keyPath: 'id' });
        };
      } else {
        console.error('❌ IndexedDB not available');
      }
    } catch (error) {
      console.error('❌ IndexedDB test failed:', error);
    }
    
    // Check localStorage availability and space
    try {
      const testKey = 'mobile_test_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      console.log('✅ localStorage is working');
      
      // Check localStorage usage
      let localStorageSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length;
        }
      }
      const localStorageMB = (localStorageSize / 1024 / 1024).toFixed(2);
      console.log('💾 localStorage usage:', `${localStorageMB}MB`);
      
    } catch (error) {
      console.error('❌ localStorage test failed:', error);
    }
    
    // Test storage service initialization
    try {
      console.log('🔄 Testing storage service initialization...');
      const startTime = Date.now();
      
      await storageService.init();
      
      const initTime = Date.now() - startTime;
      console.log(`✅ Storage service initialized in ${initTime}ms`);
      
      if (initTime > 5000) {
        console.warn('⚠️ Storage initialization is slow - this may cause mobile timeouts');
      }
    } catch (error) {
      console.error('❌ Storage service initialization failed:', error);
    }
    
    // Test basic data operations
    try {
      console.log('🔄 Testing basic data operations...');
      
      const testGroups = await storageService.getAllGroups();
      const testPlayers = await storageService.getAllPlayers();
      const testMatches = await storageService.getAllMatches();
      
      console.log('📊 Data counts:', {
        groups: testGroups.length,
        players: testPlayers.length,
        matches: testMatches.length
      });
      
    } catch (error) {
      console.error('❌ Data operations failed:', error);
    }
    
    // Check current user and group state
    try {
      const currentUser = authService.getCurrentUser();
      const currentGroup = authService.getCurrentGroup();
      const userGroups = authService.getUserGroups();
      
      console.log('👤 Auth state:', {
        hasUser: !!currentUser,
        userName: currentUser?.name,
        hasGroup: !!currentGroup,
        groupName: currentGroup?.name,
        totalGroups: userGroups.length
      });
      
    } catch (error) {
      console.error('❌ Auth state check failed:', error);
    }
    
    // Test cloud connectivity
    try {
      console.log('🔄 Testing cloud connectivity...');
      const cloudStatus = await cloudStorageService.checkConnection();
      console.log('☁️ Cloud status:', cloudStatus);
    } catch (error) {
      console.error('❌ Cloud connectivity test failed:', error);
    }
    
    console.log('🔧 === MOBILE DIAGNOSTICS COMPLETED ===');
  }
  
  static async quickMobileFix(): Promise<void> {
    console.log('🛠️ === QUICK MOBILE FIX STARTING ===');
    
    try {
      // Install undefined players error handler
      this.fixUndefinedPlayersError();
      
      // Install quota exceeded error handler
      this.fixQuotaExceededError();
      
      // Clear problematic localStorage entries
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('temp_') || 
        key.includes('_cache') || 
        key.includes('debug_')
      );
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Removed localStorage key:', key);
      });
      
      // Force storage reinitialization
      console.log('🔄 Forcing storage reinitialization...');
      await storageService.init();
      
      // Create a minimal test group for mobile
      const currentUser = authService.getCurrentUser();
      if (currentUser && authService.getUserGroups().length === 0) {
        console.log('🆘 Creating emergency group for mobile user...');
        
        const emergencyGroup = {
          id: `mobile_group_${Date.now()}`,
          name: 'My Mobile Group',
          description: 'Emergency group created for mobile access',
          members: [{
            userId: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            role: 'admin' as const,
            joinedAt: new Date().toISOString()
          }],
          inviteCode: `MOB${Math.floor(Math.random() * 10000)}`,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          lastUpdated: Date.now()
        };
        
        await storageService.saveGroup(emergencyGroup);
        authService.setCurrentGroup(emergencyGroup);
        
        console.log('✅ Emergency group created:', emergencyGroup.name, 'Code:', emergencyGroup.inviteCode);
      }
      
      console.log('✅ Quick mobile fix completed - please refresh the page');
      
    } catch (error) {
      console.error('❌ Quick mobile fix failed:', error);
    }
  }

  // Fix the "Cannot read properties of undefined (reading 'players')" error
  private static fixUndefinedPlayersError(): void {
    console.log('🔧 Installing undefined players error handler...');
    
    try {
      // Add global error handler for this specific error
      window.addEventListener('error', (event) => {
        if (event.error?.message?.includes("Cannot read properties of undefined (reading 'players')")) {
          console.error('🚨 Mobile Error Detected: Undefined players property');
          console.log('🔧 Auto-fixing: Clearing problematic match data');
          
          // Clear potentially corrupted match data
          try {
            localStorage.removeItem('cricket_scorer_backup');
            sessionStorage.clear();
            console.log('✅ Cleared corrupted match data');
            
            // Show user-friendly message
            if (typeof window !== 'undefined' && window.alert) {
              setTimeout(() => {
                window.alert('📱 Mobile data issue detected and fixed. The page will refresh automatically.');
                setTimeout(() => window.location.reload(), 1000);
              }, 100);
            }
          } catch (clearError) {
            console.error('❌ Failed to clear corrupted data:', clearError);
          }
          
          event.preventDefault();
          return true;
        }
      });
      
      // Also add unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.message?.includes("Cannot read properties of undefined (reading 'players')")) {
          console.error('🚨 Mobile Promise Rejection: Undefined players property');
          console.log('🔧 Auto-fixing promise rejection');
          
          // Clear problematic data
          try {
            localStorage.removeItem('cricket_scorer_backup');
            console.log('✅ Cleared corrupted data after promise rejection');
          } catch (error) {
            console.error('❌ Failed to clear data after promise rejection:', error);
          }
          
          event.preventDefault();
        }
      });
      
      console.log('✅ Undefined players error handlers installed');
      
    } catch (error) {
      console.warn('⚠️ Could not install players error handlers:', error);
    }
  }

  // Fix the "QuotaExceededError" during Firebase operations
  private static fixQuotaExceededError(): void {
    console.log('🔧 Installing quota exceeded error handler...');
    
    try {
      // Add global error handler for quota exceeded errors
      window.addEventListener('error', (event) => {
        if (event.error?.message?.includes('QuotaExceededError') || 
            event.error?.message?.includes('exceeded the quota')) {
          console.error('🚨 Storage Quota Exceeded Error Detected');
          console.log('🔧 Auto-fixing: Clearing Firebase cache and storage');
          
          // Clear Firebase-related storage
          this.clearFirebaseStorage();
          
          event.preventDefault();
          return true;
        }
      });
      
      // Handle unhandled promise rejections for quota errors
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.message?.includes('QuotaExceededError') || 
            event.reason?.message?.includes('exceeded the quota')) {
          console.error('🚨 Storage Quota Promise Rejection');
          console.log('🔧 Auto-fixing quota exceeded promise rejection');
          
          // Clear Firebase storage
          this.clearFirebaseStorage();
          
          event.preventDefault();
        }
      });
      
      console.log('✅ Quota exceeded error handlers installed');
      
    } catch (error) {
      console.warn('⚠️ Could not install quota error handlers:', error);
    }
  }

  // Clear Firebase-related storage to free up quota
  private static clearFirebaseStorage(): void {
    try {
      console.log('🧹 Clearing Firebase storage to resolve quota issue...');
      
      // Clear Firebase-specific localStorage entries
      const firebaseKeys = Object.keys(localStorage).filter(key => 
        key.includes('firebase') || 
        key.includes('firestore') ||
        key.includes('mutation') ||
        key.includes('pending') ||
        key.startsWith('firebase:') ||
        key.includes('_mutations_') ||
        key.includes('_online_state_')
      );
      
      console.log(`🗑️ Found ${firebaseKeys.length} Firebase storage entries to clear`);
      
      firebaseKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          console.log(`✅ Cleared Firebase key: ${key.substring(0, 50)}...`);
        } catch (error) {
          console.warn(`⚠️ Failed to clear key ${key}:`, error);
        }
      });
      
      // Also clear session storage
      sessionStorage.clear();
      
      // Show user-friendly message
      if (typeof window !== 'undefined' && window.alert) {
        setTimeout(() => {
          window.alert('🧹 Storage quota issue detected and fixed. Firebase cache cleared. You may need to sign in again.');
        }, 100);
      }
      
      console.log('✅ Firebase storage cleared successfully');
      
    } catch (error) {
      console.error('❌ Failed to clear Firebase storage:', error);
    }
  }
  
  static async emergencyMobileRecovery(): Promise<void> {
    console.log('🚨 === EMERGENCY MOBILE RECOVERY ===');
    
    try {
      // Clear all cached data
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear IndexedDB
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
            console.log('🗑️ Deleted database:', db.name);
          }
        }
      }
      
      // Reinitialize storage
      await storageService.init();
      
      console.log('🆘 Emergency recovery completed - all data cleared');
      console.log('⚠️ You will need to sign in again and rejoin groups');
      
      // Reload the page
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Emergency recovery failed:', error);
      console.log('🆘 Manual recovery needed - please clear browser data and refresh');
    }
  }
}

// Add mobile diagnostics to window for easy access
(window as any).mobileDebug = MobileDebugService.runMobileDiagnostics;
(window as any).mobileFix = MobileDebugService.quickMobileFix;
(window as any).mobileRecovery = MobileDebugService.emergencyMobileRecovery;
(window as any).clearFirebaseCache = () => MobileDebugService.clearFirebaseStorage(); 