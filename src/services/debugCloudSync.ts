import { db } from '../config/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { authService } from './authService';

export class DebugCloudSync {
  // Test basic Firebase connection
  static async testFirebaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 Testing Firebase connection...');
      
      if (!db) {
        return { success: false, message: 'Firebase db not initialized' };
      }

      // Test write operation
      const testRef = doc(db, 'debug_test', 'connection_test');
      await setDoc(testRef, {
        timestamp: serverTimestamp(),
        message: 'Connection test successful',
        userAgent: navigator.userAgent
      });

      // Test read operation
      const testDoc = await getDoc(testRef);
      if (testDoc.exists()) {
        console.log('✅ Firebase read/write test successful');
        return { 
          success: true, 
          message: 'Firebase connection working properly',
          details: testDoc.data()
        };
      } else {
        return { success: false, message: 'Document write succeeded but read failed' };
      }
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      return { 
        success: false, 
        message: `Firebase connection failed: ${error.message}`,
        details: error
      };
    }
  }

  // Test user sync specifically
  static async testUserSync(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, message: 'No user logged in' };
      }

      const userIdentifier = currentUser.email || currentUser.phone;
      if (!userIdentifier) {
        return { success: false, message: 'User has no email or phone' };
      }

      console.log('🧪 Testing user sync for:', userIdentifier);

      // Test user document write
      const userRef = doc(db, 'debug_users', userIdentifier);
      const testData = {
        userId: currentUser.id,
        name: currentUser.name || 'Unknown',
        email: currentUser.email || null,
        phone: currentUser.phone || null,
        timestamp: serverTimestamp(),
        testMessage: 'User sync test'
      };

      await setDoc(userRef, testData);
      console.log('✅ User document written successfully');

      // Test user document read
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        console.log('✅ User document read successfully');
        return {
          success: true,
          message: `User sync test successful for ${userIdentifier}`,
          details: {
            userIdentifier,
            data: userDoc.data()
          }
        };
      } else {
        return { success: false, message: 'User document write succeeded but read failed' };
      }
    } catch (error) {
      console.error('❌ User sync test failed:', error);
      return {
        success: false,
        message: `User sync test failed: ${error.message}`,
        details: error
      };
    }
  }

  // Check current sync status
  static async checkSyncEnvironment(): Promise<{ status: string; details: any }> {
    const currentUser = authService.getCurrentUser();
    const userIdentifier = currentUser?.email || currentUser?.phone;

    return {
      status: 'Environment Check',
      details: {
        user: {
          exists: !!currentUser,
          id: currentUser?.id,
          name: currentUser?.name,
          email: currentUser?.email,
          phone: currentUser?.phone,
          identifier: userIdentifier,
          isGuest: currentUser?.isGuest
        },
        firebase: {
          dbExists: !!db,
          dbType: typeof db,
          navigator: {
            onLine: navigator.onLine,
            userAgent: navigator.userAgent.substring(0, 100)
          }
        },
        environment: {
          nodeEnv: import.meta.env.NODE_ENV,
          firebaseConfig: {
            hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
            hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
          }
        }
      }
    };
  }

  // Run all tests
  static async runAllTests(): Promise<{ tests: any[]; summary: string }> {
    console.log('🧪 Running complete cloud sync debug tests...');

    const tests = [];

    // Environment check
    const envCheck = await this.checkSyncEnvironment();
    tests.push({ name: 'Environment Check', result: envCheck });

    // Firebase connection test
    const connectionTest = await this.testFirebaseConnection();
    tests.push({ name: 'Firebase Connection', result: connectionTest });

    // User sync test (only if user is logged in)
    if (envCheck.details.user.exists && !envCheck.details.user.isGuest) {
      const userSyncTest = await this.testUserSync();
      tests.push({ name: 'User Sync', result: userSyncTest });
    } else {
      tests.push({ 
        name: 'User Sync', 
        result: { 
          success: false, 
          message: 'Skipped - no logged in user or user is guest' 
        } 
      });
    }

    // Generate summary
    const successful = tests.filter(t => t.result.success).length;
    const total = tests.length;
    const summary = `${successful}/${total} tests passed`;

    console.log('🧪 Debug tests completed:', summary);
    return { tests, summary };
  }
}

// Export for easy access in browser console
if (typeof window !== 'undefined') {
  (window as any).debugCloudSync = DebugCloudSync;
} 