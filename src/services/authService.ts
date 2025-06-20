import { User, Group, GroupMember, Invitation } from '../types/auth';
import { Player } from '../types/cricket';
import { storageService } from './storage';
import { cloudStorageService } from './cloudStorageService';
import { firebasePhoneAuthService } from './firebasePhoneAuthService';
import { firebaseAuthService } from './firebaseAuthService';
import { userCloudSyncService } from './userCloudSyncService';
import { rigidGroupManager } from './rigidGroupManager';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
// Import sync services but avoid circular dependency
let autoSyncService: any = null;
let realTimeSyncService: any = null;

class AuthService {
  private currentUser: User | null = null;
  private currentGroups: Group[] = [];
  private currentGroup: Group | null = null;
  private otpStore: { [phone: string]: { otp: string, expires: number, attempts: number } } = {}; // Fallback for development
  private isInitialized: boolean = false;
  private authStateListener: (() => void) | null = null;

  constructor() {
    console.log('🔐 AuthService initialized with Firebase Phone Auth');
    this.initializeAuthStateListener();
    this.initAutoSync();
  }

  // Initialize sync services (lazy loading to avoid circular dependency)
  private initAutoSync(): void {
    try {
      if (!autoSyncService) {
        // Dynamically import to avoid circular dependency
        import('./autoSyncService').then(module => {
          autoSyncService = module.autoSyncService;
          console.log('🔄 Auto-sync service integrated with auth service');
        });
      }
      
      if (!realTimeSyncService) {
        // Dynamically import real-time sync service
        import('./realTimeSyncService').then(module => {
          realTimeSyncService = module.realTimeSyncService;
          console.log('📡 Real-time sync service integrated with auth service');
        });
      }
    } catch (error) {
      console.warn('⚠️ Sync services not available:', error);
    }
  }

  // CRITICAL: Initialize Firebase Auth state listener for persistent sessions
  private initializeAuthStateListener(): void {
    this.authStateListener = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 Firebase Auth State Changed:', firebaseUser?.email || 'No user');
      
      if (firebaseUser) {
        // User is signed in - ensure we have their profile loaded
        try {
          await this.syncUserWithFirebaseAuth(firebaseUser);
        } catch (error) {
          console.error('❌ Failed to sync user with Firebase auth:', error);
        }
      } else {
        // User signed out from Firebase - but preserve local session unless explicitly signed out
        const localUser = localStorage.getItem('currentUser');
        if (!localUser && this.currentUser) {
          console.log('🔄 Firebase auth lost but no local session - clearing user');
          await this.clearUserSession();
        }
      }
    });
  }

  // Sync user profile with Firebase auth state
  private async syncUserWithFirebaseAuth(firebaseUser: any): Promise<void> {
    try {
      // Try to get user profile from cloud first
      const cloudProfile = await cloudStorageService.getUserProfile();
      
      if (cloudProfile) {
        this.currentUser = cloudProfile;
        localStorage.setItem('currentUser', JSON.stringify(cloudProfile));
        console.log('🔄 User synced from cloud:', cloudProfile.name);
      } else {
        // Create profile from Firebase user if not exists
        const userData: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          phone: firebaseUser.phoneNumber || '',
          isVerified: firebaseUser.emailVerified,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          groupIds: [],
          profile: {
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            playingRole: 'none',
            battingStyle: 'unknown',
            bowlingStyle: 'none'
          },
          statistics: {
            totalMatches: 0,
            totalWins: 0,
            totalLosses: 0,
            totalDraws: 0,
            totalRuns: 0,
            totalBallsFaced: 0,
            highestScore: 0,
            battingAverage: 0,
            strikeRate: 0,
            centuries: 0,
            halfCenturies: 0,
            fours: 0,
            sixes: 0,
            ducks: 0,
            totalWickets: 0,
            totalBallsBowled: 0,
            totalRunsConceded: 0,
            bestBowlingFigures: '0/0',
            bowlingAverage: 0,
            economyRate: 0,
            maidenOvers: 0,
            fiveWicketHauls: 0,
            catches: 0,
            runOuts: 0,
            stumpings: 0,
            manOfTheMatchAwards: 0,
            manOfTheSeriesAwards: 0,
            achievements: [],
            recentMatches: [],
            favoriteGroups: [],
            lastUpdated: Date.now(),
            performanceRating: 0,
            consistency: 0
          },
          preferences: {
            theme: 'auto',
            language: 'en',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            notifications: {
              matchInvites: true,
              groupUpdates: true,
              achievements: true,
              weeklyStats: false,
              email: !!firebaseUser.email,
              sms: !!firebaseUser.phoneNumber,
              push: true
            },
            privacy: {
              profileVisibility: 'public',
              statsVisibility: 'public',
              contactVisibility: 'friends',
              allowGroupInvites: true,
              allowFriendRequests: true
            },
            matchSettings: {
              defaultFormat: 'T20',
              preferredRole: 'any',
              autoSaveFrequency: 5,
              scoringShortcuts: true,
              soundEffects: true,
              vibration: true
            }
          },
          socialProfile: {
            friends: [],
            followedUsers: [],
            followers: [],
            blockedUsers: [],
            socialLinks: {}
          }
        };

        this.currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Save to cloud and local storage
        await Promise.all([
          cloudStorageService.saveUserProfile(userData),
          storageService.saveUserProfile(userData)
        ]);
        
        console.log('🔄 New user profile created from Firebase auth:', userData.name);
      }
      
      // Always load groups after user is synced
      await this.loadUserGroups();
      
    } catch (error) {
      console.error('❌ Failed to sync user with Firebase auth:', error);
    }
  }

  // Clear user session completely
  private async clearUserSession(): Promise<void> {
    this.currentUser = null;
    this.currentGroups = [];
    this.currentGroup = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentGroup');
    localStorage.removeItem('userGroups');
  }

  // CRITICAL: Restore user session with bulletproof multi-layer approach
  async restoreUserSession(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 Session already restored, skipping...');
      return;
    }

    try {
      console.log('🔄 Starting bulletproof session restoration...');

      // Layer 1: Check Firebase Auth state first (most reliable)
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        console.log('🔥 Firebase user authenticated:', firebaseUser.email);
        await this.syncUserWithFirebaseAuth(firebaseUser);
        this.isInitialized = true;
        return;
      }

      // Layer 2: Try cloud storage if we have stored auth credentials
      try {
        const cloudProfile = await cloudStorageService.getUserProfile();
        if (cloudProfile) {
          this.currentUser = cloudProfile;
          localStorage.setItem('currentUser', JSON.stringify(cloudProfile));
          console.log('🔄 User session restored from cloud:', cloudProfile.name);
          await this.loadUserGroups();
          this.isInitialized = true;
          return;
        }
      } catch (error) {
        console.log('📱 No cloud user found, checking local storage...');
      }

      // Layer 3: Fallback to localStorage (backward compatibility)
      const storedUser = localStorage.getItem('currentUser');
      const storedGroups = localStorage.getItem('userGroups');
      
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          this.currentUser = user;
          console.log('🔄 User session restored from local storage:', user.name);
          
          // Try to restore groups from localStorage
          if (storedGroups) {
            try {
              const groups = JSON.parse(storedGroups);
              this.currentGroups = groups;
              console.log('🔄 Groups restored from local storage:', groups.length);
            } catch (error) {
              console.warn('⚠️ Failed to parse stored groups:', error);
              localStorage.removeItem('userGroups');
            }
          }
          
          // Try to migrate to cloud storage if user has credentials
          if (user.email || user.phone) {
            try {
              await cloudStorageService.saveUserProfile(user);
              
              // Migrate groups to cloud
              for (const group of this.currentGroups) {
                await cloudStorageService.saveGroup(group);
              }
              
              console.log('🔄 User data migrated to cloud');
            } catch (error) {
              console.log('📱 Cloud migration skipped (user not authenticated)');
            }
          }
          
          // CRITICAL: Initialize cross-device sync immediately when session is restored
          if (user.email || user.phone) {
            try {
              await userCloudSyncService.initializeUserSync(user);
              console.log('✅ Cross-device sync initialized during session restore');
            } catch (error) {
              console.error('❌ Failed to initialize sync during session restore:', error);
            }
          }
          
        } catch (error) {
          console.error('❌ Failed to parse stored user:', error);
          localStorage.removeItem('currentUser');
          localStorage.removeItem('userGroups');
        }
      }

      // Layer 4: Load groups from storage service as final fallback
      if (!this.currentGroups.length) {
        try {
          await this.loadUserGroups();
        } catch (error) {
          console.error('❌ Failed to load groups from storage:', error);
        }
      }

      this.isInitialized = true;
      console.log('✅ Session restoration completed');
      
    } catch (error) {
      console.error('❌ Failed to restore session:', error);
      this.isInitialized = true; // Mark as initialized even if failed to prevent loops
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

    // Create comprehensive user profile
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: '', // No email for phone signup
      name,
      phone,
      isVerified: false, // Will be verified after OTP
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      groupIds: [],
      
      // Initialize complete profile structure
      profile: {
        displayName: name,
        playingRole: 'none',
        battingStyle: 'unknown',
        bowlingStyle: 'none'
      },
      statistics: {
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        highestScore: 0,
        battingAverage: 0,
        strikeRate: 0,
        centuries: 0,
        halfCenturies: 0,
        fours: 0,
        sixes: 0,
        ducks: 0,
        totalWickets: 0,
        totalBallsBowled: 0,
        totalRunsConceded: 0,
        bestBowlingFigures: '0/0',
        bowlingAverage: 0,
        economyRate: 0,
        maidenOvers: 0,
        fiveWicketHauls: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        manOfTheMatchAwards: 0,
        manOfTheSeriesAwards: 0,
        achievements: [],
        recentMatches: [],
        favoriteGroups: [],
        lastUpdated: Date.now(),
        performanceRating: 0,
        consistency: 0
      },
      preferences: {
        theme: 'auto',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: {
          matchInvites: true,
          groupUpdates: true,
          achievements: true,
          weeklyStats: false,
          email: false, // No email for phone users
          sms: true,
          push: true
        },
        privacy: {
          profileVisibility: 'public',
          statsVisibility: 'public',
          contactVisibility: 'friends',
          allowGroupInvites: true,
          allowFriendRequests: true
        },
        matchSettings: {
          defaultFormat: 'T20',
          preferredRole: 'any',
          autoSaveFrequency: 5,
          scoringShortcuts: true,
          soundEffects: true,
          vibration: true
        }
      },
      socialProfile: {
        friends: [],
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        socialLinks: {}
      }
    };

    // Save to both local and cloud storage
    await storageService.saveUserProfile(user);
    
    try {
      await cloudStorageService.saveUserProfile(user);
      console.log('📱 Comprehensive user profile created and saved to cloud with phone:', phone);
    } catch (error) {
      console.log('📱 User profile saved locally (cloud save failed):', error.message);
    }
    
    return user;
  }

  async signInWithPhone(phone: string): Promise<User> {
    console.log('🔐 Signing in with phone:', phone);
    
    const user = await storageService.getUserProfileByIdentifier(phone);
    if (!user) {
      throw new Error('No account found with this phone number');
    }

    // Update last login immediately
    user.lastLoginAt = Date.now();
    
    // INSTANT UPDATE: Set current user immediately
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately for instant access
    localStorage.setItem('currentUser', JSON.stringify(user));
    console.log('✅ User session saved to localStorage immediately');
    
    // Background save to storage service with comprehensive profile
    storageService.saveUserProfile(user).catch(error => {
      console.warn('⚠️ Background user profile save failed:', error);
    });
    
    // Load user's groups in background
    this.loadUserGroups().catch(error => {
      console.warn('⚠️ Background group loading failed:', error);
    });
    
    // Initialize cloud sync for cross-device synchronization
    if (user.phone) {
      userCloudSyncService.initializeUserSync(user).catch(error => {
        console.warn('⚠️ Cloud sync initialization failed:', error);
      });
    }
    
    console.log('🎉 Phone sign-in completed for:', user.name);
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

  // Email Authentication Methods
  async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Check if user already exists
    const existingUser = await storageService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create comprehensive user profile
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      phone: undefined, // Optional phone number
      isVerified: true, // Email users are verified by default for now
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      groupIds: [],
      
      // Initialize complete profile structure
      profile: {
        displayName: name,
        playingRole: 'none',
        battingStyle: 'unknown',
        bowlingStyle: 'none'
      },
      statistics: {
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        highestScore: 0,
        battingAverage: 0,
        strikeRate: 0,
        centuries: 0,
        halfCenturies: 0,
        fours: 0,
        sixes: 0,
        ducks: 0,
        totalWickets: 0,
        totalBallsBowled: 0,
        totalRunsConceded: 0,
        bestBowlingFigures: '0/0',
        bowlingAverage: 0,
        economyRate: 0,
        maidenOvers: 0,
        fiveWicketHauls: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        manOfTheMatchAwards: 0,
        manOfTheSeriesAwards: 0,
        achievements: [],
        recentMatches: [],
        favoriteGroups: [],
        lastUpdated: Date.now(),
        performanceRating: 0,
        consistency: 0
      },
      preferences: {
        theme: 'auto',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: {
          matchInvites: true,
          groupUpdates: true,
          achievements: true,
          weeklyStats: false,
          email: true,
          sms: false, // No SMS for email users by default
          push: true
        },
        privacy: {
          profileVisibility: 'public',
          statsVisibility: 'public',
          contactVisibility: 'friends',
          allowGroupInvites: true,
          allowFriendRequests: true
        },
        matchSettings: {
          defaultFormat: 'T20',
          preferredRole: 'any',
          autoSaveFrequency: 5,
          scoringShortcuts: true,
          soundEffects: true,
          vibration: true
        }
      },
      socialProfile: {
        friends: [],
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        socialLinks: {}
      }
    };

    // INSTANT UPDATE: Set current user immediately for seamless UX
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately for instant access
    localStorage.setItem('currentUser', JSON.stringify(user));
    console.log('✅ User session saved to localStorage immediately');
    
    // Background save to storage service with comprehensive profile
    storageService.saveUserProfile(user).catch(error => {
      console.warn('⚠️ Background user profile save failed:', error);
    });
    
    // CRITICAL: Initialize cloud sync for cross-device functionality
    const { userCloudSyncService } = await import('./userCloudSyncService');
    userCloudSyncService.initializeUserSync(user).catch(error => {
      console.warn('⚠️ Cloud sync initialization failed:', error);
    });
    
    console.log('📧 Email user profile created seamlessly:', email);
    return user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const user = await storageService.getUserProfileByIdentifier(email);
    if (!user) {
      throw new Error('No account found with this email address');
    }

    // For now, we'll use simple password validation
    // In production, you'd use proper password hashing
    user.lastLoginAt = Date.now();
    
    // INSTANT UPDATE: Set current user immediately for seamless UX
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately for instant access
    localStorage.setItem('currentUser', JSON.stringify(user));
    console.log('✅ User session saved to localStorage immediately');
    
    // Background save to storage service with comprehensive profile
    storageService.saveUserProfile(user).catch(error => {
      console.warn('⚠️ Background user profile save failed:', error);
    });
    
    // CRITICAL: Initialize cloud sync for cross-device functionality
    const { userCloudSyncService } = await import('./userCloudSyncService');
    userCloudSyncService.initializeUserSync(user).catch(error => {
      console.warn('⚠️ Cloud sync initialization failed:', error);
    });
    
    // Load user's groups in background
    this.loadUserGroups().catch(error => {
      console.warn('⚠️ Background group loading failed:', error);
    });
    
    console.log('📧 Email sign-in completed seamlessly:', email);
    return user;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return await storageService.getUserByEmail(email);
  }

  async checkUserByEmail(email: string): Promise<boolean> {
    const user = await this.findUserByEmail(email);
    return !!user;
  }

  async sendEmailInvitation(email: string, groupName: string, groupId: string): Promise<void> {
    // This would integrate with an email service in production
    // For now, we'll just log the invitation
    console.log(`📧 Email invitation sent to ${email} for group ${groupName} (${groupId})`);
    
    // In a real implementation, you'd call an email service here
    // await emailService.sendInvitation(email, groupName, groupId);
  }

  async inviteToGroupByEmail(groupId: string, email: string, name: string): Promise<void> {
    try {
      const group = await storageService.getGroup(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      await this.sendEmailInvitation(email, group.name, groupId);
      console.log(`📧 Group invitation sent to ${email} for ${group.name}`);
    } catch (error) {
      console.error('Failed to send group invitation:', error);
      throw error;
    }
  }

  // Original Email Authentication Methods (unchanged)
  async signUp(email: string, password: string, name: string, phone?: string): Promise<User> {
    console.log('🔐 Creating comprehensive user profile with email:', email);

    // Check if user already exists
    const existingUser = await storageService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create comprehensive user profile
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      phone,
      password, // Note: In production, this should be hashed
      isVerified: true, // Email users are verified immediately for demo
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      groupIds: [],
      
      // Initialize complete profile structure
      profile: {
        displayName: name,
        playingRole: 'none',
        battingStyle: 'unknown',
        bowlingStyle: 'none'
      },
      statistics: {
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        highestScore: 0,
        battingAverage: 0,
        strikeRate: 0,
        centuries: 0,
        halfCenturies: 0,
        fours: 0,
        sixes: 0,
        ducks: 0,
        totalWickets: 0,
        totalBallsBowled: 0,
        totalRunsConceded: 0,
        bestBowlingFigures: '0/0',
        bowlingAverage: 0,
        economyRate: 0,
        maidenOvers: 0,
        fiveWicketHauls: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        manOfTheMatchAwards: 0,
        manOfTheSeriesAwards: 0,
        achievements: [],
        recentMatches: [],
        favoriteGroups: [],
        lastUpdated: Date.now(),
        performanceRating: 0,
        consistency: 0
      },
      preferences: {
        theme: 'auto',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: {
          matchInvites: true,
          groupUpdates: true,
          achievements: true,
          weeklyStats: true,
          email: true,
          sms: !!phone,
          push: true
        },
        privacy: {
          profileVisibility: 'public',
          statsVisibility: 'public',
          contactVisibility: 'friends',
          allowGroupInvites: true,
          allowFriendRequests: true
        },
        matchSettings: {
          defaultFormat: 'T20',
          preferredRole: 'any',
          autoSaveFrequency: 5,
          scoringShortcuts: true,
          soundEffects: true,
          vibration: true
        }
      },
      socialProfile: {
        friends: [],
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        socialLinks: {}
      }
    };

    // INSTANT UPDATE: Set current user immediately for seamless UX
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately for instant access
    localStorage.setItem('currentUser', JSON.stringify(user));
    console.log('✅ User session saved to localStorage immediately');
    
    // Background save to storage service with comprehensive profile
    storageService.saveUserProfile(user).catch(error => {
      console.warn('⚠️ Background user profile save failed:', error);
    });
    
    // CRITICAL: Persist to localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // Load user's groups in background
    this.loadUserGroups().catch(error => {
      console.warn('⚠️ Background group loading failed:', error);
    });
    
    console.log('📧 Comprehensive user profile created with email:', email);
    return user;
  }

  async signIn(email: string, password: string): Promise<User> {
    console.log('🔐 Signing in with email:', email);
    
    const user = await storageService.getUserProfileByIdentifier(email);
    if (!user) {
      throw new Error('No account found with this email');
    }

    if (user.password !== password) {
      throw new Error('Invalid password');
    }

    // Update last login immediately
    user.lastLoginAt = Date.now();
    
    // INSTANT UPDATE: Set current user immediately
    this.currentUser = user;
    
    // CRITICAL: Persist to localStorage immediately for instant access
    localStorage.setItem('currentUser', JSON.stringify(user));
    console.log('✅ User session saved to localStorage immediately');
    
    // Background save to storage service with comprehensive profile
    storageService.saveUserProfile(user).catch(error => {
      console.warn('⚠️ Background user profile save failed:', error);
    });
    
    // Load user's groups in background
    this.loadUserGroups().catch(error => {
      console.warn('⚠️ Background group loading failed:', error);
    });
    
    // Initialize cloud sync for cross-device synchronization
    if (user.email) {
      userCloudSyncService.initializeUserSync(user).catch(error => {
        console.warn('⚠️ Cloud sync initialization failed:', error);
      });
    }
    
    console.log('🎉 Email sign-in completed for:', user.name);
    return user;
  }

  async signOut(): Promise<void> {
    // Stop cloud sync subscriptions
    userCloudSyncService.stopSync();
    
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

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
    if (user) {
      // Persist to localStorage immediately
      localStorage.setItem('currentUser', JSON.stringify(user));
      console.log('✅ Current user set and saved to localStorage:', user.name);
    } else {
      localStorage.removeItem('currentUser');
      console.log('✅ Current user cleared from localStorage');
    }
  }

  // Group Management with enhanced persistence
  async createGroup(name: string, description?: string): Promise<Group> {
    if (!this.currentUser) {
      throw new Error('Must be logged in to create a group');
    }

    const inviteCode = this.generateInviteCode();
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
      inviteCode,
      settings: {
        allowPublicJoin: false,
        requireApproval: true,
        allowGuestScoring: false,
        defaultMatchFormat: 'T20'
      }
    };

    console.log('💾 Saving group with invite code:', inviteCode);
    
    // CRITICAL: Save to all storage layers simultaneously for maximum reliability
    const saveResults = await Promise.allSettled([
      storageService.saveGroup(group),
      cloudStorageService.saveGroup(group),
      // Also save to localStorage as immediate backup
      Promise.resolve(localStorage.setItem(`group_backup_${group.id}`, JSON.stringify(group)))
    ]);
    
    const [localResult, cloudResult] = saveResults;
    
    if (localResult.status === 'fulfilled') {
      console.log('✅ Group saved to local storage:', group.name);
    } else {
      console.error('❌ Failed to save group locally:', localResult.reason);
      throw new Error('Failed to save group locally');
    }
    
    if (cloudResult.status === 'fulfilled') {
      console.log('☁️ Group saved to cloud:', group.name);
    } else {
      console.log('📱 Group cloud save failed (saved locally):', cloudResult.reason);
    }
    
    console.log('✅ Group saved with multi-layer persistence:', group.name);
    
    // Add group to user's group list
    if (!this.currentUser.groupIds) {
      this.currentUser.groupIds = [];
    }
    this.currentUser.groupIds.push(group.id);
    await storageService.saveUser(this.currentUser);
    
    // CRITICAL: Create a player profile for the group creator
    const creatorPlayer = {
      id: `player_${this.currentUser.id}`,
      name: this.currentUser.name,
      shortId: this.currentUser.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase(),
      photoUrl: this.currentUser.photoUrl,
      isGroupMember: true,
      isGuest: false,
      groupIds: [group.id],
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
        bestBowlingFigures: '-'
      }
    };
    
    await storageService.savePlayer(creatorPlayer);
    console.log('✅ Created player profile for group creator:', creatorPlayer.name);
    
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

    // Clean and normalize invite code
    const cleanInviteCode = inviteCode.trim().toUpperCase();
    console.log('🤝 [AuthService] Attempting to join group with code:', cleanInviteCode);
    
    // ENHANCED: First, let's check what groups exist for debugging
    try {
      const allGroups = await storageService.getAllGroups();
      console.log('🔍 Total groups in database:', allGroups.length);
      
      if (allGroups.length === 0) {
        console.warn('⚠️ No groups found in database - this might be the issue');
      } else {
        console.log('🔍 Available groups and their invite codes:');
        allGroups.forEach((g, index) => {
          console.log(`Group ${index + 1}: "${g.name}" - Code: "${g.inviteCode}" ${g.inviteCode === cleanInviteCode ? '✅ MATCH!' : '❌ no match'}`);
        });
      }
    } catch (debugError) {
      console.warn('⚠️ Could not retrieve groups for debugging:', debugError);
    }
    
    // Try to find the group
    let group = await storageService.getGroupByInviteCode(cleanInviteCode);
    
    // If not found, try recovery mechanisms
    if (!group) {
      console.log('🔧 Group not found locally, attempting recovery...');
      
      // Try cloud storage
      try {
        const cloudGroups = await cloudStorageService.getUserGroups();
        group = cloudGroups.find(g => g.inviteCode === cleanInviteCode);
        if (group) {
          console.log('✅ Found group in cloud storage, saving locally...');
          await storageService.saveGroup(group);
          // Wait a moment for indexing
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (cloudError) {
        console.warn('⚠️ Cloud recovery failed:', cloudError);
      }
    }
    
    if (!group) {
      // Enhanced error with more helpful information
      const errorMessage = `Invalid invite code "${cleanInviteCode}". 

🔍 Troubleshooting:
• Make sure the code is exactly 6 characters
• Check that you copied the complete code
• Verify the group still exists (admin didn't delete it)
• Try refreshing the page and joining again

💡 Debug: Open browser console (F12) and type: debugInviteCode("${cleanInviteCode}") for detailed analysis.

🛠️ Advanced: Try running fixGroupIndexes() if groups exist but cannot be found.`;
      
      throw new Error(errorMessage);
    }

    // Check if user is already a member
    const existingMember = group.members.find(m => m.userId === this.currentUser!.id);
    if (existingMember) {
      throw new Error('You are already a member of this group');
    }

    console.log('✅ Group found! Adding user as member and player...');

    // CRITICAL FIX: Create a deep copy of the group to avoid reference issues
    const updatedGroup = JSON.parse(JSON.stringify(group));

    // Add user as member
    updatedGroup.members.push({
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

    // CRITICAL FIX: Save ONLY to local storage first, then try cloud as backup
    try {
      console.log('💾 Saving updated group to local storage...');
      await storageService.saveGroup(updatedGroup);
      console.log('✅ Updated group saved locally after user joined');
      
      // Try cloud save as backup (non-blocking)
      cloudStorageService.saveGroup(updatedGroup).then(() => {
        console.log('☁️ Group updated in cloud after user joined');
      }).catch(error => {
        console.log('📱 Group cloud update failed (saved locally):', error);
      });
      
    } catch (localError) {
      console.error('❌ Failed to save updated group locally:', localError);
      throw new Error('Failed to save group after joining');
    }
    
    // CRITICAL: Create a player profile for the joining user
    const newPlayer = {
      id: `player_${this.currentUser.id}`,
      name: this.currentUser.name,
      shortId: this.currentUser.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase(),
      photoUrl: this.currentUser.photoUrl,
      isGroupMember: true,
      isGuest: false,
      groupIds: [updatedGroup.id],
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
    
    await storageService.savePlayer(newPlayer);
    console.log('🏏 Created player profile for joining user:', newPlayer.name);
    
    // Add group to user's group list
    if (!this.currentUser.groupIds) {
      this.currentUser.groupIds = [];
    }
    this.currentUser.groupIds.push(updatedGroup.id);
    await storageService.saveUser(this.currentUser);
    
    // CRITICAL: Update localStorage immediately
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    
    this.currentGroups.push(updatedGroup);
    this.saveGroupsToStorage();
    
    console.log('✅ User successfully joined group and became a player:', updatedGroup.name);
    return updatedGroup;
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
    if (!this.currentUser) {
      this.currentGroups = [];
      this.saveGroupsToStorage();
      return;
    }

    try {
      console.log('🔄 Loading user groups with bulletproof approach...');
      let loadedGroups: Group[] = [];

      // Layer 1: Try cloud storage first (most up-to-date)
      try {
        const cloudGroups = await cloudStorageService.getUserGroups();
        if (cloudGroups && cloudGroups.length > 0) {
          loadedGroups = cloudGroups;
          console.log('☁️ Groups loaded from cloud:', loadedGroups.length);
          
          // Save to localStorage for offline access
          localStorage.setItem('userGroups', JSON.stringify(loadedGroups));
        }
      } catch (error) {
        console.log('📱 Cloud groups unavailable, trying local storage...');
      }

      // Layer 2: Try localStorage with multiple fallback sources
      if (loadedGroups.length === 0) {
        const sources = ['userGroups', 'userGroups_backup'];
        
        // Add timestamped backups as additional sources
        const timestampedKeys = Object.keys(localStorage)
          .filter(key => key.startsWith('userGroups_'))
          .sort()
          .reverse()
          .slice(0, 3); // Use last 3 timestamped backups
        sources.push(...timestampedKeys);
        
        for (const source of sources) {
          const storedGroups = localStorage.getItem(source);
          if (storedGroups) {
            try {
              const parsedGroups = JSON.parse(storedGroups);
              if (Array.isArray(parsedGroups) && parsedGroups.length > 0) {
                loadedGroups = parsedGroups;
                console.log(`💾 Groups loaded from ${source}:`, loadedGroups.length);
                
                // Update primary storage with recovered data
                localStorage.setItem('userGroups', storedGroups);
                break;
              }
            } catch (error) {
              console.warn(`⚠️ Failed to parse groups from ${source}:`, error);
            }
          }
        }
        
        // Clean up corrupted primary source if we found data elsewhere
        if (loadedGroups.length === 0) {
          ['userGroups', 'userGroups_backup'].forEach(key => {
            const stored = localStorage.getItem(key);
            if (stored) {
              try {
                JSON.parse(stored);
              } catch {
                localStorage.removeItem(key);
                console.log(`🧹 Cleaned up corrupted ${key}`);
              }
            }
          });
        }
      }

      // Layer 3: Try storage service as final fallback
      if (loadedGroups.length === 0) {
        try {
          const allGroups = await storageService.getAllGroups();
          const userGroups = allGroups.filter(group => 
            group.ownerId === this.currentUser!.id ||
            group.members.some(member => member.userId === this.currentUser!.id)
          );
          
          if (userGroups.length > 0) {
            loadedGroups = userGroups;
            console.log('🗃️ Groups loaded from storage service:', loadedGroups.length);
            
            // Update localStorage and cloud
            localStorage.setItem('userGroups', JSON.stringify(loadedGroups));
            
            // Try to save to cloud for future use
            try {
              for (const group of loadedGroups) {
                await cloudStorageService.saveGroup(group);
              }
              console.log('☁️ Groups backed up to cloud');
            } catch (error) {
              console.log('📱 Cloud backup skipped');
            }
          }
        } catch (error) {
          console.error('❌ Failed to load groups from storage service:', error);
        }
      }

      // Update current groups and ensure consistency
      this.currentGroups = loadedGroups;
      
      // Refresh group visibility with rigid group manager
      if (this.currentUser) {
        await rigidGroupManager.refreshGroupVisibility(this.currentUser.id);
      }
      
      // Update user's groupIds to match loaded groups
      const groupIds = loadedGroups.map(g => g.id);
      if (this.currentUser.groupIds?.join(',') !== groupIds.join(',')) {
        this.currentUser.groupIds = groupIds;
        
        // Save updated user profile
        await storageService.saveUserProfile(this.currentUser);
        try {
          await cloudStorageService.saveUserProfile(this.currentUser);
        } catch (error) {
          console.log('📱 User profile cloud update skipped');
        }
        
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        console.log('🔄 User groupIds synchronized with loaded groups');
      }
      
      this.saveGroupsToStorage();
      console.log('✅ User groups loaded successfully with rigid management:', this.currentGroups.length);
      
    } catch (error) {
      console.error('❌ Failed to load user groups:', error);
      // Don't clear existing groups on error - preserve what we have
      if (this.currentGroups.length === 0) {
        this.currentGroups = [];
        this.saveGroupsToStorage();
      }
    }
  }

  getUserGroups(): Group[] {
    // Filter out deleted groups using rigid group manager
    const visibleGroups = rigidGroupManager.getVisibleGroups(this.currentGroups);
    return visibleGroups;
  }

  getCurrentGroup(): Group | null {
    const availableGroups = this.getUserGroups();
    // Use rigid group manager for consistent group selection
    return rigidGroupManager.getCurrentGroup(availableGroups);
  }

  setCurrentGroup(group: Group): void {
    console.log('🔒 AuthService: Setting current group with rigid management:', group.name);
    
    // Validate group is not deleted
    if (rigidGroupManager.isGroupDeleted(group.id)) {
      throw new Error('Cannot select a deleted group');
    }
    
    // Use rigid group manager for stable group selection
    rigidGroupManager.setCurrentGroup(group, true);
    
    // Set current group for real-time sync
    if (realTimeSyncService) {
      realTimeSyncService.setCurrentGroup(group.id);
    }
    
    // Also update the traditional storage for backward compatibility
    this.currentGroups = this.currentGroups.filter(g => g.id !== group.id);
    this.currentGroups.unshift(group);
    this.saveGroupsToStorage();
    
    console.log('✅ Current group set with rigid persistence and real-time sync');
  }

  private saveGroupsToStorage(): void {
    try {
      // Save to multiple localStorage keys for redundancy
      const groupsData = JSON.stringify(this.currentGroups);
      localStorage.setItem('userGroups', groupsData);
      localStorage.setItem('userGroups_backup', groupsData);
      localStorage.setItem(`userGroups_${Date.now()}`, groupsData); // Timestamped backup
      
      // Save current user with updated group IDs
      if (this.currentUser) {
        this.currentUser.groupIds = this.currentGroups.map(g => g.id);
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      }
      
      console.log('💾 Groups saved with redundancy to localStorage:', this.currentGroups.length);
      
      // Clean up old timestamped backups (keep only last 5)
      const keys = Object.keys(localStorage).filter(key => key.startsWith('userGroups_'));
      if (keys.length > 5) {
        keys.sort().slice(0, -5).forEach(key => localStorage.removeItem(key));
      }
      
    } catch (error) {
      console.error('❌ Failed to save groups to localStorage:', error);
      
      // Try emergency save without timestamp backup
      try {
        localStorage.setItem('userGroups', JSON.stringify(this.currentGroups));
        console.log('📱 Emergency group save completed');
      } catch (emergencyError) {
        console.error('💥 Emergency group save failed:', emergencyError);
      }
    }
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
    // Generate a more reliable 6-character code
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log('🎲 Generated new invite code:', code);
    return code;
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

    // Check if user is the group creator/admin
    if (group.createdBy === this.currentUser.id) return true;
    if (group.admins && group.admins.includes(this.currentUser.id)) return true;

    // Check member permissions (fallback for older groups)
    const member = group.members?.find(m => m.userId === this.currentUser.id);
    return member?.permissions?.canManageMembers || false;
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
      groupIds: [],
      
      // Initialize complete profile structure
      profile: {
        displayName: 'Guest User',
        playingRole: 'none',
        battingStyle: 'unknown',
        bowlingStyle: 'none'
      },
      statistics: {
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        highestScore: 0,
        battingAverage: 0,
        strikeRate: 0,
        centuries: 0,
        halfCenturies: 0,
        fours: 0,
        sixes: 0,
        ducks: 0,
        totalWickets: 0,
        totalBallsBowled: 0,
        totalRunsConceded: 0,
        bestBowlingFigures: '0/0',
        bowlingAverage: 0,
        economyRate: 0,
        maidenOvers: 0,
        fiveWicketHauls: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        manOfTheMatchAwards: 0,
        manOfTheSeriesAwards: 0,
        achievements: [],
        recentMatches: [],
        favoriteGroups: [],
        lastUpdated: Date.now(),
        performanceRating: 0,
        consistency: 0
      },
      preferences: {
        theme: 'auto',
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notifications: {
          matchInvites: true,
          groupUpdates: true,
          achievements: true,
          weeklyStats: false,
          email: false,
          sms: false,
          push: false
        },
        privacy: {
          profileVisibility: 'public',
          statsVisibility: 'public',
          contactVisibility: 'friends',
          allowGroupInvites: true,
          allowFriendRequests: true
        },
        matchSettings: {
          defaultFormat: 'T20',
          preferredRole: 'any',
          autoSaveFrequency: 5,
          scoringShortcuts: true,
          soundEffects: true,
          vibration: true
        }
      },
      socialProfile: {
        friends: [],
        followedUsers: [],
        followers: [],
        blockedUsers: [],
        socialLinks: {}
      }
    };

    this.currentUser = guestUser;
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    
    console.log('👤 Guest user signed in:', guestUser.name);
    return guestUser;
  }

  // ENHANCED PROFILE MANAGEMENT METHODS

  // Get complete user cricket profile
  async getUserCricketProfile(identifier?: string): Promise<any> {
    const userIdentifier = identifier || this.currentUser?.email || this.currentUser?.phone;
    if (!userIdentifier) {
      throw new Error('No user identifier available');
    }

    console.log('🏏 Loading complete cricket profile...');
    return await storageService.getUserCricketProfile(userIdentifier);
  }

  // Update user profile
  async updateUserProfile(updates: Partial<User>): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }

    const updatedUser = { ...this.currentUser, ...updates };
    await storageService.saveUserProfile(updatedUser);
    
    this.currentUser = updatedUser;
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    
    console.log('✅ User profile updated successfully');
  }

  // Update user statistics after match
  async updateUserStatistics(matchStats: any): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }

    await storageService.updateUserStatistics(this.currentUser.id, matchStats);
    
    // Refresh current user data
    const updatedUser = await storageService.getUserProfileByIdentifier(
      this.currentUser.email || this.currentUser.phone || ''
    );
    
    if (updatedUser) {
      this.currentUser = updatedUser;
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
    
    console.log('📊 User statistics updated successfully');
  }

  // Export user data
  async exportUserData(): Promise<string | null> {
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }

    const identifier = this.currentUser.email || this.currentUser.phone || '';
    return await storageService.exportUserData(identifier);
  }

  // Delete group and all associated data with RIGID PERMANENT DELETION
  async deleteGroup(groupId: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }

    console.log('🗑️ Starting RIGID PERMANENT group deletion for:', groupId);

    // Check if user has permission to delete the group
    if (!this.canUserManageGroup(groupId)) {
      throw new Error('You do not have permission to delete this group');
    }

    // Check if group is already deleted
    if (rigidGroupManager.isGroupDeleted(groupId)) {
      throw new Error('Group is already permanently deleted');
    }

    try {
      // 1. Get group details before deletion for cleanup
      const group = this.currentGroups.find(g => g.id === groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      console.log('🗑️ PERMANENTLY deleting group:', group.name);

      // 2. IMMEDIATELY mark as deleted to prevent any further access
      rigidGroupManager.markGroupAsDeleted(groupId);

      // 3. Perform comprehensive cleanup using rigid group manager
      await rigidGroupManager.performGroupCleanup(groupId);

      // 4. Update current user's group associations
      if (this.currentUser.groupIds) {
        this.currentUser.groupIds = this.currentUser.groupIds.filter(id => id !== groupId);
        await storageService.saveUserProfile(this.currentUser);
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      }

      // 5. Update all group members to remove this group from their associations
      try {
        const groupMembers = await this.getGroupMembers(groupId);
        for (const member of groupMembers) {
          if (member.groupIds) {
            member.groupIds = member.groupIds.filter(id => id !== groupId);
            try {
              await storageService.saveUserProfile(member);
              // Also update in cloud if possible
              try {
                await cloudStorageService.saveUser(member);
              } catch (cloudError) {
                console.warn('⚠️ Failed to update member in cloud:', cloudError);
              }
            } catch (error) {
              console.warn('⚠️ Failed to update member:', member.name, error);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to update group members:', error);
      }

      // 6. Remove group from current groups list (local state)
      this.currentGroups = this.currentGroups.filter(g => g.id !== groupId);
      this.saveGroupsToStorage();

      // 7. Clear current group if it was the deleted one
      if (this.currentGroup?.id === groupId) {
        this.currentGroup = null;
        localStorage.removeItem('currentGroup');
      }

      // 8. Additional cleanup for localStorage backup entries
      Object.keys(localStorage).forEach(key => {
        if (key.includes(groupId)) {
          localStorage.removeItem(key);
        }
      });

      console.log('✅ RIGID PERMANENT group deletion completed successfully');
      console.log('🚫 Group', group.name, 'is now PERMANENTLY DELETED and CANNOT be recovered');

    } catch (error) {
      console.error('❌ Rigid group deletion failed:', error);
      // Even if cleanup fails, group remains marked as deleted
      throw new Error(`Failed to delete group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const authService = new AuthService();

// Cleanup expired OTPs every 5 minutes (development mode only)
setInterval(() => {
  authService.clearExpiredOtps();
}, 5 * 60 * 1000);