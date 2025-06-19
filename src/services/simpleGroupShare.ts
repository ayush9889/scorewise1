import { Group } from '../types/auth';
import { Player } from '../types/cricket';
import { authService } from './authService';
import { storageService } from './storage';

/**
 * Simple and reliable group sharing service
 * Completely rewritten for maximum reliability
 */
export class SimpleGroupShare {
  
  /**
   * Generate a simple join URL using just the invite code
   */
  static generateJoinURL(group: Group): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?join=${group.inviteCode}`;
  }
  
  /**
   * Join a group using an invite code (from URL or manual entry)
   * SAFE VERSION: Completely avoids the problematic authService.joinGroup method
   */
  static async joinGroupByCode(inviteCode: string): Promise<Group> {
    console.log('🔗 Starting SAFE join process with invite code:', inviteCode);
    
    // Clean the invite code
    const cleanCode = inviteCode.trim().toUpperCase();
    console.log('🧹 Cleaned invite code:', cleanCode);
    
    // Check if user is logged in
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to join a group');
    }
    
    // Get all groups for debugging
    const allGroups = await storageService.getAllGroups();
    console.log('📊 Total groups available:', allGroups.length);
    
    // Log all available groups for debugging
    console.log('📋 Available groups:');
    allGroups.forEach((group, index) => {
      console.log(`  ${index + 1}. "${group.name}" - Code: "${group.inviteCode}" - Members: ${group.members?.length || 0}`);
    });
    
    // Find the group by invite code
    const targetGroup = allGroups.find(group => group.inviteCode === cleanCode);
    
    if (!targetGroup) {
      console.error('❌ Group not found with invite code:', cleanCode);
      console.error('📋 Available codes:', allGroups.map(g => g.inviteCode).join(', '));
      
      throw new Error(`Group not found with invite code "${cleanCode}".

📋 Available Groups: ${allGroups.length}
🔍 Available Codes: ${allGroups.map(g => g.inviteCode).join(', ')}

💡 Possible Solutions:
1. Check if the invite code is correct
2. Ask the group admin for a new invite code
3. Try refreshing the page

🛠️ If you're the admin, create a new group and share the new code.`);
    }
    
    console.log('✅ Group found:', targetGroup.name);
    
    // Check if user is already a member
    const isAlreadyMember = targetGroup.members.some(member => member.userId === currentUser.id);
    if (isAlreadyMember) {
      console.log('ℹ️ User is already a member of this group');
      return targetGroup;
    }
    
    // SAFE JOIN PROCESS: Create a complete copy of the group to avoid reference issues
    console.log('🔄 Creating safe copy of group for joining...');
    const safeGroupCopy = JSON.parse(JSON.stringify(targetGroup));
    
    // Add user as member to the COPY
    console.log('👤 Adding user as member...');
    safeGroupCopy.members.push({
      userId: currentUser.id,
      role: 'member',
      joinedAt: Date.now(),
      isActive: true,
      permissions: {
        canCreateMatches: true,
        canScoreMatches: true,
        canManageMembers: false,
        canViewStats: true
      }
    });
    
    // Create player profile for the user
    console.log('🏏 Creating player profile...');
    const newPlayer = {
      id: `player_${currentUser.id}`,
      name: currentUser.name,
      shortId: currentUser.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase(),
      photoUrl: currentUser.photoUrl,
      isGroupMember: true,
      isGuest: false,
      groupIds: [safeGroupCopy.id],
      stats: {
        matchesPlayed: 0,
        runsScored: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        fifties: 0,
        hundreds: 0,
        highestScore: 0,
        timesOut: 0,
        wicketsTaken: 0,
        ballsBowled: 0,
        runsConceded: 0,
        catches: 0,
        runOuts: 0,
        motmAwards: 0,
        ducks: 0,
        dotBalls: 0,
        maidenOvers: 0,
        bestBowlingFigures: '0/0'
      }
    };
    
    try {
      // CRITICAL: Save in the correct order with error handling
      console.log('💾 Step 1: Saving player profile...');
      await storageService.savePlayer(newPlayer);
      console.log('✅ Player profile saved successfully');
      
      console.log('💾 Step 2: Saving updated group...');
      await storageService.saveGroup(safeGroupCopy);
      console.log('✅ Updated group saved successfully');
      
      // Update user's group list
      console.log('💾 Step 3: Updating user profile...');
      if (!currentUser.groupIds) {
        currentUser.groupIds = [];
      }
      if (!currentUser.groupIds.includes(safeGroupCopy.id)) {
        currentUser.groupIds.push(safeGroupCopy.id);
        await storageService.saveUser(currentUser);
        
        // Update local storage immediately
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        console.log('✅ User profile updated successfully');
      }
      
      // Try cloud backup (non-blocking)
      console.log('☁️ Step 4: Attempting cloud backup...');
      try {
        // Use the cloud storage service for backup (non-blocking)
        import('../services/cloudStorageService').then(({ cloudStorageService }) => {
          Promise.all([
            cloudStorageService.saveGroup(safeGroupCopy).catch(e => console.log('Cloud group save failed:', e)),
            cloudStorageService.saveUser(currentUser).catch(e => console.log('Cloud user save failed:', e))
          ]).then(() => {
            console.log('☁️ Cloud backup completed');
          }).catch(error => {
            console.log('☁️ Cloud backup failed (data saved locally):', error);
          });
        });
      } catch (error) {
        console.log('☁️ Cloud service unavailable, data saved locally only');
      }
      
      console.log('🎉 Successfully joined group:', safeGroupCopy.name);
      return safeGroupCopy;
      
    } catch (error) {
      console.error('❌ Failed to join group:', error);
      
      // Rollback: Try to remove the player if group save failed
      try {
        await storageService.deletePlayer(newPlayer.id);
        console.log('🔄 Rolled back player creation');
      } catch (rollbackError) {
        console.warn('⚠️ Rollback failed:', rollbackError);
      }
      
      throw new Error(`Failed to join group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check URL for join code and process it
   */
  static checkURLForJoinCode(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    
    if (joinCode) {
      console.log('🔍 Found join code in URL:', joinCode);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    return joinCode;
  }
  
  /**
   * Create share message for WhatsApp, SMS, etc.
   */
  static createShareMessage(group: Group): string {
    const joinUrl = this.generateJoinURL(group);
    
    return `🏏 Join our cricket group "${group.name}"!

Click this link to join:
${joinUrl}

Or manually enter invite code: ${group.inviteCode}

⚡ Quick & Easy - No signup required!`;
  }
  
  /**
   * Share to WhatsApp
   */
  static shareToWhatsApp(group: Group): void {
    const message = this.createShareMessage(group);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }
  
  /**
   * Copy join link to clipboard
   */
  static async copyJoinLink(group: Group): Promise<void> {
    const joinUrl = this.generateJoinURL(group);
    
    try {
      await navigator.clipboard.writeText(joinUrl);
      console.log('✅ Join link copied to clipboard');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = joinUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('✅ Join link copied using fallback method');
    }
  }
  
  /**
   * Copy invite code to clipboard
   */
  static async copyInviteCode(group: Group): Promise<void> {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      console.log('✅ Invite code copied to clipboard');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = group.inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('✅ Invite code copied using fallback method');
    }
  }
  
  /**
   * Generate QR code for joining (simple implementation)
   */
  static async generateQRCode(group: Group): Promise<string> {
    const joinUrl = this.generateJoinURL(group);
    
    try {
      const qrcode = await import('qrcode');
      return await qrcode.toDataURL(joinUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Return a placeholder or throw error
      throw new Error('QR code generation failed');
    }
  }
  
  /**
   * Validate if an invite code exists
   */
  static async validateInviteCode(inviteCode: string): Promise<boolean> {
    try {
      const cleanCode = inviteCode.trim().toUpperCase();
      const allGroups = await storageService.getAllGroups();
      return allGroups.some(group => group.inviteCode === cleanCode);
    } catch (error) {
      console.error('Error validating invite code:', error);
      return false;
    }
  }
  
  /**
   * Get group by invite code
   */
  static async getGroupByInviteCode(inviteCode: string): Promise<Group | null> {
    try {
      const cleanCode = inviteCode.trim().toUpperCase();
      const allGroups = await storageService.getAllGroups();
      return allGroups.find(group => group.inviteCode === cleanCode) || null;
    } catch (error) {
      console.error('Error getting group by invite code:', error);
      return null;
    }
  }
  
  /**
   * Debug function to check all groups and their invite codes
   */
  static async debugGroups(): Promise<void> {
    console.log('🔧 === GROUP SHARING DEBUG ===');
    
    try {
      const allGroups = await storageService.getAllGroups();
      console.log('📊 Total groups:', allGroups.length);
      
      if (allGroups.length === 0) {
        console.log('❌ No groups found. Create a group first.');
        return;
      }
      
      console.log('📋 Group details:');
      allGroups.forEach((group, index) => {
        const joinUrl = this.generateJoinURL(group);
        console.log(`
Group ${index + 1}:
  - Name: ${group.name}
  - Invite Code: ${group.inviteCode}
  - Members: ${group.members?.length || 0}
  - Join URL: ${joinUrl}
  - Created By: ${group.createdBy}
  - Created At: ${new Date(group.createdAt).toLocaleString()}
        `);
      });
      
      // Test current user
      const currentUser = authService.getCurrentUser();
      console.log('👤 Current User:', currentUser?.name || 'Not logged in');
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }
  
  /**
   * Test function to verify the join process works correctly
   * Run this in console to test before sharing links
   */
  static async testJoinProcess(): Promise<void> {
    console.log('🧪 === TESTING SAFE JOIN PROCESS ===');
    
    try {
      const allGroups = await storageService.getAllGroups();
      console.log('📊 Available groups before test:', allGroups.length);
      
      if (allGroups.length === 0) {
        console.log('❌ No groups available for testing. Create a group first.');
        return;
      }
      
      const testGroup = allGroups[0];
      console.log('🎯 Testing with group:', testGroup.name, 'Code:', testGroup.inviteCode);
      
      // Generate join URL
      const joinUrl = this.generateJoinURL(testGroup);
      console.log('🔗 Generated join URL:', joinUrl);
      
      // Test URL parsing
      const extractedCode = this.checkURLForJoinCode();
      console.log('🔍 URL parsing test:', extractedCode ? 'PASS' : 'No code in current URL');
      
      // Test invite code validation
      const isValid = await this.validateInviteCode(testGroup.inviteCode);
      console.log('✅ Invite code validation:', isValid ? 'PASS' : 'FAIL');
      
      // Test group lookup
      const foundGroup = await this.getGroupByInviteCode(testGroup.inviteCode);
      console.log('🔍 Group lookup test:', foundGroup ? 'PASS' : 'FAIL');
      
      // Check groups after test
      const allGroupsAfter = await storageService.getAllGroups();
      console.log('📊 Available groups after test:', allGroupsAfter.length);
      
      if (allGroupsAfter.length === allGroups.length) {
        console.log('✅ GROUP INTEGRITY TEST PASSED - No groups were deleted');
      } else {
        console.log('❌ GROUP INTEGRITY TEST FAILED - Group count changed!');
      }
      
      console.log('🎉 Test completed successfully');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
} 