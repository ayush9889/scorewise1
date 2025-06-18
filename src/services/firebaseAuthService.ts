import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { User } from '../types/auth';
import { storageService } from './storage';

class FirebaseAuthService {
  private currentUser: User | null = null;
  private authStateListener: (() => void) | null = null;

  constructor() {
    this.initializeAuthListener();
  }

  // Initialize Firebase Auth state listener
  private initializeAuthListener() {
    if (!auth) {
      console.warn('⚠️ Firebase Auth not available');
      return;
    }

    try {
      this.authStateListener = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          console.log('🔐 Firebase user signed in:', firebaseUser.email);
          await this.handleFirebaseUser(firebaseUser);
        } else {
          console.log('🔐 Firebase user signed out');
          this.currentUser = null;
          localStorage.removeItem('currentUser');
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize auth listener:', error);
    }
  }

  // Convert Firebase user to our User type
  private async handleFirebaseUser(firebaseUser: FirebaseUser): Promise<User> {
    try {
      // Check if user already exists in our storage
      let user = await storageService.getUserByEmail(firebaseUser.email || '');
      
      if (!user) {
        // Create new user from Firebase data with complete profile structure
        user = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          phone: firebaseUser.phoneNumber || undefined,
          photoUrl: firebaseUser.photoURL || undefined,
          isVerified: firebaseUser.emailVerified,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          groupIds: [],
          
          // Initialize complete profile structure
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
              email: true,
              sms: false,
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
        
        // Save complete user profile to storage
        await storageService.saveUserProfile(user);
        console.log('✅ New Firebase user created with complete profile in storage:', user.name);
      } else {
        // Update existing user with latest Firebase data and ensure complete profile
        user.lastLoginAt = Date.now();
        user.isVerified = firebaseUser.emailVerified;
        user.photoUrl = firebaseUser.photoURL || user.photoUrl;
        user.name = firebaseUser.displayName || user.name;
        
        // Ensure complete profile structure exists for existing users
        const completeUser = await storageService.ensureCompleteUserProfile(user);
        
        await storageService.saveUserProfile(completeUser);
        console.log('✅ Existing user updated with complete profile from Firebase:', completeUser.name);
        user = completeUser;
      }
      
      this.currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error('❌ Failed to handle Firebase user:', error);
      throw error;
    }
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<User> {
    if (!auth || !googleProvider) {
      throw new Error('Firebase Auth or Google provider not available. Please check your Firebase configuration.');
    }

    try {
      console.log('🔐 Starting Google sign-in...');
      
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      if (!firebaseUser) {
        throw new Error('No user data received from Google');
      }
      
      console.log('✅ Google sign-in successful:', firebaseUser.email);
      
      // The auth state listener will handle user creation/update
      const user = await this.handleFirebaseUser(firebaseUser);
      
      return user;
    } catch (error) {
      console.error('❌ Google sign-in failed:', error);
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        const authError = error as AuthError;
        
        switch (authError.code) {
          case 'auth/popup-closed-by-user':
            throw new Error('Sign-in was cancelled. Please try again.');
          case 'auth/popup-blocked':
            throw new Error('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
          case 'auth/network-request-failed':
            throw new Error('Network error. Please check your internet connection and try again.');
          case 'auth/too-many-requests':
            throw new Error('Too many sign-in attempts. Please wait a moment and try again.');
          default:
            throw new Error(`Sign-in failed: ${authError.message}`);
        }
      }
      
      throw new Error('An unexpected error occurred during sign-in.');
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    if (!auth) {
      console.warn('⚠️ Firebase Auth not available for sign out');
      this.currentUser = null;
      localStorage.removeItem('currentUser');
      return;
    }

    try {
      await firebaseSignOut(auth);
      this.currentUser = null;
      localStorage.removeItem('currentUser');
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      // Clear local state even if Firebase sign out fails
      this.currentUser = null;
      localStorage.removeItem('currentUser');
      throw error;
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Check if Firebase Auth is available
  isAvailable(): boolean {
    return !!(auth && googleProvider);
  }

  // Get Firebase Auth instance (for advanced usage)
  getFirebaseAuth() {
    return auth;
  }

  // Restore user session from localStorage (fallback)
  async restoreUserSession(): Promise<void> {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser && !this.currentUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('✅ User session restored from localStorage:', this.currentUser?.name);
      }
    } catch (error) {
      console.error('❌ Failed to restore user session:', error);
      localStorage.removeItem('currentUser');
    }
  }

  // Clean up
  destroy() {
    if (this.authStateListener) {
      this.authStateListener();
      this.authStateListener = null;
    }
  }
}

export const firebaseAuthService = new FirebaseAuthService();