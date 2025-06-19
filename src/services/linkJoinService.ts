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
   * Join group using a join link token
   */
  static async joinGroupByLink(token: string): Promise<Group> {
    const parsedToken = this.parseJoinToken(token);
    
    if (!parsedToken) {
      throw new Error('Invalid or expired join link');
    }
    
    const { groupId, inviteCode } = parsedToken;
    
    // Try to find the group by ID first (faster)
    let group = await storageService.getGroup(groupId);
    
    // If not found by ID, try by invite code
    if (!group) {
      group = await storageService.getGroupByInviteCode(inviteCode);
    }
    
    if (!group) {
      throw new Error('Group not found. The group may have been deleted or the link is invalid.');
    }
    
    // Verify the invite code matches (security check)
    if (group.inviteCode !== inviteCode) {
      throw new Error('Invalid join link - security verification failed');
    }
    
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
}

export default LinkJoinService; 