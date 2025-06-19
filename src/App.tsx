import React, { useState, useEffect } from 'react';
import { MatchSetup } from './components/MatchSetup';
import { LiveScorer } from './components/LiveScorer';
import { Dashboard } from './components/Dashboard';
import { AuthModal } from './components/AuthModal';
import { GroupManagement } from './components/GroupManagement';
import { AdminDashboard } from './components/AdminDashboard';
import UserProfileDashboard from './components/UserProfileDashboard';
import { AddPlayerModal } from './components/AddPlayerModal';
import { DetailedScorecardModal } from './components/DetailedScorecardModal';
import { Match, Player } from './types/cricket';
import { User, Group } from './types/auth';
import { storageService } from './services/storage';
import { cloudStorageService } from './services/cloudStorageService';
import { authService } from './services/authService';
import { userCloudSyncService } from './services/userCloudSyncService';
import { StorageCleanup } from './services/storageCleanup';
import { PDFService } from './services/pdfService';
import { Trophy, BarChart3, Play, Award, Users, UserPlus, LogIn, LogOut, Crown, Sparkles, Target, Zap, Shield, Share2, MessageCircle, Cloud, CloudOff, RefreshCw, AlertTriangle, User as UserIcon } from 'lucide-react';
import { MultiGroupDashboard } from './components/MultiGroupDashboard';
import './services/inviteCodeDebugger'; // Debug utilities

type AppState = 'home' | 'auth' | 'group-management' | 'admin-dashboard' | 'user-profile' | 'match-setup' | 'standalone-setup' | 'live-scoring' | 'dashboard' | 'match-complete' | 'multi-group-dashboard';

function App() {
  const [currentState, setCurrentState] = useState<AppState>('home');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [connectionStatus, setConnectionStatus] = useState<{
    online: boolean;
    firebaseWorking: boolean;
    lastSync?: Date;
  }>({ online: navigator.onLine, firebaseWorking: false });
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);

  useEffect(() => {
    initializeApp();
    
    // CRITICAL FIX: Add timeout to prevent infinite loading
    const initTimeout = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⚠️ App initialization taking too long, forcing completion');
        setIsInitialized(true);
      }
    }, 10000); // 10 second timeout
    
    // Cleanup function to ensure final backup when app closes
    const handleBeforeUnload = () => {
      try {
        // Use synchronous operations for beforeunload
        storageService.stopAutoBackup();
        console.log('🔄 Auto-backup stopped before app close');
      } catch (error) {
        console.error('❌ Cleanup failed:', error);
      }
    };

    // Visibility change handler for better app state management
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became inactive - save current state
        try {
          storageService.createBackup().catch(error => {
            console.warn('⚠️ Background backup failed:', error);
          });
        } catch (error) {
          console.warn('⚠️ Visibility change backup failed:', error);
        }
      }
    };

    // Handle online/offline status changes
    const handleOnline = () => {
      console.log('📶 Device came online');
      setConnectionStatus(prev => ({ ...prev, online: true }));
      // Test Firebase connection when coming online
      cloudStorageService.checkConnection().then(status => {
        setConnectionStatus(status);
      }).catch(error => {
        console.warn('Failed to check connection:', error);
      });
    };
    
    const handleOffline = () => {
      console.log('📵 Device went offline');
      setConnectionStatus(prev => ({ ...prev, online: false, firebaseWorking: false }));
    };

    // Add event listeners for app close, visibility change, and online/offline
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Cleanup function
    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      storageService.stopAutoBackup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing ScoreWise app...');
      
      // CRITICAL: Clean up storage quota issues FIRST to prevent QuotaExceededError
      try {
        const quotaInfo = await StorageCleanup.checkStorageQuota();
        console.log('📊 Storage quota check:', `${quotaInfo.percentage.toFixed(1)}% used`);
        
        if (quotaInfo.percentage > 85) {
          console.warn('⚠️ Storage quota high, running emergency cleanup...');
          await StorageCleanup.emergencyCleanup();
          console.log('✅ Emergency storage cleanup completed');
        }
      } catch (cleanupError) {
        console.warn('⚠️ Storage cleanup failed, but continuing:', cleanupError);
      }
      
      // FAST TRACK: Check for existing user session first
      // Initialize storage FIRST before any database operations
      await storageService.init();
      console.log('✅ Storage initialized');

      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          console.log('🚀 INSTANT SESSION RESTORE from localStorage:', user.name);
          
          // Load complete user profile from storage if email/phone exists
          if (user.email || user.phone) {
            try {
              const completeProfile = await storageService.getUserProfileByIdentifier(
                user.email || user.phone
              );
              if (completeProfile) {
                console.log('📊 LOADED COMPLETE USER PROFILE with statistics');
                authService.setCurrentUser(completeProfile);
                setCurrentUser(completeProfile);
              } else {
                authService.setCurrentUser(user);
                setCurrentUser(user);
              }
            } catch (error) {
              console.warn('⚠️ Failed to load complete profile, using cached user:', error);
              authService.setCurrentUser(user);
              setCurrentUser(user);
            }
          } else {
            authService.setCurrentUser(user);
            setCurrentUser(user);
          }
        } catch (error) {
          console.warn('⚠️ Failed to parse stored user, will need fresh login:', error);
          localStorage.removeItem('currentUser');
        }
      }
      
      // Check data integrity and attempt recovery if needed
      const integrity = await storageService.checkDataIntegrity();
      console.log('🔍 Data integrity check:', integrity);
      
      if (!integrity.isHealthy) {
        console.warn('⚠️ Data integrity issues detected:', integrity.issues);
        
        // Attempt to restore from backup if data is corrupted
        const restored = await storageService.restoreFromBackup();
        if (restored) {
          console.log('✅ Data restored from backup');
        } else {
          console.log('ℹ️ No backup available, trying cloud backup...');
          
          // Try to restore from cloud storage backup
          try {
            await cloudStorageService.restoreFromLocalBackup();
            console.log('✅ Data restored from cloud backup');
          } catch (error) {
            console.log('ℹ️ No cloud backup available, starting fresh');
          }
        }
      }
      
      // CRITICAL: Restore full user session after storage is ready
      await authService.restoreUserSession();
      
      // Update user state if it was restored from authService (might be different from localStorage)
      const sessionUser = authService.getCurrentUser();
      if (sessionUser && sessionUser !== currentUser) {
        setCurrentUser(sessionUser);
        console.log('🔄 User session updated from authService:', sessionUser.name);
        
        // CRITICAL: Initialize cross-device sync for the restored user
        if (sessionUser.email || sessionUser.phone) {
          try {
            console.log('🔄 Initializing cross-device sync for restored user...');
            
            // Ensure cloud storage service is aware of the current user
            try {
              const cloudStatus = await cloudStorageService.getCloudSyncStatus();
              console.log('☁️ Cloud storage status:', cloudStatus);
            } catch (error) {
              console.log('📱 Cloud storage not available (user not authenticated)');
            }
            await userCloudSyncService.initializeUserSync(sessionUser);
            console.log('✅ Cross-device sync initialized for restored user');
          } catch (error) {
            console.error('❌ Failed to initialize sync for restored user:', error);
          }
        }
      }
      
      // Set current group if user has groups
      const groups = authService.getUserGroups();
      if (groups.length > 0 && !currentGroup) {
        setCurrentGroup(groups[0]);
        console.log('✅ Current group set:', groups[0].name);
      }
      
      // Check for active/incomplete matches to resume
      await checkForActiveMatch();
      
      // Initialize backup system
      await storageService.startAutoBackup();
      console.log('🔄 Auto-backup system started');
      
      // Initialize cloud storage if online
      if (navigator.onLine) {
        try {
          // Test Firebase connection
          await cloudStorageService.testConnection();
          setConnectionStatus(prev => ({ ...prev, firebaseWorking: true }));
          console.log('☁️ Cloud storage connection verified');
        } catch (error) {
          console.warn('⚠️ Cloud storage connection failed:', error);
          setConnectionStatus(prev => ({ ...prev, firebaseWorking: false }));
        }
      }
      
      // CRITICAL: Ensure sync is properly initialized after storage is ready
      if (sessionUser && (sessionUser.email || sessionUser.phone)) {
        setTimeout(() => {
          userCloudSyncService.initializeUserSync(sessionUser).then(() => {
            console.log('✅ Deferred sync initialization completed');
          }).catch(error => {
            console.error('❌ Failed deferred sync initialization:', error);
          });
        }, 2000); // Give app time to fully initialize first
      }
      
      // FINAL: Ensure cloud data persistence for bulletproof storage
      try {
        await cloudStorageService.ensureDataPersistence();
        console.log('✅ Cloud data persistence ensured');
      } catch (error) {
        console.warn('⚠️ Cloud persistence setup failed:', error);
      }

      console.log('🎉 App initialization completed successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      
      // Try to continue with minimal functionality
      try {
        await storageService.init();
        console.log('✅ Minimal storage initialization successful');
      } catch (criticalError) {
        console.error('💥 Critical initialization failure:', criticalError);
        // Even if storage fails, let the app continue
      }
    } finally {
      setIsInitialized(true);
    }
  };

  const handleAuthSuccess = async () => {
    console.log('🚀 Starting seamless auth success flow...');
    
    // INSTANT UI UPDATE: Get user and update UI immediately
    const user = authService.getCurrentUser();
    console.log('📱 Current user from authService:', user?.name);
    
    // Force React state updates with the latest user data
    setCurrentUser(user);
    setShowAuthModal(false);
    
    // Force a re-render to ensure UI updates immediately
    await new Promise(resolve => {
      // Use React's scheduling to ensure state updates are processed
      setCurrentUser(prev => {
        console.log('🔄 Force updating user state:', user?.name);
        resolve(null);
        return user;
      });
    });
    
    // Optimistic UI: Show home immediately for better UX
    setCurrentState('home');
    
    console.log('✅ UI updated seamlessly for user:', user?.name);
    
    // BACKGROUND OPERATIONS: Load groups in the background without blocking UI
    try {
      // Disable standalone mode when user signs in
      if (isStandaloneMode) {
        authService.disableStandaloneMode();
        setIsStandaloneMode(false);
      }
      
      // Load user groups in the background
      console.log('🔄 Loading user groups in background...');
      await authService.loadUserGroups();
      const groups = authService.getUserGroups();
      
      // Update groups state once loaded
      if (groups.length > 0) {
        setCurrentGroup(groups[0]);
        console.log(`✅ Loaded ${groups.length} groups for user`);
      }
      
      // CRITICAL: Initialize cross-device sync after successful auth
      if (user && (user.email || user.phone)) {
        try {
          console.log('🔄 Initializing cross-device sync after auth...');
          await userCloudSyncService.initializeUserSync(user);
          console.log('✅ Cross-device sync initialized after auth');
        } catch (error) {
          console.error('❌ Failed to initialize sync after auth:', error);
        }
      }
      
    } catch (error) {
      console.error('⚠️ Background group loading failed (non-critical):', error);
      // Don't show error to user as this is background operation
    }
    
    console.log('🎉 Seamless auth success flow completed');
  };

  const handleSignOut = async () => {
    // Stop sync before signing out
    try {
      userCloudSyncService.stopSync();
      console.log('✅ Stopped cross-device sync before sign out');
    } catch (error) {
      console.warn('⚠️ Failed to stop sync before sign out:', error);
    }
    
    await authService.signOut();
    setCurrentUser(null);
    setCurrentGroup(null);
    setIsStandaloneMode(false);
    setCurrentState('home');
  };

  const handleMatchStart = (match: Match) => {
    setCurrentMatch(match);
    setCurrentState('live-scoring');
    setActiveMatch(match); // Set as active match when started
  };

  const handleMatchComplete = (match: Match) => {
    // Save completed match to local storage
    try {
      storageService.saveMatch(match);
      console.log('✅ Completed match saved to local storage');
      
      // Also try to save to cloud if user is signed in
      if (currentUser && connectionStatus.firebaseWorking) {
        cloudStorageService.saveMatch(match).catch(error => {
          console.warn('⚠️ Failed to save match to cloud:', error);
        });
      }
    } catch (error) {
      console.error('❌ Failed to save completed match to local storage:', error);
    }
    
    setCurrentMatch(match);
    setCurrentState('match-complete');
    setActiveMatch(null); // Clear active match when completed
  };

  const handleResumeMatch = (match: Match) => {
    setCurrentMatch(match);
    setCurrentState('live-scoring');
    setActiveMatch(null); // Clear active match since it's now being resumed
  };

  const handleBackToHome = () => {
    setCurrentState('home');
    setCurrentMatch(null);
  };

  const handlePlayerAdded = async (player: Player) => {
    // Refresh any necessary data
    console.log('Player added:', player);
  };

  const handleStandaloneMode = () => {
    authService.enableStandaloneMode();
    setIsStandaloneMode(true);
    setCurrentState('standalone-setup');
  };

  const checkForActiveMatch = async () => {
    try {
      const matches = await storageService.getMatches();
      // Find the most recent incomplete match
      const incompleteMatch = matches
        .filter(match => !match.isCompleted)
        .sort((a, b) => b.startTime - a.startTime)[0];
      
      if (incompleteMatch) {
        setActiveMatch(incompleteMatch);
        console.log('📊 Found active match to resume:', incompleteMatch.team1.name, 'vs', incompleteMatch.team2.name);
      }
    } catch (error) {
      console.error('❌ Error checking for active matches:', error);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-500 border-t-transparent mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full h-20 w-20 border-4 border-transparent border-r-purple-400 animate-pulse"></div>
          </div>
          <p className="text-purple-200 text-lg font-medium">Initializing ScoreWise...</p>
        </div>
      </div>
    );
  }

  if (currentState === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 pt-8 pb-6 px-6">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-xl">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-bold text-xl">ScoreWise</span>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className={`p-2 rounded-lg ${connectionStatus.online ? 'text-green-400' : 'text-red-400'}`}>
                {connectionStatus.firebaseWorking ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
              </div>
              
              <button
                onClick={() => setShowAddPlayerModal(true)}
                className="p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 border border-white/20"
                title="Add Player"
              >
                <UserPlus className="w-5 h-5 text-white" />
              </button>
              
              {currentUser ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setCurrentState('user-profile')}
                    className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300"
                    title="My Cricket Profile"
                  >
                    <UserIcon className="w-5 h-5 text-white" />
                  </button>
                  
                  <button
                    onClick={() => setCurrentState('admin-dashboard')}
                    className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300"
                    title="Admin Dashboard"
                  >
                    <Crown className="w-5 h-5 text-white" />
                  </button>
                  
                  <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      {currentUser.photoUrl ? (
                        <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <span className="text-white font-semibold text-sm">
                          {currentUser.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-white text-sm font-medium hidden sm:block">{currentUser.name}</span>
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 border border-white/20"
                    title="Sign Out"
                  >
                    <LogOut className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('signin');
                    setShowAuthModal(true);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300 font-medium text-white"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Connection Status Banner */}
        {!connectionStatus.online && (
          <div className="relative z-10 mx-6 mb-4">
            <div className="bg-orange-100/20 backdrop-blur-sm border border-orange-400/30 rounded-xl p-4 max-w-6xl mx-auto">
              <div className="flex items-center text-orange-200">
                <CloudOff className="w-5 h-5 mr-2" />
                <span className="text-sm">You're offline - matches will sync when connection is restored</span>
              </div>
            </div>
          </div>
        )}

        {/* Guest Mode Banner */}
        {currentUser?.isGuest && (
          <div className="relative z-10 mx-6 mb-4">
            <div className="bg-blue-100/20 backdrop-blur-sm border border-blue-400/30 rounded-xl p-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between text-blue-200">
                                 <div className="flex items-center">
                   <UserIcon className="w-5 h-5 mr-2" />
                   <span className="text-sm">Guest Mode: Explore all features. Your data is saved locally on this device.</span>
                 </div>
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setShowAuthModal(true);
                  }}
                  className="px-4 py-2 bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standalone Mode Banner */}
        {isStandaloneMode && (
          <div className="relative z-10 mx-6 mb-4">
            <div className="bg-blue-100/20 backdrop-blur-sm border border-blue-400/30 rounded-xl p-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between text-blue-200">
                <div className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  <span className="text-sm">Standalone Mode: Matches saved locally, won't count in group records</span>
                </div>
                <button
                  onClick={() => {
                    authService.disableStandaloneMode();
                    setIsStandaloneMode(false);
                  }}
                  className="text-blue-300 hover:text-blue-100 text-sm underline"
                >
                  Disable
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resume Match Banner */}
        {activeMatch && (
          <div className="relative z-10 mx-6 mb-6">
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-400/30 rounded-xl p-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-green-500 p-3 rounded-full">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-green-100 text-lg font-semibold mb-1">Resume Match</h3>
                    <p className="text-green-200 text-sm">
                      {activeMatch.team1.name} vs {activeMatch.team2.name} • 
                      {activeMatch.currentInnings === 1 ? 'First' : 'Second'} innings in progress
                    </p>
                    <p className="text-green-300 text-xs mt-1">
                      Started {new Date(activeMatch.startTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleResumeMatch(activeMatch)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all duration-300 hover:scale-105 flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="relative z-10 px-6 pb-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-white text-sm font-medium">Premium Cricket Scoring</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                Score Like a
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Pro</span>
              </h1>
              
              <p className="text-xl text-purple-200 mb-8 max-w-2xl mx-auto leading-relaxed">
                The ultimate cricket scoring app for community matches. Fast, accurate, and beautifully designed with cloud backup.
              </p>
              
              {currentUser && currentGroup && (
                <div className="inline-flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-8 border border-white/20">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm">Signed in as <span className="font-semibold">{currentUser.name}</span></span>
                  <span className="text-purple-300 text-sm">•</span>
                  <span className="text-purple-300 text-sm">{currentGroup.name}</span>
                  {connectionStatus.firebaseWorking && (
                    <>
                      <span className="text-purple-300 text-sm">•</span>
                      <Cloud className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-300 text-sm">Cloud Sync</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Main Actions Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
              <button
                onClick={() => {
                  if (currentUser && currentGroup) {
                    // User is signed in and has a group - proceed to match setup
                    setCurrentState('match-setup');
                  } else if (currentUser?.isGuest) {
                    // For guest users, create a temporary group and proceed to match setup
                    const tempGroup = {
                      id: `guest_group_${Date.now()}`,
                      name: 'Guest Group',
                      description: 'Temporary group for guest user',
                      createdBy: currentUser.id,
                      createdAt: Date.now(),
                      members: [{
                        userId: currentUser.id,
                        role: 'admin' as const,
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
                      inviteCode: '',
                      settings: {
                        allowPublicJoin: false,
                        requireApproval: false,
                        allowGuestScoring: true,
                        defaultMatchFormat: 'T20'
                      }
                    };
                    setCurrentGroup(tempGroup);
                    authService.setCurrentGroup(tempGroup);
                    setCurrentState('match-setup');
                  } else if (currentUser && !currentGroup) {
                    // User is signed in but has no group - take them to group management
                    setCurrentState('group-management');
                  } else {
                    // User is not signed in - show sign in modal
                    setAuthMode('signin');
                    setShowAuthModal(true);
                  }
                }}
                className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-purple-400/50 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {currentUser?.isGuest ? 'Start Match' : 'Group Match'}
                  </h3>
                  <p className="text-purple-200 mb-4">
                    {currentUser?.isGuest 
                      ? 'Start scoring a match in guest mode' 
                      : 'Start scoring a match with your cricket group'
                    }
                  </p>
                  {!currentUser && (
                    <div className="inline-flex items-center space-x-2 text-orange-300 text-sm">
                      <Shield className="w-4 h-4" />
                      <span>Sign in required</span>
                    </div>
                  )}
                  {currentUser && !currentUser.isGuest && !currentGroup && (
                    <div className="inline-flex items-center space-x-2 text-orange-300 text-sm">
                      <Users className="w-4 h-4" />
                      <span>Join a group first</span>
                    </div>
                  )}
                  {currentUser?.isGuest && (
                    <div className="inline-flex items-center space-x-2 text-blue-300 text-sm">
                      <UserIcon className="w-4 h-4" />
                      <span>Guest mode available</span>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={handleStandaloneMode}
                className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-orange-400/50 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Quick Match</h3>
                  <p className="text-purple-200 mb-4">Score without groups - perfect for casual games</p>
                  <div className="inline-flex items-center space-x-2 text-orange-300 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Personal stats only</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentState('dashboard')}
                className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-blue-400/50 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Dashboard</h3>
                  <p className="text-purple-200">View comprehensive stats, leaderboards & match history with cloud sync</p>
                </div>
              </button>

              {currentUser && (
                <>
                  <button
                    onClick={() => setCurrentState('admin-dashboard')}
                    className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-yellow-400/50 hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Crown className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">Admin Panel</h3>
                      <p className="text-purple-200">Manage groups & view personal statistics</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setCurrentState('multi-group-dashboard')}
                    className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-purple-400/50 hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">Manage Groups</h3>
                      <p className="text-purple-200">Create, join & switch between multiple cricket groups</p>
                    </div>
                  </button>
                </>
              )}

              {!currentUser && (
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setShowAuthModal(true);
                  }}
                  className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-green-400/50 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Join Community</h3>
                    <p className="text-purple-200">Create account to manage groups & track statistics</p>
                  </div>
                </button>
              )}
            </div>

            {/* Features Section */}
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Built for Community Cricket</h2>
                <p className="text-xl text-purple-200">Everything you need for local matches, tournaments & practice games</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="group bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-purple-400/50">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">No Apps Required</h3>
                  <p className="text-purple-200 leading-relaxed">Run directly in your browser. No downloads, no installations, instant access</p>
                </div>

                <div className="group bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-blue-400/50">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Cloud className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">Cloud Backup & Resume</h3>
                  <p className="text-purple-200 leading-relaxed">Never lose your match data. Resume scoring from any device, anywhere</p>
                </div>

                <div className="group bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-orange-400/50">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">Flexible Scoring</h3>
                  <p className="text-purple-200 leading-relaxed">Score with groups for team records, or standalone for personal tracking</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-16">
              <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-purple-200 text-sm font-medium">Perfect for club matches, tournaments & practice games</span>
              </div>
              {connectionStatus.lastSync && (
                <div className="mt-4 text-sm text-purple-300">
                  Last synced: {connectionStatus.lastSync.toLocaleString()}
                </div>
              )}
              <div className="mt-2 text-xs text-purple-400">
                🔄 Auto-backup active • 💾 Data protected • 🔒 Persistent storage
              </div>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          initialMode={authMode}
        />

        {/* Add Player Modal */}
        <AddPlayerModal
          isOpen={showAddPlayerModal}
          onClose={() => setShowAddPlayerModal(false)}
          onPlayerAdded={handlePlayerAdded}
          groupId={currentGroup?.id}
        />
      </div>
    );
  }

  if (currentState === 'admin-dashboard') {
    return <AdminDashboard onBack={handleBackToHome} />;
  }

  if (currentState === 'user-profile') {
    return <UserProfileDashboard onBack={handleBackToHome} />;
  }

  if (currentState === 'group-management') {
    return <GroupManagement onBack={handleBackToHome} />;
  }

  if (currentState === 'match-setup') {
    return <MatchSetup onMatchStart={handleMatchStart} />;
  }

  if (currentState === 'standalone-setup') {
    return <MatchSetup onMatchStart={handleMatchStart} isStandalone={true} />;
  }

  if (currentState === 'live-scoring' && currentMatch) {
    return (
      <LiveScorer
        match={currentMatch}
        onMatchComplete={handleMatchComplete}
        onBack={handleBackToHome}
      />
    );
  }

  if (currentState === 'dashboard') {
    return <Dashboard onBack={handleBackToHome} onResumeMatch={handleResumeMatch} />;
  }

  if (currentState === 'match-complete' && currentMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-6 text-center">Match Complete!</h1>
          
          {/* Standalone Mode Notice */}
          {isStandaloneMode && (
            <div className="bg-orange-500/20 border border-orange-400/30 rounded-xl p-4 mb-6">
              <div className="flex items-center text-orange-200">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Standalone Match - Personal stats only</span>
              </div>
            </div>
          )}
          
          {/* Match Result */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
            <div className="text-xl font-bold text-white mb-6 text-center">
              {currentMatch.team1.name} vs {currentMatch.team2.name}
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                <span className="text-purple-200 font-medium">{currentMatch.team1.name}</span>
                <span className="text-white font-bold text-lg">
                  {currentMatch.team1.score}/{currentMatch.team1.wickets}
                </span>
                <span className="text-purple-300 text-sm">
                  ({currentMatch.team1.overs}.{currentMatch.team1.balls})
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                <span className="text-purple-200 font-medium">{currentMatch.team2.name}</span>
                <span className="text-white font-bold text-lg">
                  {currentMatch.team2.score}/{currentMatch.team2.wickets}
                </span>
                <span className="text-purple-300 text-sm">
                  ({currentMatch.team2.overs}.{currentMatch.team2.balls})
                </span>
              </div>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border border-green-400/30">
              <div className="text-sm text-green-300 mb-2">Winner</div>
              <div className="text-2xl font-bold text-green-400">{currentMatch.winner}</div>
            </div>
          </div>

          {/* Man of the Match */}
          {currentMatch.manOfTheMatch && (
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 mb-8 border border-yellow-400/30">
              <div className="flex items-center justify-center mb-3">
                <Award className="w-6 h-6 text-yellow-400 mr-2" />
                <span className="font-bold text-yellow-300">Man of the Match</span>
              </div>
              <div className="text-xl font-bold text-white text-center">
                {currentMatch.manOfTheMatch.name}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4">
            {/* Share Buttons */}
            <div className="flex space-x-3 mb-4">
              <button
                onClick={async () => {
                  try {
                    await PDFService.shareToWhatsApp(currentMatch);
                  } catch (error) {
                    console.error('Failed to share to WhatsApp:', error);
                    alert('Failed to share to WhatsApp. Please try again.');
                  }
                }}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center justify-center"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Share to WhatsApp
              </button>
              
              <button
                onClick={async () => {
                  try {
                    await PDFService.shareScoreboard(currentMatch);
                  } catch (error) {
                    console.error('Failed to share scoreboard:', error);
                    alert('Failed to share scoreboard. Please try again.');
                  }
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center justify-center"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share Scoreboard
              </button>
            </div>
            
            <button
              onClick={() => setShowDetailedScorecard(true)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              <BarChart3 className="w-5 h-5 inline mr-2" />
              View Detailed Scorecard
            </button>
            
            <button
              onClick={() => isStandaloneMode ? setCurrentState('standalone-setup') : setCurrentState('match-setup')}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 px-6 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              Start New Match
            </button>
            
            <button
              onClick={() => setCurrentState('dashboard')}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 px-6 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              View Dashboard
            </button>
            
            <button
              onClick={handleBackToHome}
              className="w-full bg-white/10 backdrop-blur-sm text-white py-4 px-6 rounded-xl font-bold hover:bg-white/20 transition-all duration-300 border border-white/20"
            >
              Back to Home
            </button>
          </div>
        </div>

        {/* Detailed Scorecard Modal */}
        {showDetailedScorecard && currentMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <DetailedScorecardModal
              match={currentMatch}
              isOpen={showDetailedScorecard}
              onClose={() => setShowDetailedScorecard(false)}
            />
          </div>
        )}
      </div>
    );
  }

  if (currentState === 'multi-group-dashboard') {
    return (
      <MultiGroupDashboard
        onNavigate={setCurrentState}
        onBack={() => setCurrentState('home')}
      />
    );
  }

  return null;
}

export default App;