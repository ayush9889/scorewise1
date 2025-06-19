import { storageService } from './storage';
import { authService } from './authService';

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
}

// Make functions available globally for console debugging
(globalThis as any).debugInviteCode = InviteCodeDebugger.debugInviteCode;
(globalThis as any).fixGroupIndexes = InviteCodeDebugger.fixGroupIndexes;
(globalThis as any).testGroupCreation = InviteCodeDebugger.testGroupCreation; 