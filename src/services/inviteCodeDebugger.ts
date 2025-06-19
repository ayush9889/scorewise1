import { storageService } from './storage';
import { authService } from './authService';
import { cloudStorageService } from './cloudStorageService';
import { auth } from '../config/firebase';

export class InviteCodeDebugger {
  static async debugInviteCode(inviteCode: string): Promise<void> {
    console.log('🔍 === INVITE CODE DEBUG SESSION ===');
    console.log('Input code:', inviteCode);
    
    // Clean the code the same way the system does
    const cleanCode = inviteCode.trim().toUpperCase();
    console.log('Cleaned code:', cleanCode);
    
    try {
      // 1. Check all groups in storage
      const allGroups = await storageService.getAllGroups();
      console.log('📊 Total groups in storage:', allGroups.length);
      
      allGroups.forEach((group, index) => {
        console.log(`Group ${index + 1}:`, {
          name: group.name,
          inviteCode: group.inviteCode,
          id: group.id,
          createdBy: group.createdBy,
          isMatch: group.inviteCode === cleanCode ? '✅ MATCH!' : '❌ no match'
        });
      });
      
      // 2. Try direct lookup
      const directResult = await storageService.getGroupByInviteCode(cleanCode);
      console.log('📊 Direct lookup result:', directResult ? `FOUND: ${directResult.name}` : 'NOT FOUND');
      
      // 3. Try manual search
      const manualResult = allGroups.find(g => g.inviteCode === cleanCode);
      console.log('📊 Manual search result:', manualResult ? `FOUND: ${manualResult.name}` : 'NOT FOUND');
      
      // 4. Check current user state
      const currentUser = authService.getCurrentUser();
      console.log('👤 Current user:', currentUser?.name || 'Not logged in');
      
      // 5. Check localStorage backup
      const backupGroups = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('group_backup_')) {
          try {
            const group = JSON.parse(localStorage.getItem(key) || '{}');
            backupGroups.push(group);
          } catch (e) {
            console.warn('Failed to parse backup group:', key);
          }
        }
      }
      console.log('💾 Backup groups count:', backupGroups.length);
      
    } catch (error) {
      console.error('❌ Debug session failed:', error);
    }
    
    console.log('🔍 === END DEBUG SESSION ===');
  }
  
  static async fixGroupIndexes(): Promise<void> {
    console.log('🔧 === GROUP INDEX FIX SESSION ===');
    
    try {
      const allGroups = await storageService.getAllGroups();
      console.log('🔧 Found', allGroups.length, 'groups to check');
      
      let fixed = 0;
      
      for (const group of allGroups) {
        // Re-save each group to ensure proper indexing
        await storageService.saveGroup(group);
        fixed++;
        console.log(`🔧 Re-indexed group: ${group.name} (${group.inviteCode})`);
      }
      
      console.log('🔧 Fixed', fixed, 'groups');
    } catch (error) {
      console.error('❌ Fix session failed:', error);
    }
    
    console.log('🔧 === END FIX SESSION ===');
  }

  static async testGroupCreation(): Promise<void> {
    console.log('🧪 === GROUP CREATION TEST ===');
    
    try {
      const testGroupName = `Test Group ${Date.now()}`;
      console.log('🧪 Creating test group:', testGroupName);
      
      const group = await authService.createGroup(testGroupName, 'Test group for debugging');
      console.log('✅ Test group created:', group.name, 'with code:', group.inviteCode);
      
      // Wait a moment for indexing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to find it immediately
      const foundGroup = await storageService.getGroupByInviteCode(group.inviteCode);
      console.log('🧪 Immediate lookup result:', foundGroup ? `FOUND: ${foundGroup.name}` : 'NOT FOUND');
      
      if (foundGroup) {
        console.log('✅ Group creation and lookup working correctly!');
      } else {
        console.log('❌ Group creation succeeded but lookup failed - possible indexing issue');
      }
      
    } catch (error) {
      console.error('❌ Test group creation failed:', error);
    }
    
    console.log('🧪 === END TEST ===');
  }

  static async resetDatabase(): Promise<void> {
    console.log('🔄 === DATABASE RESET SESSION ===');
    console.log('⚠️ This will clear all local data and rebuild the database with proper indexes');
    
    try {
      // Get all current data before clearing
      const backupData = {
        groups: await storageService.getAllGroups(),
        players: await storageService.getAllPlayers(),
        matches: await storageService.getAllMatches(),
        users: await storageService.getAllUsers()
      };
      
      console.log('📦 Backing up:', backupData.groups.length, 'groups,', 
                 backupData.players.length, 'players,', 
                 backupData.matches.length, 'matches,',
                 backupData.users.length, 'users');
      
      // Clear all data
      await storageService.clearAllData();
      console.log('🗑️ Cleared all local data');
      
      // Reinitialize database
      await storageService.init();
      console.log('🔄 Reinitialized database with proper indexes');
      
      // Restore data
      console.log('📥 Restoring data...');
      
      // Restore users first
      for (const user of backupData.users) {
        await storageService.saveUser(user);
      }
      console.log('✅ Restored', backupData.users.length, 'users');
      
      // Restore groups
      for (const group of backupData.groups) {
        await storageService.saveGroup(group);
        console.log(`✅ Restored group: ${group.name} (${group.inviteCode})`);
      }
      console.log('✅ Restored', backupData.groups.length, 'groups');
      
      // Restore players
      for (const player of backupData.players) {
        await storageService.savePlayer(player);
      }
      console.log('✅ Restored', backupData.players.length, 'players');
      
      // Restore matches
      for (const match of backupData.matches) {
        await storageService.saveMatch(match);
      }
      console.log('✅ Restored', backupData.matches.length, 'matches');
      
      console.log('🎉 Database reset complete! All data restored with proper indexes.');
      
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      console.log('💡 Try refreshing the page and running troubleshootInviteCode() again');
    }
    
    console.log('🔄 === END RESET SESSION ===');
  }
}

// Make functions available globally for console debugging
(globalThis as any).debugInviteCode = InviteCodeDebugger.debugInviteCode;
(globalThis as any).fixGroupIndexes = InviteCodeDebugger.fixGroupIndexes;
(globalThis as any).testGroupCreation = InviteCodeDebugger.testGroupCreation;
(globalThis as any).resetDatabase = InviteCodeDebugger.resetDatabase;

// Add new global functions for better user experience
(globalThis as any).searchAllDataSources = searchAllDataSources;
(globalThis as any).recoverGroupFromSource = recoverGroupFromSource;
(globalThis as any).showAllAvailableGroups = showAllAvailableGroups;
(globalThis as any).troubleshootInviteCode = async (inviteCode: string) => {
  console.log('🔧 === INVITE CODE TROUBLESHOOTING ===');
  console.log('This will run a comprehensive analysis of your invite code issue...');
  
  // Step 1: Basic debug
  await InviteCodeDebugger.debugInviteCode(inviteCode);
  
  // Step 2: Search all sources
  await searchAllDataSources(inviteCode);
  
  // Step 3: Try recovery
  await recoverGroupFromSource(inviteCode);
  
  // Step 4: Fix indexes if needed
  await InviteCodeDebugger.fixGroupIndexes();
  
  // Step 5: Test the code again
  console.log('🔧 Testing invite code after fixes...');
  try {
    const result = await storageService.getGroupByInviteCode(inviteCode);
    if (result) {
      console.log('✅ SUCCESS! Invite code is now working:', result.name);
    } else {
      console.log('❌ Invite code still not working. The group might not exist.');
      await showAllAvailableGroups();
    }
  } catch (error) {
    console.error('❌ Error testing invite code:', error);
  }
  
  console.log('🔧 === TROUBLESHOOTING COMPLETE ===');
};

export async function searchAllDataSources(inviteCode: string): Promise<void> {
  console.log('🔍 === COMPREHENSIVE DATA SOURCE SEARCH ===');
  console.log('Target code:', inviteCode);
  
  const results = {
    localStorage: null as any,
    indexedDB: null as any,
    cloudStorage: null as any,
    firebaseAuth: null as any,
    cloudDirectQuery: null as any
  };
  
  try {
    // 1. Search localStorage backup
    console.log('🔍 Searching localStorage backup...');
    const backupKeys = Object.keys(localStorage).filter(key => 
      key.includes('group') || key.includes('Group') || key.includes('userGroups')
    );
    console.log('📦 Found localStorage keys:', backupKeys);
    
    for (const key of backupKeys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        const found = Array.isArray(data) 
          ? data.find((item: any) => item.inviteCode === inviteCode)
          : data.inviteCode === inviteCode ? data : null;
        
        if (found) {
          results.localStorage = { key, data: found };
          console.log('✅ Found in localStorage:', key, found.name);
        }
      } catch (error) {
        console.log('❌ Failed to parse localStorage key:', key);
      }
    }
    
    // 2. Search IndexedDB directly
    console.log('🔍 Searching IndexedDB directly...');
    try {
      const allGroups = await storageService.getAllGroups();
      console.log('📊 Total groups in IndexedDB:', allGroups.length);
      
      const found = allGroups.find(group => group.inviteCode === inviteCode);
      if (found) {
        results.indexedDB = found;
        console.log('✅ Found in IndexedDB:', found.name);
      } else {
        console.log('❌ Not found in IndexedDB');
        // Show all codes for reference
        const allCodes = allGroups.map(g => g.inviteCode).filter(Boolean);
        console.log('�� Available codes in IndexedDB:', allCodes);
      }
    } catch (error) {
      console.error('❌ IndexedDB search failed:', error);
    }
    
    // 3. Search cloud storage
    console.log('🔍 Searching cloud storage...');
    try {
      const cloudGroups = await cloudStorageService.getUserGroups();
      console.log('☁️ Total groups in cloud:', cloudGroups.length);
      
      const found = cloudGroups.find(group => group.inviteCode === inviteCode);
      if (found) {
        results.cloudStorage = found;
        console.log('✅ Found in cloud storage:', found.name);
      } else {
        console.log('❌ Not found in cloud storage');
        const allCodes = cloudGroups.map(g => g.inviteCode).filter(Boolean);
        console.log('📋 Available codes in cloud:', allCodes);
      }
    } catch (error) {
      console.error('❌ Cloud storage search failed:', error);
    }
    
    // 4. Check Firebase auth user data
    console.log('🔍 Checking Firebase auth user data...');
    try {
      const authUser = auth.currentUser;
      if (authUser) {
        console.log('👤 Current Firebase user:', authUser.email || authUser.phoneNumber);
        results.firebaseAuth = {
          uid: authUser.uid,
          email: authUser.email,
          phone: authUser.phoneNumber
        };
      } else {
        console.log('❌ No Firebase auth user');
      }
    } catch (error) {
      console.error('❌ Firebase auth check failed:', error);
    }
    
    // 5. Direct Firestore query (bypass cloud service)
    console.log('🔍 Direct Firestore query...');
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      console.log('🔍 Searching Firestore groups collection...');
      const groupsRef = collection(db, 'groups');
      const allGroupsSnapshot = await getDocs(groupsRef);
      
      console.log('📊 Total groups in Firestore:', allGroupsSnapshot.size);
      
      let foundInFirestore = null;
      allGroupsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.inviteCode === inviteCode) {
          foundInFirestore = { id: doc.id, ...data };
        }
      });
      
      if (foundInFirestore) {
        results.cloudDirectQuery = foundInFirestore;
        console.log('✅ Found in Firestore direct query:', foundInFirestore.name);
      } else {
        console.log('❌ Not found in Firestore direct query');
        
        // Show all available codes
        const allCodes: string[] = [];
        allGroupsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.inviteCode) {
            allCodes.push(data.inviteCode);
          }
        });
        console.log('📋 Available codes in Firestore:', allCodes);
      }
    } catch (error) {
      console.error('❌ Direct Firestore query failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Comprehensive search failed:', error);
  }
  
  // Summary
  console.log('📊 === SEARCH RESULTS SUMMARY ===');
  console.log('localStorage:', results.localStorage ? '✅ FOUND' : '❌ Not found');
  console.log('IndexedDB:', results.indexedDB ? '✅ FOUND' : '❌ Not found');
  console.log('Cloud Storage:', results.cloudStorage ? '✅ FOUND' : '❌ Not found');
  console.log('Firebase Auth:', results.firebaseAuth ? '✅ Connected' : '❌ Not connected');
  console.log('Firestore Direct:', results.cloudDirectQuery ? '✅ FOUND' : '❌ Not found');
  
  // If found anywhere, suggest recovery
  const foundSources = Object.entries(results).filter(([, value]) => value !== null);
  if (foundSources.length > 0) {
    console.log('🔧 === RECOVERY SUGGESTIONS ===');
    foundSources.forEach(([source, data]) => {
      console.log(`✅ Found in ${source}:`, data);
    });
    console.log('💡 Consider running: await recoverGroupFromSource("' + inviteCode + '")');
  } else {
    console.log('❌ Group with code "' + inviteCode + '" not found in any data source');
    console.log('💡 This invitation code may have expired or never existed');
  }
  
  console.log('🔍 === END COMPREHENSIVE SEARCH ===');
}

export async function recoverGroupFromSource(inviteCode: string): Promise<void> {
  console.log('🔧 === GROUP RECOVERY SESSION ===');
  console.log('Attempting to recover group with code:', inviteCode);
  
  try {
    // Try to find the group in any source
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('../config/firebase');
    
    const groupsRef = collection(db, 'groups');
    const allGroupsSnapshot = await getDocs(groupsRef);
    
    let foundGroup = null;
    allGroupsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.inviteCode === inviteCode) {
        foundGroup = { id: doc.id, ...data };
      }
    });
    
    if (foundGroup) {
      console.log('✅ Found group in Firestore:', foundGroup.name);
      
      // Save to local storage
      await storageService.saveGroup(foundGroup);
      console.log('✅ Saved to local storage');
      
      // Refresh current groups
      await authService.loadUserGroups();
      console.log('✅ Refreshed user groups');
      
      console.log('🎉 Group recovery completed! You should now be able to use the invitation code.');
    } else {
      console.log('❌ Group not found in any recovery source');
    }
    
  } catch (error) {
    console.error('❌ Recovery failed:', error);
  }
  
  console.log('🔧 === END RECOVERY SESSION ===');
}

export async function showAllAvailableGroups(): Promise<void> {
  console.log('📋 === ALL AVAILABLE GROUPS ===');
  
  try {
    // Get from all sources
    const sources = {
      local: await storageService.getAllGroups(),
      cloud: await cloudStorageService.getUserGroups()
    };
    
    console.log('📊 Groups by source:');
    Object.entries(sources).forEach(([source, groups]) => {
      console.log(`${source}: ${groups.length} groups`);
      groups.forEach(group => {
        console.log(`  - ${group.name} (${group.inviteCode}) - Created: ${new Date(group.createdAt).toLocaleDateString()}`);
      });
    });
    
    // Direct Firestore query
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      const groupsRef = collection(db, 'groups');
      const allGroupsSnapshot = await getDocs(groupsRef);
      
      console.log(`📊 Firestore: ${allGroupsSnapshot.size} groups`);
      allGroupsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.name} (${data.inviteCode}) - Owner: ${data.ownerEmail || 'Unknown'}`);
      });
    } catch (error) {
      console.log('❌ Failed to query Firestore directly');
    }
    
  } catch (error) {
    console.error('❌ Failed to show all groups:', error);
  }
  
  console.log('📋 === END GROUPS LIST ===');
} 