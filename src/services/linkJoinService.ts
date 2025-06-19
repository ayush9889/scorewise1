import { Group } from '../types/auth';
import { storageService } from './storage';
import { authService } from './authService';
import QRCode from 'qrcode';

export class LinkJoinService {
  
  /**
   * Generate a join link for a group
   */
  static generateJoinLink(group: Group): string {
    const baseUrl = window.location.origin;
    const joinToken = btoa(`${group.id}:${group.inviteCode}:${Date.now()}`);
    return `${baseUrl}/?join=${joinToken}`;
  }
  
  /**
   * Generate QR code data URL for the join link
   */
  static async generateQRCode(joinLink: string): Promise<string> {
    try {
      // Using the professional QRCode library
      const qrDataUrl = await QRCode.toDataURL(joinLink, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }
  

  
  /**
   * Parse join token from URL
   */
  static parseJoinToken(token: string): { groupId: string; inviteCode: string; timestamp: number } | null {
    try {
      const decoded = atob(token);
      const [groupId, inviteCode, timestamp] = decoded.split(':');
      
      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (tokenAge > maxAge) {
        throw new Error('Join link has expired');
      }
      
      return {
        groupId,
        inviteCode,
        timestamp: parseInt(timestamp)
      };
    } catch (error) {
      console.error('Failed to parse join token:', error);
      return null;
    }
  }
  
  /**
   * Join a group using a join token
   */
  static async joinGroupByLink(token: string): Promise<Group> {
    console.log('🔗 Starting join process with token:', token);
    
    // Parse the token
    const parsedToken = this.parseJoinToken(token);
    if (!parsedToken) {
      throw new Error('Invalid join token format');
    }
    
    const { groupId, inviteCode, timestamp } = parsedToken;
    console.log('🔍 Parsed token:', { groupId, inviteCode, timestamp });
    console.log('🔍 Looking for group with ID:', groupId, 'and invite code:', inviteCode);
    
    let group = null;
    
    try {
      // ENHANCED: Try multiple search strategies for better reliability
      console.log('🔍 Strategy 1: Searching by invite code (most reliable)...');
      
      // First, let's get ALL groups and debug what we have
      const allGroups = await storageService.getAllGroups();
      console.log('📊 Total groups in storage:', allGroups.length);
      
      // Log all available groups for comprehensive debugging
      console.log('🔍 === COMPREHENSIVE GROUP DEBUG ===');
      allGroups.forEach((g, index) => {
        console.log(`Group ${index + 1}:`, {
          id: g.id,
          name: g.name,
          inviteCode: g.inviteCode,
          createdBy: g.createdBy,
          members: g.members?.length || 0,
          idMatch: g.id === groupId ? '✅ ID MATCH' : '❌ no id match',
          codeMatch: g.inviteCode === inviteCode ? '✅ CODE MATCH' : '❌ no code match'
        });
      });
      
      // Try to find by invite code first (most reliable)
      group = await storageService.getGroupByInviteCode(inviteCode);
      
      if (group) {
        console.log('✅ Found group by invite code via storage service:', group.name, 'ID:', group.id);
        
        // Verify the group ID matches (extra security)
        if (group.id !== groupId) {
          console.warn('⚠️ Group ID mismatch! Expected:', groupId, 'Found:', group.id);
          // Continue anyway if invite code matches - the invite code is the primary identifier
        }
      } else {
        console.log('❌ Storage service returned null, trying manual search...');
        
        // Manual search through all groups
        group = allGroups.find(g => g.inviteCode === inviteCode) || null;
        
        if (group) {
          console.log('✅ Found group through manual array search:', group.name);
        } else {
          console.log('❌ Manual search also failed');
          
          // Try searching by ID as last resort
          console.log('🔍 Strategy 2: Searching by group ID as fallback...');
          group = allGroups.find(g => g.id === groupId) || null;
          
          if (group) {
            console.log('✅ Found group by ID (but invite code mismatch):', group.name);
            console.warn('⚠️ Security warning: Group found by ID but invite code mismatch');
            console.warn('Expected invite code:', inviteCode, 'Found:', group.inviteCode);
            
            // Don't use this group for security reasons
            group = null;
          }
        }
      }
      
      // Final comprehensive search if still no group found
      if (!group) {
        console.log('🔍 Strategy 3: Ultra-comprehensive search...');
        
        // Try case-insensitive search
        const caseInsensitiveMatch = allGroups.find(g => 
          g.inviteCode && g.inviteCode.toUpperCase() === inviteCode.toUpperCase()
        );
        
        if (caseInsensitiveMatch) {
          console.log('✅ Found group via case-insensitive search:', caseInsensitiveMatch.name);
          group = caseInsensitiveMatch;
        } else {
          // Try trimmed search
          const trimmedMatch = allGroups.find(g => 
            g.inviteCode && g.inviteCode.trim() === inviteCode.trim()
          );
          
          if (trimmedMatch) {
            console.log('✅ Found group via trimmed search:', trimmedMatch.name);
            group = trimmedMatch;
          }
        }
      }
      
    } catch (searchError) {
      console.error('❌ Error during group search:', searchError);
    }
    
    if (!group) {
      console.error('❌ Group not found after all search strategies');
      console.error('🔍 Search criteria:');
      console.error('  - Group ID:', groupId);
      console.error('  - Invite Code:', inviteCode);
      console.error('  - Token Age:', ((Date.now() - timestamp) / (1000 * 60 * 60)).toFixed(1), 'hours');
      
      // Get more debug info
      const allGroups = await storageService.getAllGroups();
      console.error('🔍 Available groups count:', allGroups.length);
      console.error('🔍 Available invite codes:', allGroups.map(g => g.inviteCode).filter(Boolean));
      
      throw new Error(`Failed to join group: Group not found.

🔍 Debug Information:
• Group ID: ${groupId}
• Invite Code: ${inviteCode}
• Token Age: ${((Date.now() - timestamp) / (1000 * 60 * 60)).toFixed(1)} hours
• Available Groups: ${allGroups.length}

📋 Possible Issues:
1. The group may have been deleted
2. The invite code may have changed
3. There may be a data sync issue

🛠️ Try These Solutions:
1. Ask the group admin to create a new link
2. Refresh the page and try again
3. Use the traditional invite code instead: "${inviteCode}"

💡 For admins: Open browser console (F12) and run debugJoinIssues() for detailed analysis.`);
    }
    
    // Verify the invite code matches (security check)
    if (group.inviteCode !== inviteCode) {
      console.error('❌ Security verification failed - invite code mismatch');
      console.error('Expected:', inviteCode, 'Found:', group.inviteCode);
      throw new Error('Invalid join link - security verification failed');
    }
    
    console.log('✅ Group found and verified, proceeding to join...');
    console.log('🏏 Group details:', {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      members: group.members?.length || 0
    });
    
    // Use the existing join logic from authService
    return await authService.joinGroup(inviteCode);
  }
  
  /**
   * Check if current URL has a join token
   */
  static checkForJoinTokenInURL(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('join');
  }
  
  /**
   * Create a shareable message with join link
   */
  static createShareMessage(group: Group, joinLink: string): string {
    return `🏏 Join our cricket group "${group.name}"!

Click this link to join instantly:
${joinLink}

Or copy and visit this link in your browser.

⏰ This link expires in 24 hours for security.
🔒 Safe and secure - no codes to type!`;
  }
  
  /**
   * Share to WhatsApp
   */
  static shareToWhatsApp(group: Group, joinLink: string): void {
    const message = this.createShareMessage(group, joinLink);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }
  
  /**
   * Copy join link to clipboard
   */
  static async copyJoinLinkToClipboard(joinLink: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(joinLink);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = joinLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Debug join link - for troubleshooting
   */
  static async debugJoinLink(joinLink: string): Promise<void> {
    console.log('🔧 === JOIN LINK DEBUG SESSION ===');
    console.log('Input link:', joinLink);
    
    try {
      // Extract token from URL
      const url = new URL(joinLink);
      const token = url.searchParams.get('join');
      
      if (!token) {
        console.error('❌ No join token found in URL');
        return;
      }
      
      console.log('🔍 Extracted token:', token);
      
      // Parse token
      const parsed = this.parseJoinToken(token);
      if (!parsed) {
        console.error('❌ Failed to parse token');
        return;
      }
      
      console.log('✅ Parsed token:', parsed);
      
      // Check if groups exist
      const allGroups = await storageService.getAllGroups();
      console.log('📊 Available groups:', allGroups.length);
      
      allGroups.forEach((group, index) => {
        console.log(`Group ${index + 1}:`, {
          id: group.id,
          name: group.name,
          inviteCode: group.inviteCode,
          matches: group.inviteCode === parsed.inviteCode ? '✅' : '❌'
        });
      });
      
      // Test the actual join process
      try {
        console.log('🧪 Testing join process...');
        await this.joinGroupByLink(token);
        console.log('✅ Join process would succeed');
      } catch (error) {
        console.error('❌ Join process would fail:', error);
      }
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }

  /**
   * Test link generation and parsing
   */
  static async testLinkGeneration(): Promise<void> {
    console.log('🧪 === LINK GENERATION TEST ===');
    
    try {
      // Get all groups
      const allGroups = await storageService.getAllGroups();
      
      if (allGroups.length === 0) {
        console.warn('⚠️ No groups found to test with');
        return;
      }
      
      // Test with first group
      const testGroup = allGroups[0];
      console.log('🎯 Testing with group:', testGroup.name, 'Code:', testGroup.inviteCode);
      
      // Generate link
      const link = this.generateJoinLink(testGroup);
      console.log('🔗 Generated link:', link);
      
      // Parse it back
      const url = new URL(link);
      const token = url.searchParams.get('join');
      
      if (!token) {
        console.error('❌ No token in generated link');
        return;
      }
      
      const parsed = this.parseJoinToken(token);
      console.log('📋 Parsed back:', parsed);
      
      // Verify
      if (parsed && parsed.groupId === testGroup.id && parsed.inviteCode === testGroup.inviteCode) {
        console.log('✅ Link generation and parsing working correctly');
      } else {
        console.error('❌ Link generation or parsing failed');
        console.error('Expected:', { groupId: testGroup.id, inviteCode: testGroup.inviteCode });
        console.error('Got:', parsed);
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
}

export default LinkJoinService;

// Make debugging functions available globally for console testing
(globalThis as any).debugJoinLink = LinkJoinService.debugJoinLink.bind(LinkJoinService);
(globalThis as any).testLinkGeneration = LinkJoinService.testLinkGeneration.bind(LinkJoinService);
(globalThis as any).LinkJoinService = LinkJoinService; 