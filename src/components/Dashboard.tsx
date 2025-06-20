import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, Target, Award, Users, Download, Upload, User, RefreshCw, MessageCircle, Share2, AlertCircle, Cloud, CloudOff, Wifi, WifiOff, Search, ArrowLeft, BarChart3, Trash2 } from 'lucide-react';
import { Player, Match } from '../types/cricket';
import { PlayerDashboard } from './PlayerDashboard';
import { DetailedScorecardModal } from './DetailedScorecardModal';
import { GroupDashboard } from './GroupDashboard';
import { storageService } from '../services/storage';
import { cloudStorageService } from '../services/cloudStorageService';
import { CricketEngine } from '../services/cricketEngine';
import { PDFService } from '../services/pdfService';
import { LiveScorer } from './LiveScorer';
import { authService } from '../services/authService';
import { GroupSelector } from './GroupSelector';
import { CloudSyncStatus } from './CloudSyncStatus';
import { CloudMigrationStatus } from './CloudMigrationStatus';
import AutoSyncStatus from './AutoSyncStatus';

interface DashboardProps {
  onBack: () => void;
  onResumeMatch?: (match: Match) => void;
}

type View = 'main' | 'player' | 'player-selection' | 'group';

export const Dashboard: React.FC<DashboardProps> = ({ onBack, onResumeMatch }) => {
  const [view, setView] = useState<View>('main');
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [incompleteMatches, setIncompleteMatches] = useState<Match[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    online: boolean;
    firebaseWorking: boolean;
    lastSync?: Date;
  }>({ online: navigator.onLine, firebaseWorking: false });
  const [syncing, setSyncing] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(authService.getCurrentUser());
  const [showCloudMigration, setShowCloudMigration] = useState(false);
  const [showDeleteMatchModal, setShowDeleteMatchModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);

  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Get current group
      const group = authService.getCurrentGroup();
      setCurrentGroup(group);
      
      if (!group) {
        console.log('No group selected, showing empty state');
        setMatches([]);
        setPlayers([]);
        setFilteredPlayers([]);
        setLoading(false);
        return;
      }
      
      console.log(`📊 Loading dashboard data for group: ${group.name}${isMobile ? ' (mobile)' : ''}`);
      
      // Mobile-optimized loading with timeout and error handling
      const loadPromise = async () => {
        // Load from local storage first with mobile-specific timeout
        const [storedMatches, storedPlayers] = await Promise.all([
          storageService.getAllMatches(),
          storageService.getAllPlayers()
        ]);
        
        return { storedMatches, storedPlayers };
      };
      
      // Add timeout protection for mobile devices
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('📱 Mobile loading timeout - data loading took too long'));
        }, isMobile ? 12000 : 30000); // 12s mobile, 30s desktop
      });
      
      let storedMatches: any[], storedPlayers: any[];
      
      try {
        const result = await Promise.race([loadPromise(), timeoutPromise]);
        storedMatches = result.storedMatches;
        storedPlayers = result.storedPlayers;
      } catch (timeoutError) {
        if (isMobile && timeoutError instanceof Error && timeoutError.message.includes('timeout')) {
          // Mobile fallback: try to load minimal data
          console.warn('📱 Mobile timeout detected, trying fallback loading...');
          
          try {
            storedMatches = await storageService.getAllMatches();
            storedPlayers = await storageService.getAllPlayers();
            console.log('✅ Mobile fallback loading successful');
          } catch (fallbackError) {
            throw new Error('📱 Mobile loading failed. Please refresh the page and check your internet connection.');
          }
        } else {
          throw timeoutError;
        }
      }
      
      // Filter matches by group - only show matches where players are from this group
      const groupMatches = storedMatches.filter(match => {
        // Add null checks for team objects to prevent mobile errors
        const allMatchPlayers = [
          ...(match.team1?.players || []),
          ...(match.team2?.players || []),
          ...(match.battingTeam?.players || []),
          ...(match.bowlingTeam?.players || [])
        ];
        
        return allMatchPlayers.some(player => 
          player && player.isGroupMember && 
          player.groupIds?.includes(group.id)
        );
      });
      
      // Filter players by group - only show group members
      const groupPlayers = storedPlayers.filter(player => 
        player.isGroupMember && 
        player.groupIds?.includes(group.id)
      );
      
      console.log(`📊 Group ${group.name} data:`, {
        matches: groupMatches.length,
        players: groupPlayers.length
      });
      
      // Sort matches by date (most recent first)
      const sortedMatches = groupMatches.sort((a: Match, b: Match) => b.startTime - a.startTime);
      
      setMatches(sortedMatches);
      setPlayers(groupPlayers);
      setFilteredPlayers(groupPlayers);
      
      // Check for incomplete matches
      await checkForIncompleteMatches(sortedMatches);
      
      // Try to sync with cloud if online
      await checkConnectionAndSync();
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      
      // Mobile-specific error handling
      if (isMobile) {
        if (err instanceof Error) {
          if (err.message.includes('timeout')) {
            setError('📱 Loading took too long on mobile. Please check your internet connection and try again.');
          } else if (err.message.includes('storage')) {
            setError('📱 Mobile storage issue. Please clear browser data and try again.');
          } else if (err.message.includes('quota')) {
            setError('📱 Storage full. Please clear some browser data and try again.');
          } else {
            setError(`📱 Mobile error: ${err.message}`);
          }
        } else {
          setError('📱 Unknown mobile error. Please refresh the page.');
        }
      } else {
        setError('Failed to load data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isMobile]);

  const checkConnectionAndSync = async () => {
    try {
      const status = await cloudStorageService.checkConnection();
      setConnectionStatus(status);
      
      if (status.online && status.firebaseWorking) {
        // Try to get cloud data
        const cloudMatches = await cloudStorageService.getRecentMatches(20);
        const cloudPlayers = await cloudStorageService.getAllPlayers();
        
        // Merge with local data (cloud takes precedence for newer items)
        if (cloudMatches.matches.length > 0) {
          const mergedMatches = [...cloudMatches.matches];
          matches.forEach(localMatch => {
            if (!mergedMatches.find(m => m.id === localMatch.id)) {
              mergedMatches.push(localMatch);
            }
          });
          setMatches(mergedMatches.sort((a, b) => b.startTime - a.startTime));
        }
        
        if (cloudPlayers.length > 0) {
          const mergedPlayers = [...cloudPlayers];
          players.forEach(localPlayer => {
            if (!mergedPlayers.find(p => p.id === localPlayer.id)) {
              mergedPlayers.push(localPlayer);
            }
          });
          setPlayers(mergedPlayers);
          setFilteredPlayers(mergedPlayers);
        }
      }
    } catch (error) {
      console.warn('⚠️ Connection check failed:', error);
    }
  };

  const checkForIncompleteMatches = async (groupMatches: Match[]) => {
    try {
      // Check local storage first
      const localIncomplete = groupMatches.filter(m => !m.isCompleted);
      
      // Check cloud storage if online
      if (connectionStatus.online && connectionStatus.firebaseWorking) {
        const cloudIncomplete = await cloudStorageService.getIncompleteMatches();
        
        // Filter cloud incomplete matches by group
        const groupCloudIncomplete = cloudIncomplete.filter(match => {
          const allMatchPlayers = [
            ...match.team1.players,
            ...match.team2.players,
            ...(match.battingTeam?.players || []),
            ...(match.bowlingTeam?.players || [])
          ];
          
          return allMatchPlayers.some(player => 
            player.isGroupMember && 
            player.groupIds?.includes(currentGroup?.id)
          );
        });
        
        // Merge incomplete matches
        const allIncomplete = [...localIncomplete];
        groupCloudIncomplete.forEach(cloudMatch => {
          if (!allIncomplete.find(m => m.id === cloudMatch.id)) {
            allIncomplete.push(cloudMatch);
          }
        });
        
        setIncompleteMatches(allIncomplete);
        if (allIncomplete.length > 0) {
          setShowResumePrompt(true);
        }
      } else {
        setIncompleteMatches(localIncomplete);
        if (localIncomplete.length > 0) {
          setShowResumePrompt(true);
        }
      }
    } catch (error) {
      console.error('Failed to check for incomplete matches:', error);
    }
  };

  const handleSyncData = async () => {
    if (!connectionStatus.online || !connectionStatus.firebaseWorking) {
      alert('Cannot sync - device is offline or cloud storage unavailable');
      return;
    }
    
    setSyncing(true);
    try {
      const result = await cloudStorageService.syncLocalData(matches, players);
      
      if (result.errors > 0) {
        alert(`Sync completed with ${result.errors} errors. ${result.synced} items synced successfully.`);
      } else {
        alert(`Sync successful! ${result.synced} items synced to cloud.`);
      }
      
      // Refresh data after sync
      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleResumeMatch = (match: Match) => {
    if (onResumeMatch) {
      onResumeMatch(match);
    }
    setShowResumePrompt(false);
  };

  const handleCreateBackup = async (match: Match) => {
    try {
      const backupName = prompt('Enter backup name (optional):');
      const backupId = await cloudStorageService.createBackup(match, backupName || undefined);
      alert(`Backup created successfully! Backup ID: ${backupId}`);
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Failed to create backup. Please check your connection.');
    }
  };

  // Filter players based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPlayers(players);
    } else {
      const filtered = players.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.shortId && player.shortId.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredPlayers(filtered);
    }
  }, [searchTerm, players]);

  useEffect(() => {
    loadData();
    
    // Mobile-specific timeout handling
    if (isMobile) {
      const timeout = setTimeout(() => {
        if (loading) {
          console.warn('📱 Mobile loading timeout detected');
          setError('📱 Loading timeout on mobile device. Please check your internet connection and try again.');
          setLoading(false);
        }
      }, 15000); // 15 seconds for mobile
      
      setLoadingTimeout(timeout);
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }
  }, []);

  // Cleanup timeout when loading completes
  useEffect(() => {
    if (!loading && loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  }, [loading, loadingTimeout]);

  useEffect(() => {
    const handleMatchSaved = () => {
      loadData();
    };
    window.addEventListener('matchSaved', handleMatchSaved);
    window.addEventListener('playerStatsUpdated', handleMatchSaved);
    return () => {
      window.removeEventListener('matchSaved', handleMatchSaved);
      window.removeEventListener('playerStatsUpdated', handleMatchSaved);
    };
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
    setView('player');
  };

  const handleGroupView = () => {
    setView('group');
  };

  const handlePlayerSelectionView = () => {
    setView('player-selection');
    setSearchTerm('');
  };

  const handleBackToMain = () => {
    setView('main');
    setSelectedPlayer(null);
    setSearchTerm('');
  };

  const handleDismissResume = () => {
    setShowResumePrompt(false);
  };

  // Calculate player stats for display
  const getPlayerDisplayStats = (player: Player) => {
    const playerMatches = matches.filter(match => 
      match.team1.players.some(p => p.id === player.id) || 
      match.team2.players.some(p => p.id === player.id)
    );

    let totalRuns = 0;
    let totalWickets = 0;
    let totalMatches = playerMatches.length;

    playerMatches.forEach(match => {
      const battingBalls = match.balls.filter(b => b.striker.id === player.id);
      const bowlingBalls = match.balls.filter(b => b.bowler.id === player.id);
      
      totalRuns += battingBalls.reduce((sum, ball) => {
        if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
          return sum + ball.runs;
        }
        return sum;
      }, 0);
      
      totalWickets += bowlingBalls.filter(b => b.isWicket && b.wicketType !== 'run_out').length;
    });

    return {
      matches: totalMatches,
      runs: totalRuns,
      wickets: totalWickets,
      average: totalMatches > 0 ? (totalRuns / totalMatches).toFixed(1) : '0.0',
      motmAwards: playerMatches.filter(m => m.manOfTheMatch?.id === player.id).length
    };
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    
    try {
      console.log('🔄 Manual sync triggered by user');
      
      // Import and trigger sync
      const { userCloudSyncService } = await import('../services/userCloudSyncService');
      
      // Force a complete sync
      await userCloudSyncService.initializeUserSync(currentUser);
      await userCloudSyncService.performFullSync();
      
      console.log('✅ Manual sync completed successfully');
      alert('✅ Sync completed! Your data has been synchronized across all devices.');
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      alert('❌ Sync failed: ' + error.message);
    }
  };

  const handleCrossDeviceTest = async () => {
    if (!currentUser) return;
    
    try {
      console.log('🧪 Running cross-device sync test...');
      
      // Create a test group with unique identifier
      const testGroupName = `Test Group ${Date.now()}`;
      const testGroup = {
        id: `test_${Date.now()}`,
        name: testGroupName,
        description: 'Cross-device sync test group',
        members: [{
          userId: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: 'admin',
          joinedAt: new Date().toISOString()
        }],
        inviteCode: `TEST${Math.floor(Math.random() * 10000)}`,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        lastUpdated: Date.now()
      };
      
      // Save to local storage
      const { storageService } = await import('../services/storage');
      await storageService.saveGroup(testGroup);
      console.log('✅ Test group saved locally:', testGroupName);
      
      // Force sync to cloud
      const { userCloudSyncService } = await import('../services/userCloudSyncService');
      await userCloudSyncService.syncUserDataToCloud(true);
      console.log('✅ Test group synced to cloud');
      
      alert(`✅ Cross-device test completed!\n\nTest group created: "${testGroupName}"\nInvite code: ${testGroup.inviteCode}\n\nNow check another device - this group should appear there when you login with the same account!`);
      
      // Refresh the page to show new data
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Cross-device test failed:', error);
      alert('❌ Test failed: ' + error.message);
    }
  };

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return;

    setLoading(true);
    try {
      console.log('🗑️ Deleting match:', matchToDelete.id);

      // Delete from cloud storage first
      try {
        await cloudStorageService.deleteMatch(matchToDelete.id);
        console.log('☁️ Match deleted from cloud');
      } catch (error) {
        console.warn('⚠️ Failed to delete from cloud:', error);
      }

      // Delete from local storage
      await storageService.deleteMatch(matchToDelete.id);
      console.log('💾 Match deleted from local storage');

      // Update the matches list
      setMatches(matches.filter(m => m.id !== matchToDelete.id));
      setIncompleteMatches(incompleteMatches.filter(m => m.id !== matchToDelete.id));

      // Close modal
      setShowDeleteMatchModal(false);
      setMatchToDelete(null);

      console.log('✅ Match deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete match:', error);
      setError('Failed to delete match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShowDebugInfo = async () => {
    if (!currentUser) return;
    
    try {
      console.log('🔍 Gathering debug information...');
      
      const { storageService } = await import('../services/storage');
      const { userCloudSyncService } = await import('../services/userCloudSyncService');
      
      // Get local data counts
      const localGroups = await storageService.getAllGroups();
      const localMatches = await storageService.getAllMatches();
      const localPlayers = await storageService.getAllPlayers();
      
      // Get sync status
      const syncStatus = await userCloudSyncService.getSyncStatus();
      
      const debugInfo = {
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name
        },
        localData: {
          groups: localGroups.length,
          matches: localMatches.length,
          players: localPlayers.length
        },
        cloudData: syncStatus.cloudDataCount,
        lastSync: syncStatus.lastSyncTime?.toLocaleString() || 'Never',
        isOnline: syncStatus.isOnline,
        groupNames: localGroups.map(g => g.name)
      };
      
      console.log('📊 Debug Info:', debugInfo);
      
      alert(`📊 Debug Information:\n\n` +
        `👤 User: ${currentUser.name} (${currentUser.email})\n\n` +
        `💾 Local Data:\n` +
        `  • Groups: ${debugInfo.localData.groups}\n` +
        `  • Matches: ${debugInfo.localData.matches}\n` +
        `  • Players: ${debugInfo.localData.players}\n\n` +
        `☁️ Cloud Data:\n` +
        `  • Groups: ${debugInfo.cloudData.groups}\n` +
        `  • Matches: ${debugInfo.cloudData.matches}\n` +
        `  • Players: ${debugInfo.cloudData.players}\n\n` +
        `🔄 Last Sync: ${debugInfo.lastSync}\n` +
        `🌐 Online: ${debugInfo.isOnline ? 'Yes' : 'No'}\n\n` +
        `📝 Groups: ${debugInfo.groupNames.join(', ') || 'None'}`
      );
      
    } catch (error) {
      console.error('❌ Debug info failed:', error);
      alert('❌ Debug failed: ' + error.message);
    }
  };

  const renderError = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={handleRefresh}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 mb-2">
          {isMobile ? '📱 Loading group data on mobile...' : 'Loading dashboard data...'}
        </p>
        {isMobile && (
          <p className="text-sm text-gray-500">
            This may take longer on mobile devices. Please wait...
          </p>
        )}
      </div>
    </div>
  );

  const renderNoGroupState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Group Selected</h2>
        <p className="text-gray-600 mb-6">Please create or join a group to view your cricket dashboard.</p>
        <button
          onClick={onBack}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Manage Groups
        </button>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Group Data Available</h2>
        <p className="text-gray-600 mb-6">Start by creating your first match with group members to see statistics and leaderboards.</p>
        <button
          onClick={onBack}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Create Match
        </button>
      </div>
    </div>
  );

  const renderPlayerSelection = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleBackToMain}
            className="flex items-center p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 mr-2" />
            <span className="text-gray-600">Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {currentGroup?.name} - Player Statistics
          </h1>
          <div className="w-32"></div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search group players by name or ID..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Players Grid */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Group Players ({filteredPlayers.length})
            </h2>
            <div className="text-sm text-gray-500">
              Click on any player to view detailed statistics
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No players found' : 'No group players available'}
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? 'Try adjusting your search terms' 
                  : 'Add players to your group to see their statistics here'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlayers.map((player) => {
                const stats = getPlayerDisplayStats(player);
                return (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-6 text-left transition-all duration-200 hover:shadow-md border border-gray-200 hover:border-blue-300"
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        {player.photoUrl ? (
                          <img
                            src={player.photoUrl}
                            alt={player.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-white font-bold text-lg">
                            {player.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{player.name}</h3>
                        {player.shortId && (
                          <p className="text-sm text-gray-500">ID: {player.shortId}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            Group Member
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-lg text-blue-600">{stats.matches}</div>
                        <div className="text-gray-600">Matches</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-green-600">{stats.runs}</div>
                        <div className="text-gray-600">Runs</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-red-600">{stats.wickets}</div>
                        <div className="text-gray-600">Wickets</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-yellow-600">{stats.motmAwards}</div>
                        <div className="text-gray-600">MOTM</div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Avg per match:</span>
                        <span className="font-semibold text-gray-900">{stats.average} runs</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Group Selector */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-blue-500 hover:text-blue-600 font-semibold"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {currentGroup ? `${currentGroup.name} Dashboard` : 'Dashboard'}
                </h1>
                <p className="text-gray-600">Statistics and performance overview</p>
              </div>
            </div>

            {/* Group Selector */}
            <div className="w-80">
              <GroupSelector
                currentGroup={currentGroup}
                onGroupSelect={(group) => {
                  // Update current group and reload data
                  authService.setCurrentGroup(group);
                  window.location.reload(); // Simple refresh for now
                }}
                onCreateGroup={() => {
                  // Navigate to group creation
                  onBack(); // Go back to handle navigation
                }}
                onJoinGroup={() => {
                  // Navigate to group joining
                  onBack(); // Go back to handle navigation
                }}
                onManageGroup={() => {
                  // Navigate to group management
                  onBack(); // Go back to handle navigation
                }}
                showManagement={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Guest Mode Banner */}
      {authService.getCurrentUser()?.isGuest && (
        <div className="bg-blue-100 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <p className="text-blue-700 font-medium">Guest Mode Active</p>
                <p className="text-blue-600 text-sm">Your data is saved locally on this device. Create an account to sync across devices.</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Sign Up
            </button>
          </div>
        </div>
      )}

      {/* Connection Status Banner */}
      {!connectionStatus.online && (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6">
          <div className="flex items-center">
            <WifiOff className="w-5 h-5 text-orange-600 mr-2" />
            <div>
              <p className="text-orange-700 font-medium">You're offline</p>
              <p className="text-orange-600 text-sm">Data will sync when connection is restored</p>
            </div>
          </div>
        </div>
      )}

      {/* Resume Match Prompt */}
      {showResumePrompt && incompleteMatches.length > 0 && (
        <div className="bg-blue-100 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Incomplete Matches Found</h3>
              <p className="text-blue-700 mb-3">
                You have {incompleteMatches.length} incomplete match{incompleteMatches.length > 1 ? 'es' : ''} that can be resumed:
              </p>
              <div className="space-y-2">
                {incompleteMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between bg-white rounded p-3">
                    <div>
                      <div className="font-medium text-gray-900">
                        {match.team1.name} vs {match.team2.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {match.battingTeam.score}/{match.battingTeam.wickets} in {match.battingTeam.overs}.{match.battingTeam.balls} overs
                      </div>
                      <div className="text-xs text-gray-500">
                        Started: {new Date(match.startTime).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleResumeMatch(match)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Resume
                      </button>
                      {connectionStatus.online && connectionStatus.firebaseWorking && (
                        <button
                          onClick={() => handleCreateBackup(match)}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          Backup
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleDismissResume}
              className="text-blue-600 hover:text-blue-800 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{matches.length}</div>
                <div className="text-sm text-gray-600">Group Matches</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Trophy className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{players.length}</div>
                <div className="text-sm text-gray-600">Group Players</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Users className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {matches.filter(m => m.isCompleted).length}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Award className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{incompleteMatches.length}</div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Target className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Sync Status - Replacing Manual Cloud Sync */}
        {!currentUser?.isGuest && (
          <div className="mb-6">
            <AutoSyncStatus />
          </div>
        )}

        {/* Cloud Migration Status */}
        {!currentUser?.isGuest && currentUser && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Cloud className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Cloud Storage</h3>
                  <p className="text-sm text-gray-600">Access your data from any device</p>
                </div>
              </div>
              <button
                onClick={() => setShowCloudMigration(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Manage Cloud Data
              </button>
            </div>
          </div>
        )}

        {/* Recent Matches */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Group Matches</h2>
          {matches.length > 0 ? (
            <div className="space-y-4">
              {matches.slice(0, 5).map(match => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {match.team1.name} vs {match.team2.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(match.startTime).toLocaleDateString()}
                    </p>
                    {!match.isCompleted && (
                      <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full mt-1">
                        In Progress
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {match.team1.score}/{match.team1.wickets} - {match.team2.score}/{match.team2.wickets}
                    </p>
                    <div className="flex space-x-2 mt-2">
                      <button
                        className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-semibold"
                        onClick={() => {
                          setCurrentMatch(match);
                          setShowDetailedScorecard(true);
                        }}
                      >
                        View Scorecard
                      </button>
                      {!match.isCompleted && (
                        <button
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold"
                          onClick={() => handleResumeMatch(match)}
                        >
                          Resume
                        </button>
                      )}
                      {currentGroup && authService.canUserManageGroup(currentGroup.id) && (
                        <button
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold flex items-center space-x-1"
                          onClick={() => {
                            setMatchToDelete(match);
                            setShowDeleteMatchModal(true);
                          }}
                          title="Delete match"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No group matches played yet</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={handleGroupView}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Group Leaderboards</h3>
                <p className="text-sm text-gray-500">View batting, bowling & fielding leaderboards</p>
              </div>
            </div>
          </button>

          <button
            onClick={handlePlayerSelectionView}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <User className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Player Statistics</h3>
                <p className="text-sm text-gray-500">View individual group member performance</p>
              </div>
            </div>
          </button>
        </div>

        {/* Sync Status */}
        {connectionStatus.lastSync && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Last synced: {connectionStatus.lastSync.toLocaleString()}
          </div>
        )}


      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error) return renderError();
  if (!currentGroup) return renderNoGroupState();
  if (matches.length === 0 && players.length === 0) return renderEmptyState();

  return (
    <>
      {view === 'main' && renderMainView()}
      {view === 'player-selection' && renderPlayerSelection()}
      {view === 'player' && selectedPlayer && (
        <PlayerDashboard
          onBack={handleBackToMain}
          player={selectedPlayer}
          onPlayerUpdate={(updatedPlayer) => {
            setSelectedPlayer(updatedPlayer);
            setPlayers(players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
          }}
        />
      )}
      {view === 'group' && <GroupDashboard onBack={handleBackToMain} />}
      
      {showDetailedScorecard && currentMatch && (
        <DetailedScorecardModal
          match={currentMatch}
          isOpen={showDetailedScorecard}
          onClose={() => setShowDetailedScorecard(false)}
        />
      )}

      {showCloudMigration && (
        <CloudMigrationStatus
          onClose={() => setShowCloudMigration(false)}
        />
      )}

      {/* Delete Match Confirmation Modal */}
      {showDeleteMatchModal && matchToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                <h2 className="text-xl font-bold text-red-900">Delete Match</h2>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-red-800 text-sm mb-3 font-medium">
                  ⚠️ Are you sure you want to delete this match?
                </p>
                <div className="text-sm text-red-700 space-y-2">
                  <p><strong>Match:</strong> {matchToDelete.team1.name} vs {matchToDelete.team2.name}</p>
                  <p><strong>Date:</strong> {new Date(matchToDelete.startTime).toLocaleDateString()}</p>
                  <p><strong>Status:</strong> {matchToDelete.isCompleted ? 'Completed' : 'In Progress'}</p>
                </div>
                <div className="mt-3 text-xs text-red-600">
                  This will permanently delete:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>All scorecard data and statistics</li>
                    <li>Player performance records from this match</li>
                    <li>All balls, overs, and scoring information</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteMatchModal(false);
                  setMatchToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMatch}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Match</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};