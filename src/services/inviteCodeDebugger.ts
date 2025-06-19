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
          id: group.id,
          inviteCode: group.inviteCode,
          matches: group.inviteCode === cleanCode,
          inviteCodeLength: group.inviteCode?.length || 0
        });
      });
      
      // 2. Try direct database lookup
      const foundGroup = await storageService.getGroupByInviteCode(cleanCode);
      console.log('📊 Direct lookup result:', foundGroup ? foundGroup.name : 'NOT FOUND');
      
      // 3. Manual search
      const manualMatch = allGroups.find(g => g.inviteCode === cleanCode);
      console.log('📊 Manual search result:', manualMatch ? manualMatch.name : 'NOT FOUND');
      
      // 4. Check current user
      const currentUser = authService.getCurrentUser();
      console.log('👤 Current user:', currentUser ? currentUser.name : 'NOT LOGGED IN');
      
      // 5. Check localStorage backup
      const backupGroups = JSON.parse(localStorage.getItem('userGroups') || '[]');
      console.log('💾 Backup groups count:', backupGroups.length);
      
      backupGroups.forEach((group: any, index: number) => {
        if (group.inviteCode === cleanCode) {
          console.log(`🎯 FOUND MATCH IN BACKUP - Group ${index + 1}:`, group.name);
        }
      });
      
    } catch (error) {
      console.error('❌ Debug error:', error);
    }
    
    console.log('🔍 === END DEBUG SESSION ===');
  }
  
  static async checkDatabaseIntegrity(): Promise<void> {
    console.log('🔧 === DATABASE INTEGRITY CHECK ===');
    
    try {
      // Initialize storage if needed
      await storageService.init();
      
      // Check if invite code index exists
      const db = (storageService as any).db;
      if (db) {
        const transaction = db.transaction(['groups'], 'readonly');
        const store = transaction.objectStore('groups');
        const indexNames = Array.from(store.indexNames);
        
        console.log('📊 Available indexes:', indexNames);
        console.log('📊 Has inviteCode index:', indexNames.includes('inviteCode'));
      }
      
      // Test group creation
      const testCode = 'TEST' + Math.random().toString(36).substr(2, 2).toUpperCase();
      console.log('🧪 Testing with code:', testCode);
      
    } catch (error) {
      console.error('❌ Integrity check error:', error);
    }
    
    console.log('🔧 === END INTEGRITY CHECK ===');
  }
  
  static async fixInviteCodeIssues(): Promise<void> {
    console.log('🔧 === FIXING INVITE CODE ISSUES ===');
    
    try {
      // Re-initialize storage
      await storageService.init();
      
      // Get all groups and re-save them to fix indexing
      const allGroups = await storageService.getAllGroups();
      
      for (const group of allGroups) {
        if (group.inviteCode) {
          // Ensure invite code is properly formatted
          group.inviteCode = group.inviteCode.trim().toUpperCase();
          await storageService.saveGroup(group);
          console.log('✅ Fixed group:', group.name, '- Code:', group.inviteCode);
        }
      }
      
      console.log('🔧 Fixed', allGroups.length, 'groups');
      
    } catch (error) {
      console.error('❌ Fix error:', error);
    }
    
    console.log('🔧 === END FIX SESSION ===');
  }
}

// Add to window for easy access in console
declare global {
  interface Window {
    debugInviteCode: (code: string) => Promise<void>;
    checkDatabaseIntegrity: () => Promise<void>;
    fixInviteCodeIssues: () => Promise<void>;
  }
}

if (typeof window !== 'undefined') {
  window.debugInviteCode = InviteCodeDebugger.debugInviteCode;
  window.checkDatabaseIntegrity = InviteCodeDebugger.checkDatabaseIntegrity;
  window.fixInviteCodeIssues = InviteCodeDebugger.fixInviteCodeIssues;
} 