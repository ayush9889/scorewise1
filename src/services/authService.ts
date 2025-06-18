import { User, Group, GroupMember, Invitation } from '../types/auth';
import { storageService } from './storage';
import { firebasePhoneAuthService } from './firebasePhoneAuthService';
import { firebaseAuthService } from './firebaseAuthService';

class AuthService {
  private currentUser: User | null = null;
  private currentGroups: Group[] = [];
  private otpStore: { [phone: string]: { otp: string, expires: number, attempts: number } } = {}; // Fallback for development

  constructor() {
    // NOTE: Removed this.restoreUserSession() from constructor
    // It will be called explicitly after storage is initialized
    console.log('🔐 AuthService initialized with Firebase Phone Auth');
  }

  // CRITICAL: Restore user session from localStorage on app startup
  async restoreUserSession() {
    try {
      console.log('🔄 Restoring user session from localStorage...');
      
      // First try to restore from Firebase Auth
      if (firebaseAuthService.isAvailable()) {
        await firebaseAuthService.restoreUserSession();
        const firebaseUser = firebaseAuthService.getCurrentUser();
        if (firebaseUser) {
          this.currentUser = firebaseUser;
          console.log('✅ User session restored from Firebase:', this.currentUser?.name);
          
          // Restore user's groups
          await this.loadUserGroups();
          console.log('✅ User groups restored:', this.currentGroups.length);
          return;
        }
      }
      
      // Fallback to localStorage
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('✅ User session restored from localStorage:', this.currentUser?.name);
        
        // Restore user's groups
        await this.loadUserGroups();
        console.log('✅ User groups restored:', this.currentGroups.length);
      } else {
        console.log('ℹ️ No stored user session found');
      }
    } catch (error) {
      console.error('❌ Failed to restore user session:', error);
      // Clear corrupted data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentGroups');
    }
  }

  // Phone Authentication Methods
  async signUpWithPhone(phone: string, name: string): Promise<User> {
    // Validate phone number format
    if (!firebasePhoneAuthService.validatePhoneNumber(phone)) {
      throw new Error('Invalid phone number format');
    }

    // Check if user already exists
    const existingUser = await storageService.getUserByPhone(phone);
    if (existingUser) {
      throw new Error('User with this phone number already exists');
    }

    // Create new user (unverified initially)
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: '', // No email for phone signup
      name,
      phone,
      isVerified: false, // Will be verified after OTP
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      groupIds: []
    };

    await storageService.saveUser(user);
    console.log('📱 User created with phone:', phone);
    return user;
  }

  async signInWithPhone(phone: string): Promise<User> {
    const user = await storageService.getUserByPhone(phone);
    if (!user) {
      throw new Error('No account found with this phone number');
    }

    // Update last login
    user.lastLoginAt = Date.now();
    await storageService.saveUser(user);
    
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Load user's groups
    await this.loadUserGroups();
    
    console.log('📱 User signed in with phone:', phone);
    return user;
  }

  async checkUserByPhone(phone: string): Promise<boolean> {
    const user = await storageService.getUserByPhone(phone);
    return !!user;
  }

  // Enhanced OTP Methods with Firebase Phone Auth Integration
  async sendOTP(phone: string, channel: 'sms' | 'call' = 'sms'): Promise<void> {
    // Validate phone number
    if (!firebasePhoneAuthService.validatePhoneNumber(phone)) {
      throw new Error('Invalid phone number format');
    }

    try {
      if (firebasePhoneAuthService.isConfigured()) {
        // Use Firebase Phone Auth in production
        console.log('📱 Sending OTP via Firebase to:', phone);
        const result = await firebasePhoneAuthService.sendOTP(phone);
        
        if (!result.success) {
          throw new Error(result.message);
        }
        
        console.log('✅ OTP sent successfully via Firebase');
      } else {
        // Fallback to development mode
        console.log('⚠️ Development mode: Using mock OTP');
        await this.sendMockOTP(phone);
      }
    } catch (error) {
      console.error('❌ Failed to send OTP:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send OTP');
    }
  }

  async verifyOTP(phone: string, otp: string): Promise<boolean> {
    try {
      if (firebasePhoneAuthService.isConfigured()) {
        // Use Firebase Phone Auth in production
        console.log('🔐 Verifying OTP via Firebase for:', phone);
        const result = await firebasePhoneAuthService.verifyOTP(phone, otp);
        
        if (result.success && result.valid) {
          // Mark user as verified
          await this.markUserAsVerified(phone);
          console.log('✅ OTP verified successfully via Firebase');
          return true;
        } else {
          console.log('❌ OTP verification failed:', result.message);
          return false;
        }
      } else {
        // Fallback to development mode
        console.log('⚠️ Development mode: Using mock OTP verification');
        return await this.verifyMockOTP(phone, otp);
      }
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      throw new Error('OTP verification failed');
    }
  }

  // Development mode fallback methods
  private async sendMockOTP(phone: string): Promise<void> {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + (5 * 60 * 1000); // 5 minutes expiry
    
    // Store OTP with expiry and attempt tracking
    this.otpStore[phone] = {
      otp,
      expires,
      attempts: 0
    };
    
    console.log(`📱 Mock OTP for ${phone}: ${otp} (expires in 5 minutes)`);
    
    // For demo purposes, show OTP in console and alert
    if (import.meta.env.DEV) {
      console.log(`🔐 Demo OTP for ${phone}: ${otp}`);
      // Optional: Show in UI for demo
      setTimeout(() => {
        alert(`Demo OTP for ${phone}: ${otp}\n\nThis is for demo purposes only. In production, this would be sent via SMS.`);
      }, 500);
    }
  }

  private async verifyMockOTP(phone: string, otp: string): Promise<boolean> {
    const storedOtpData = this.otpStore[phone];
    
    if (!storedOtpData) {
      throw new Error('No OTP found for this phone number. Please request a new one.');
    }

    // Check if OTP has expired
    if (Date.now() > storedOtpData.expires) {
      delete this.otpStore[phone];
      throw new Error('OTP has expired. Please request a new one.');
    }

    // Check attempt limit
    if (storedOtpData.attempts >= 3) {
      delete this.otpStore[phone];
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }

    // Verify OTP
    if (storedOtpData.otp === otp) {
      // Mark user as verified
      await this.markUserAsVerified(phone);
      
      // Clean up OTP
      delete this.otpStore[phone];
      
      console.log('✅ Mock OTP verified successfully for:', phone);
      return true;
    } else {
      // Increment attempt count
      storedOtpData.attempts++;
      console.log(`❌ Invalid mock OTP for ${phone}. Attempts: ${storedOtpData.attempts}/3`);
      return false;
    }
  }

  private async markUserAsVerified(phone: string): Promise<void> {
    const user = await storageService.getUserByPhone(phone);
    if (user) {
      user.isVerified = true;
      user.lastLoginAt = Date.now();
      await storageService.saveUser(user);
      
      // Update current user if it's the same
      if (this.currentUser && this.currentUser.phone === phone) {
        this.currentUser.isVerified = true;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      }
    }
  }

  async resendOTP(phone: string, channel: 'sms' | 'call' = 'sms'): Promise<void> {
    // Clear existing OTP and send new one
    if (!firebasePhoneAuthService.isConfigured()) {
      delete this.otpStore[phone];
    } else {
      // Reset Firebase phone auth state for resend
      firebasePhoneAuthService.reset();
    }
    await this.sendOTP(phone, channel);
  }

  // Original Email Authentication Methods (unchanged)
  async signUp(email: string, password: string, name: string, phone?: string): Promise<User> {
    // Check if user already exists
    const existingUser = await storageService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      phone,
      isVerified: true, // Email users are verified by default (in real app, would need email verification)
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      groupIds: []
    };

    await storageService.saveUserPersistent(user);
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    return user;
  }

  async signIn(email: string, password: string): Promise<User> {
    const user = await storageService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    user.lastLoginAt = Date.now();
    await storageService.saveUserPersistent(user);
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Load user's groups
    await this.loadUserGroups();
    
    return user;
  }

  async signOut(): Promise<void> {
    // Sign out from Firebase if available
    if (firebaseAuthService.isAvailable()) {
      try {
        await firebaseAuthService.signOut();
      } catch (error) {
        console.warn('⚠️ Firebase sign out failed:', error);
      }
    }
    
    this.currentUser = null;
    this.currentGroups = [];
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentGroups');
    localStorage.removeItem('standaloneMode'); // Clear standalone mode
  }

  getCurrentUser(): User | null {
    // Always return the current user from memory (already restored on startup)
    return this.currentUser;
  }

  // Group Management with enhanced persistence
  async createGroup(name: string, description?: string): Promise<Group> {
    if (!this.currentUser) {
      throw new Error('Must be logged in to create a group');
    }

    const group: Group = {
      id: `group_${Date.now()}`,
      name,
      description,
      createdBy: this.currentUser.id,
      createdAt: Date.now(),
      members: [{
        userId: this.currentUser.id,
        role: 'admin',
        joinedAt: Date.now(),
        isActive: true,
        permissions: {
          canCreateMatches: true,
          canScoreMatches: true,
          canManageMembers: true,
          canViewStats: true
        }
      }],
      isPublic: false,
      inviteCode: this.generateInviteCode(),
      settings: {
        allowPublicJoin: false,
        requireApproval: true,
        allowGuestScoring: false,
        defaultMatchFormat: 'T20'
      }
    };

    await storageService.saveGroup(group);
    
    // Add group to user's group list
    if (!this.currentUser.groupIds) {
      this.currentUser.groupIds = [];
    }
    this.currentUser.groupIds.push(group.id);
    await storageService.saveUser(this.currentUser);
    
    // CRITICAL: Update localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    
    this.currentGroups.push(group);
    this.saveGroupsToStorage();
    
    return group;
  }

  async joinGroup(inviteCode: string): Promise<Group> {
    if (!this.currentUser) {
      throw new Error('Must be logged in to join a group');
    }

    const group = await storageService.getGroupByInviteCode(inviteCode);
    if (!group) {
      throw new Error('Invalid invite code');
    }

    // Check if user is already a member
    const existingMember = group.members.find(m => m.userId === this.currentUser!.id);
    if (existingMember) {
      throw new Error('Already a member of this group');
    }

    // Add user as member
    group.members.push({
      userId: this.currentUser.id,
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

    await storageService.saveGroup(group);
    
    // Add group to user's group list
    if (!this.currentUser.groupIds) {
      this.currentUser.groupIds = [];
    }
    this.currentUser.groupIds.push(group.id);
    await storageService.saveUser(this.currentUser);
    
    // CRITICAL: Update localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    
    this.currentGroups.push(group);
    this.saveGroupsToStorage();
    
    return group;
  }

  async inviteToGroup(groupId: string, email?: string, phone?: string): Promise<Invitation> {
    if (!this.currentUser) {
      throw new Error('Must be logged in to invite members');
    }

    const group = await storageService.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check permissions
    const member = group.members.find(m => m.userId === this.currentUser!.id);
    if (!member || !member.permissions.canManageMembers) {
      throw new Error('No permission to invite members');
    }

    const invitation: Invitation = {
      id: `invite_${Date.now()}`,
      groupId,
      invitedBy: this.currentUser.id,
      invitedEmail: email,
      invitedPhone: phone,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    await storageService.saveInvitation(invitation);

    // Send OTP if phone is provided
    if (phone) {
      await this.sendOTP(phone);
    }
    // In a real app, send email here if email is provided
    return invitation;
  }

  async getGroupMembers(groupId: string): Promise<User[]> {
    const group = await storageService.getGroup(groupId);
    if (!group) return [];

    const members: User[] = [];
    for (const member of group.members) {
      const user = await storageService.getUser(member.userId);
      if (user) {
        members.push(user);
      }
    }
    return members;
  }

  // Multiple Groups Support with enhanced persistence
  async loadUserGroups(): Promise<void> {
    if (!this.currentUser || !this.currentUser.groupIds) {
      this.currentGroups = [];
      this.saveGroupsToStorage();
      return;
    }

    console.log('🔄 Loading user groups:', this.currentUser.groupIds);

    const groups: Group[] = [];
    for (const groupId of this.currentUser.groupIds) {
      const group = await storageService.getGroup(groupId);
      if (group) {
        groups.push(group);
        console.log('✅ Loaded group:', group.name);
      } else {
        console.warn('⚠️ Group not found:', groupId);
      }
    }
    
    this.currentGroups = groups;
    this.saveGroupsToStorage();
    
    console.log('✅ All user groups loaded:', groups.length);
  }

  getUserGroups(): Group[] {
    return this.currentGroups;
  }

  getCurrentGroup(): Group | null {
    const groups = this.getUserGroups();
    return groups.length > 0 ? groups[0] : null; // Return first group as default
  }

  setCurrentGroup(group: Group): void {
    // Move selected group to first position
    this.currentGroups = this.currentGroups.filter(g => g.id !== group.id);
    this.currentGroups.unshift(group);
    this.saveGroupsToStorage();
  }

  private saveGroupsToStorage(): void {
    localStorage.setItem('currentGroups', JSON.stringify(this.currentGroups));
    console.log('💾 Groups saved to localStorage:', this.currentGroups.length);
  }

  // Standalone Mode Support
  enableStandaloneMode(): void {
    localStorage.setItem('standaloneMode', 'true');
    console.log('🏏 Standalone mode enabled');
  }

  disableStandaloneMode(): void {
    localStorage.removeItem('standaloneMode');
    console.log('🏏 Standalone mode disabled');
  }

  isStandaloneModeEnabled(): boolean {
    return localStorage.getItem('standaloneMode') === 'true';
  }

  // Guest Access
  generateGuestLink(groupId: string): string {
    const baseUrl = window.location.origin;
    const token = btoa(`${groupId}:${Date.now()}`);
    return `${baseUrl}/guest/${token}`;
  }

  async validateGuestAccess(token: string): Promise<Group | null> {
    try {
      const decoded = atob(token);
      const [groupId] = decoded.split(':');
      const group = await storageService.getGroup(groupId);
      
      if (group && group.settings.allowGuestScoring) {
        return group;
      }
      return null;
    } catch {
      return null;
    }
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Utility methods
  canUserScore(groupId: string): boolean {
    if (!this.currentUser) return false;
    
    const group = this.currentGroups.find(g => g.id === groupId);
    if (!group) return false;

    const member = group.members.find(m => m.userId === this.currentUser!.id);
    return member?.permissions.canScoreMatches || false;
  }

  canUserManageGroup(groupId: string): boolean {
    if (!this.currentUser) return false;
    
    const group = this.currentGroups.find(g => g.id === groupId);
    if (!group) return false;

    const member = group.members.find(m => m.userId === this.currentUser!.id);
    return member?.permissions.canManageMembers || false;
  }

  async removeUnverifiedMember(groupId: string, userId: string): Promise<void> {
    const group = await storageService.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    
    const memberIndex = group.members.findIndex(m => m.userId === userId);
    if (memberIndex === -1) throw new Error('Member not found');
    
    const user = await storageService.getUser(userId);
    if (user && !user.isVerified) {
      group.members.splice(memberIndex, 1);
      await storageService.saveGroup(group);
      
      // Remove group from user's group list
      if (user.groupIds) {
        user.groupIds = user.groupIds.filter(gId => gId !== groupId);
        await storageService.saveUser(user);
      }
    } else {
      throw new Error('Cannot remove a verified member');
    }
  }

  async findUserByPhone(phone: string): Promise<User | null> {
    return storageService.getUserByPhone(phone);
  }

  async addUser(user: User): Promise<void> {
    return storageService.saveUser(user);
  }

  async addUserToGroup(groupId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    const group = await storageService.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    // Check if user is already a member
    const existingMember = group.members.find(m => m.userId === userId);
    if (existingMember) {
      throw new Error('User is already a member of this group');
    }

    // Add user to group
    group.members.push({
      userId,
      role,
      joinedAt: Date.now(),
      isActive: true,
      permissions: {
        canCreateMatches: true,
        canScoreMatches: true,
        canManageMembers: role === 'admin',
        canViewStats: true
      }
    });

    await storageService.saveGroup(group);

    // Add group to user's group list
    const user = await storageService.getUser(userId);
    if (user) {
      if (!user.groupIds) {
        user.groupIds = [];
      }
      if (!user.groupIds.includes(groupId)) {
        user.groupIds.push(groupId);
        await storageService.saveUser(user);
      }
    }
  }

  // Get OTP status for debugging (development mode only)
  getOtpStatus(phone: string): { exists: boolean, expires?: number, attempts?: number } {
    if (firebasePhoneAuthService.isConfigured()) {
      return { exists: false }; //  Don't expose Firebase internal state
    }
    
    const otpData = this.otpStore[phone];
    if (!otpData) {
      return { exists: false };
    }
    return {
      exists: true,
      expires: otpData.expires,
      attempts: otpData.attempts
    };
  }

  // Clear expired OTPs (cleanup method for development mode)
  clearExpiredOtps(): void {
    if (firebasePhoneAuthService.isConfigured()) {
      return; // Firebase handles this automatically
    }
    
    const now = Date.now();
    Object.keys(this.otpStore).forEach(phone => {
      if (this.otpStore[phone].expires < now) {
        delete this.otpStore[phone];
      }
    });
  }

  // Check if we're using Firebase Phone Auth (for UI feedback)
  isUsingFirebasePhone(): boolean {
    return firebasePhoneAuthService.isConfigured();
  }

  // Guest Mode Authentication
  signInAsGuest(): User {
    const guestUser: User = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: '',
      name: 'Guest User',
      phone: '',
      isVerified: false,
      isGuest: true,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      groupIds: []
    };

    this.currentUser = guestUser;
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    
    console.log('👤 Guest user signed in:', guestUser.name);
    return guestUser;
  }
}

export const authService = new AuthService();

// Cleanup expired OTPs every 5 minutes (development mode only)
setInterval(() => {
  authService.clearExpiredOtps();
}, 5 * 60 * 1000);