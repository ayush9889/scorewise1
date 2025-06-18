import React, { useState, useEffect } from 'react';
import { MatchSetup } from './components/MatchSetup';
import { LiveScorer } from './components/LiveScorer';
import { Dashboard } from './components/Dashboard';
import { AuthModal } from './components/AuthModal';
import { GroupManagement } from './components/GroupManagement';
import { AdminDashboard } from './components/AdminDashboard';
import { AddPlayerModal } from './components/AddPlayerModal';
import { DetailedScorecardModal } from './components/DetailedScorecardModal';
import { Match, Player } from './types/cricket';
import { User, Group } from './types/auth';
import { storageService } from './services/storage';
import { cloudStorageService } from './services/cloudStorageService';
import { authService } from './services/authService';
import { PDFService } from './services/pdfService';
import { Trophy, BarChart3, Play, Award, Users, UserPlus, LogIn, LogOut, Crown, Sparkles, Target, Zap, Shield, Share2, MessageCircle, Cloud, CloudOff, RefreshCw, AlertTriangle, User as UserIcon } from 'lucide-react';

type AppState = 'home' | 'auth' | 'group-management' | 'admin-dashboard' | 'match-setup' | 'standalone-setup' | 'live-scoring' | 'dashboard' | 'match-complete';

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
  }>({ online: false, firebaseWorking: false });
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);

  useEffect(() => {
    initializeApp();
    
    // Cleanup function to ensure final backup when app closes
    const handleBeforeUnload = async () => {
      try {
        await storageService.createBackup();
        await storageService.stopAutoBackup();
        console.log('🔄 Final backup completed before app close');
      } catch (error) {
        console.error('❌ Final backup failed:', error);
      }
    };

    // Add event listeners for app close
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    
    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      storageService.stopAutoBackup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing ScoreWise app...');
      
      // Initialize storage first
      await storageService.init();
      console.log('✅ Storage initialized');
      
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
          console.warn('⚠️ No backup available for recovery');
        }
      }
      
      // Start automatic backup system
      await storageService.startAutoBackup();
      console.log('🔄 Auto-backup system started');
      
      // CRITICAL: Restore user session AFTER storage is initialized
      await authService.restoreUserSession();
      const user = authService.getCurrentUser();
      if (user) {
        console.log('✅ User session restored:', user.name);
        setCurrentUser(user);
        
        // Load user's groups
        const groups = authService.getUserGroups();
        console.log('✅ User groups restored:', groups.length);
        
        if (groups.length > 0) {
          const primaryGroup = groups[0];
          setCurrentGroup(primaryGroup);
          console.log('✅ Primary group set:', primaryGroup.name);
        }
      } else {
        console.log('ℹ️ No user session found');
      }
      
      // Check if standalone mode was enabled
      const standaloneMode = authService.isStandaloneModeEnabled();
      setIsStandaloneMode(standaloneMode);
      if (standaloneMode) {
        console.log('🏏 Standalone mode detected');
      }
      
      // Check connection status
      const status = await cloudStorageService.checkConnection();
      setConnectionStatus(status);
      console.log('📡 Connection status:', status);
      
      setIsInitialized(true);
      console.log('🎉 App initialization complete with enhanced persistence');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      
      // Try to recover from backup even if initialization fails
      try {
        console.log('🔄 Attempting emergency recovery...');
        const recovered = await storageService.restoreFromBackup();
        if (recovered) {
          console.log('✅ Emergency recovery successful');
        }
      } catch (recoveryError) {
        console.error('❌ Emergency recovery failed:', recoveryError);
      }
      
      setIsInitialized(true); // Continue even if storage fails
    }
  };

  const handleAuthSuccess = async () => {
    const user = authService.getCurrentUser();
    await authService.loadUserGroups();
    const groups = authService.getUserGroups();
    
    setCurrentUser(user);
    
    if (groups.length > 0) {
      setCurrentGroup(groups[0]);
    }
    
    setShowAuthModal(false);
    
    // Disable standalone mode when user signs in
    if (isStandaloneMode) {
      authService.disableStandaloneMode();
      setIsStandaloneMode(false);
    }
    
    // Always redirect to home after successful authentication
    setCurrentState('home');
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setCurrentGroup(null);
    setIsStandaloneMode(false);
    setCurrentState('home');
  };

  const handleMatchStart = (match: Match) => {
    setCurrentMatch(match);
    setCurrentState('live-scoring');
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
  };

  const handleResumeMatch = (match: Match) => {
    setCurrentMatch(match);
    setCurrentState('live-scoring');
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
                  } else {
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
                    onClick={() => setCurrentState('group-management')}
                    className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-500 border border-white/20 hover:border-purple-400/50 hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">Manage Group</h3>
                      <p className="text-purple-200">Create or join cricket groups with ease</p>
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
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">STRICT Match Format</h3>
                  <p className="text-purple-200 leading-relaxed">Exactly N overs - no more, no less. Perfect format enforcement for fair play</p>
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

  return null;
}

export default App;