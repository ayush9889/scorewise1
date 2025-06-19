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
   * ENHANCED: Now supports cross-device group discovery
   */
  static async joinGroupByCode(inviteCode: string): Promise<Group> {
    console.log('🔗 Starting ENHANCED cross-device join process with invite code:', inviteCode);
    
    // Clean the invite code
    const cleanCode = inviteCode.trim().toUpperCase();
    console.log('🧹 Cleaned invite code:', cleanCode);
    
    // Check if user is logged in
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('You must be logged in to join a group');
    }
    
    let targetGroup: Group | null = null;
    
    // STEP 1: Try to find group locally first
    console.log('📱 Step 1: Searching local storage...');
    const localGroups = await storageService.getAllGroups();
    console.log('📊 Total local groups available:', localGroups.length);
    
    targetGroup = localGroups.find(group => group.inviteCode === cleanCode);
    
    if (targetGroup) {
      console.log('✅ Group found locally:', targetGroup.name);
    } else {
      console.log('📱 Group not found locally, checking cloud storage...');
      
      // STEP 2: Search cloud storage for cross-device groups
      try {
        console.log('☁️ Step 2: Searching cloud storage for cross-device groups...');
        
        // Import cloud storage service
        const { cloudStorageService } = await import('./cloudStorageService');
        
        // Check if we can access cloud storage
        const isCloudAvailable = await this.testCloudConnection();
        
        if (isCloudAvailable) {
          // Search for the group in cloud storage by invite code
          targetGroup = await this.searchGroupInCloud(cleanCode);
          
          if (targetGroup) {
            console.log('☁️ Group found in cloud storage:', targetGroup.name);
            
            // Save the group locally for future access
            console.log('📥 Downloading group to local storage...');
            await storageService.saveGroup(targetGroup);
            console.log('✅ Group downloaded and saved locally');
          } else {
            console.log('☁️ Group not found in cloud storage either');
          }
        } else {
          console.log('📵 Cloud storage not available');
        }
      } catch (cloudError) {
        console.warn('⚠️ Cloud search failed:', cloudError);
      }
    }
    
    // STEP 3: If still not found, try user cloud sync
    if (!targetGroup) {
      console.log('🔄 Step 3: Trying user cloud sync to fetch all user groups...');
      try {
        const { userCloudSyncService } = await import('./userCloudSyncService');
        
        // Force load user data from cloud
        await userCloudSyncService.loadUserDataFromCloud();
        console.log('✅ User data loaded from cloud');
        
        // Try searching locally again after cloud sync
        const updatedLocalGroups = await storageService.getAllGroups();
        targetGroup = updatedLocalGroups.find(group => group.inviteCode === cleanCode);
        
        if (targetGroup) {
          console.log('🔄 Group found after cloud sync:', targetGroup.name);
        }
      } catch (syncError) {
        console.warn('⚠️ User cloud sync failed:', syncError);
      }
    }
    
    // Log all available groups for debugging
    const allAvailableGroups = await storageService.getAllGroups();
    console.log('📋 All available groups after search:');
    allAvailableGroups.forEach((group, index) => {
      console.log(`  ${index + 1}. "${group.name}" - Code: "${group.inviteCode}" - Members: ${group.members?.length || 0}`);
    });
    
    if (!targetGroup) {
      console.error('❌ Group not found with invite code:', cleanCode);
      console.error('📋 Available codes:', allAvailableGroups.map(g => g.inviteCode).join(', '));
      
      throw new Error(`Group not found with invite code "${cleanCode}".

🔍 **Cross-Device Search Results:**
📱 Local groups: ${localGroups.length}
☁️ Cloud search: Completed
🔄 User sync: Completed
📋 Total available groups: ${allAvailableGroups.length}
🔑 Available codes: ${allAvailableGroups.map(g => g.inviteCode).join(', ')}

💡 **Possible Solutions:**
1. **Group Creator**: Make sure the group is synced to cloud
   - Open the group on the original device
   - Check internet connection
   - Wait for cloud sync to complete

2. **Group Joiner**: Try these steps:
   - Ensure you have internet connection
   - Try refreshing the page
   - Ask the group admin to share the code again

3. **Both Users**: Make sure you're using the same app URL

🛠️ **Debug Commands:**
- Open console (F12) and run: \`debugJoinIssues()\`
- Or run: \`SimpleGroupShare.searchAllClouds("${cleanCode}")\`

⚠️ **Note**: Groups created on one device need internet connection to be available on other devices.`);
    }
    
    console.log('✅ Group found:', targetGroup.name);
    
    // Check if user is already a member
    const isAlreadyMember = targetGroup.members.some(member => member.userId === currentUser.id);
    if (isAlreadyMember) {
      console.log('ℹ️ User is already a member of this group');
      return targetGroup;
    }
    
    // Continue with the safe join process (same as before)
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
      
      // ENHANCED: Save to cloud immediately for cross-device sync
      console.log('☁️ Step 4: Syncing to cloud for cross-device access...');
      try {
        const { cloudStorageService } = await import('./cloudStorageService');
        const { userCloudSyncService } = await import('./userCloudSyncService');
        
        // Save the updated group and user to cloud
        await Promise.all([
          cloudStorageService.saveGroup(safeGroupCopy),
          cloudStorageService.saveUser(currentUser),
          userCloudSyncService.syncUserDataToCloud(true)
        ]);
        
        console.log('☁️ Cross-device sync completed successfully');
      } catch (error) {
        console.log('☁️ Cloud sync failed (data saved locally):', error);
      }
      
      console.log('🎉 Successfully joined group with cross-device support:', safeGroupCopy.name);
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
  
  /**
   * Test cloud connection availability
   */
  static async testCloudConnection(): Promise<boolean> {
    try {
      const { cloudStorageService } = await import('./cloudStorageService');
      await cloudStorageService.checkConnection();
      return true;
    } catch (error) {
      console.log('☁️ Cloud connection test failed:', error);
      return false;
    }
  }
  
  /**
   * Search for a group in cloud storage by invite code
   */
  static async searchGroupInCloud(inviteCode: string): Promise<Group | null> {
    try {
      console.log('🔍 Searching cloud for group with invite code:', inviteCode);
      
      const { cloudStorageService } = await import('./cloudStorageService');
      
      // Get all groups from cloud storage
      const cloudGroups = await cloudStorageService.getUserGroups();
      console.log('☁️ Found', cloudGroups.length, 'groups in cloud storage');
      
      // Search for group with matching invite code
      const foundGroup = cloudGroups.find(group => group.inviteCode === inviteCode);
      
      if (foundGroup) {
        console.log('✅ Group found in cloud:', foundGroup.name);
        return foundGroup;
      } else {
        console.log('❌ Group not found in cloud storage');
        
        // Try a more comprehensive search by querying Firebase directly
        return await this.searchFirebaseDirectly(inviteCode);
      }
    } catch (error) {
      console.error('❌ Cloud group search failed:', error);
      return null;
    }
  }
  
  /**
   * Direct Firebase search for groups (comprehensive search)
   */
  static async searchFirebaseDirectly(inviteCode: string): Promise<Group | null> {
    try {
      console.log('🔍 Performing direct Firebase search for invite code:', inviteCode);
      
      // Import Firebase modules
      const { db } = await import('../config/firebase');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Search in the main groups collection
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('inviteCode', '==', inviteCode));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const groupDoc = querySnapshot.docs[0];
        const groupData = { id: groupDoc.id, ...groupDoc.data() } as Group;
        console.log('🎯 Group found via direct Firebase search:', groupData.name);
        return groupData;
      }
      
      // Also search in user_groups collection
      const userGroupsRef = collection(db, 'user_groups');
      const userGroupsQuery = query(userGroupsRef);
      const userGroupsSnapshot = await getDocs(userGroupsQuery);
      
      for (const doc of userGroupsSnapshot.docs) {
        const data = doc.data();
        if (data.groupData && data.groupData.inviteCode === inviteCode) {
          console.log('🎯 Group found in user_groups collection:', data.groupData.name);
          return data.groupData as Group;
        }
      }
      
      console.log('❌ Group not found in any Firebase collection');
      return null;
    } catch (error) {
      console.error('❌ Direct Firebase search failed:', error);
      return null;
    }
  }
  
  /**
   * Comprehensive search across all cloud sources
   */
  static async searchAllClouds(inviteCode: string): Promise<void> {
    console.log('🔍 === COMPREHENSIVE CLOUD SEARCH ===');
    console.log('🎯 Searching for invite code:', inviteCode);
    
    try {
      // Test 1: Cloud storage service
      console.log('\n1️⃣ Testing CloudStorageService...');
      const cloudResult = await this.searchGroupInCloud(inviteCode);
      console.log('Result:', cloudResult ? `Found: ${cloudResult.name}` : 'Not found');
      
      // Test 2: User cloud sync service
      console.log('\n2️⃣ Testing UserCloudSyncService...');
      try {
        const { userCloudSyncService } = await import('./userCloudSyncService');
        await userCloudSyncService.loadUserDataFromCloud();
        const localGroupsAfterSync = await storageService.getAllGroups();
        const foundAfterSync = localGroupsAfterSync.find(g => g.inviteCode === inviteCode);
        console.log('Result:', foundAfterSync ? `Found: ${foundAfterSync.name}` : 'Not found');
      } catch (error) {
        console.log('UserCloudSyncService failed:', error.message);
      }
      
      // Test 3: Direct Firebase search
      console.log('\n3️⃣ Testing Direct Firebase Search...');
      const firebaseResult = await this.searchFirebaseDirectly(inviteCode);
      console.log('Result:', firebaseResult ? `Found: ${firebaseResult.name}` : 'Not found');
      
      // Summary
      console.log('\n📊 SEARCH SUMMARY:');
      console.log('- CloudStorageService:', cloudResult ? '✅ Found' : '❌ Not found');
      console.log('- UserCloudSyncService:', '🔄 Completed');
      console.log('- Direct Firebase:', firebaseResult ? '✅ Found' : '❌ Not found');
      
      const allLocalGroups = await storageService.getAllGroups();
      console.log('- Total local groups after search:', allLocalGroups.length);
      
    } catch (error) {
      console.error('❌ Comprehensive search failed:', error);
    }
  }
  
  /**
   * Ensure a group is synced to cloud for cross-device access
   * Call this after creating a group to make it available on other devices
   */
  static async ensureGroupSyncedToCloud(group: Group): Promise<void> {
    console.log('☁️ Ensuring group is synced to cloud for cross-device access:', group.name);
    
    try {
      const { cloudStorageService } = await import('./cloudStorageService');
      const { userCloudSyncService } = await import('./userCloudSyncService');
      
      // Save group to multiple cloud locations for maximum accessibility
      await Promise.all([
        // Method 1: Direct cloud storage
        cloudStorageService.saveGroup(group),
        
        // Method 2: User cloud sync (for user-specific collections)
        userCloudSyncService.syncUserDataToCloud(true),
        
        // Method 3: Force save to main groups collection
        this.saveToMainGroupsCollection(group)
      ]);
      
      console.log('✅ Group synced to cloud successfully - now available cross-device');
      
      // Verify the sync worked
      const cloudGroups = await cloudStorageService.getUserGroups();
      const isInCloud = cloudGroups.some(g => g.id === group.id);
      
      if (isInCloud) {
        console.log('✅ Cloud sync verification passed');
      } else {
        console.warn('⚠️ Group sync verification failed - may not be available cross-device');
      }
      
    } catch (error) {
      console.error('❌ Failed to sync group to cloud:', error);
      throw new Error(`Failed to sync group to cloud: ${error.message}`);
    }
  }
  
  /**
   * Save group directly to main Firebase groups collection
   */
  static async saveToMainGroupsCollection(group: Group): Promise<void> {
    try {
      console.log('💾 Saving group to main Firebase collection...');
      
      const { db } = await import('../config/firebase');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      const groupRef = doc(db, 'groups', group.id);
      
      await setDoc(groupRef, {
        ...group,
        lastUpdated: serverTimestamp(),
        cloudSynced: true,
        cloudSyncTime: Date.now()
      }, { merge: true });
      
      console.log('✅ Group saved to main Firebase collection');
    } catch (error) {
      console.error('❌ Failed to save to main groups collection:', error);
      // Don't throw - this is a backup method
    }
  }
} 