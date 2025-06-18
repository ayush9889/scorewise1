import React, { useState, useEffect } from 'react';
import { ArrowLeft, Menu, BarChart3, RefreshCw, AlertCircle, Trophy, UserPlus, X, Wifi, WifiOff, User, Share2, MessageCircle, Cloud, CloudOff, Save } from 'lucide-react';
import { Match, Ball, Player } from '../types/cricket';
import { CompactScoreDisplay } from './CompactScoreDisplay';
import { ScoringPanel } from './ScoringPanel';
import { PlayerSelector } from './PlayerSelector';
import { InningsBreakModal } from './InningsBreakModal';
import { InningsSetupModal } from './InningsSetupModal';
import { CricketEngine } from '../services/cricketEngine';
import { storageService } from '../services/storage';
import { cloudStorageService } from '../services/cloudStorageService';
import { ScorecardModal } from './ScorecardModal';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/authService';
import { PDFService } from '../services/pdfService';
import { DetailedScorecardModal } from './DetailedScorecardModal';

interface LiveScorerProps {
  match: Match;
  onMatchComplete: (match: Match) => void;
  onBack: () => void;
}

export const LiveScorer: React.FC<LiveScorerProps> = ({
  match: initialMatch,
  onMatchComplete,
  onBack
}) => {
  // Match state
  const [match, setMatch] = useState<Match>(initialMatch);
  const [target, setTarget] = useState<number>(0);
  const [actionHistory, setActionHistory] = useState<Ball[]>([]);
  const [redoStack, setRedoStack] = useState<Ball[]>([]);

  // UI state
  const [showMenu, setShowMenu] = useState(false);
  const [showBatsmanSelector, setShowBatsmanSelector] = useState(false);
  const [showBowlerSelector, setShowBowlerSelector] = useState(false);
  const [showNewBatsmanSelector, setShowNewBatsmanSelector] = useState(false);
  const [showInningsBreak, setShowInningsBreak] = useState(false);
  const [showInningsSetup, setShowInningsSetup] = useState(false);
  const [showMatchSummary, setShowMatchSummary] = useState(false);
  const [showVictoryAnimation, setShowVictoryAnimation] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showOverCompleteMessage, setShowOverCompleteMessage] = useState(false);
  const [overCompleteMessage, setOverCompleteMessage] = useState<string | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showMotmSelector, setShowMotmSelector] = useState(false);

  // Game state
  const [pendingStrikeRotation, setPendingStrikeRotation] = useState(false);
  const [isSecondInningsSetup, setIsSecondInningsSetup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [addPlayerType, setAddPlayerType] = useState<'batting' | 'bowling'>('batting');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [needsBowlerChange, setNeedsBowlerChange] = useState(false);
  const [needsNewBatsman, setNeedsNewBatsman] = useState(false);
  const [cloudSyncDisabled, setCloudSyncDisabled] = useState(false);
  const [backgroundSaves, setBackgroundSaves] = useState(0);
  const [lastCloudSave, setLastCloudSave] = useState<Date | null>(null);
  const [autoSaveInterval, setAutoSaveInterval] = useState<NodeJS.Timeout | null>(null);

  // Add new state for players
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      cloudStorageService.goOnline();
      setSaveError(null);
      setCloudSyncDisabled(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      cloudStorageService.goOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load players on mount
  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const players = await storageService.getAllPlayers();
        setAllPlayers(players);
      } catch (error) {
        console.error('Failed to load players:', error);
      } finally {
        setIsLoadingPlayers(false);
      }
    };
    loadPlayers();
  }, []);

  // Load match from cloud storage on mount
  useEffect(() => {
    const loadMatch = async () => {
      try {
        if (isOnline) {
          const savedMatch = await cloudStorageService.getMatch(initialMatch.id);
          if (savedMatch && savedMatch.balls && savedMatch.balls.length > match.balls.length) {
            console.log('🔄 Loading more recent match state from cloud');
            setMatch(savedMatch);
          }
        }
      } catch (error) {
        console.error('Error loading match from cloud:', error);
      }
    };
    loadMatch();
  }, [initialMatch.id, isOnline]);

  // Auto-save functionality
  useEffect(() => {
    const saveMatchWithRetry = async (retryAttempt = 0) => {
      if (cloudSyncDisabled) return;
      
      try {
        setIsSaving(true);
        setSaveError(null);
        
        // Save to local storage first (always works)
        await storageService.saveMatchState(match);
        
        // Try cloud save if online
        if (isOnline) {
          await cloudStorageService.saveMatch(match);
          setLastCloudSave(new Date());
          setRetryCount(0);
          console.log('✅ Match auto-saved to cloud successfully');
        }
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
        
        if (retryAttempt < 3 && isOnline) {
          console.log(`🔄 Retrying auto-save (attempt ${retryAttempt + 1}/3)`);
          setRetryCount(retryAttempt + 1);
          setTimeout(() => saveMatchWithRetry(retryAttempt + 1), 2000 * (retryAttempt + 1));
        } else {
          setSaveError(isOnline ? 'Cloud save failed. Match saved locally.' : 'Offline - saved locally only');
          if (retryAttempt >= 3) {
            setCloudSyncDisabled(true);
          }
        }
      } finally {
        setIsSaving(false);
      }
    };

    // Debounced auto-save
    if (autoSaveInterval) {
      clearTimeout(autoSaveInterval);
    }
    
    const newInterval = setTimeout(() => {
      saveMatchWithRetry();
    }, 2000); // Save 2 seconds after last change
    
    setAutoSaveInterval(newInterval);

    return () => {
      if (newInterval) {
        clearTimeout(newInterval);
      }
    };
  }, [match, isOnline, cloudSyncDisabled]);

  // Manual save function
  const handleManualSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      
      await storageService.saveMatchState(match);
      
      if (isOnline) {
        await cloudStorageService.saveMatch(match);
        setLastCloudSave(new Date());
        alert('Match saved to cloud successfully!');
      } else {
        alert('Match saved locally. Will sync when online.');
      }
    } catch (error) {
      console.error('Manual save failed:', error);
      setSaveError('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate remaining runs and balls
  useEffect(() => {
    if (match.isSecondInnings) {
      const totalBalls = match.totalOvers * 6;
      const ballsBowled = (match.battingTeam.overs * 6) + match.battingTeam.balls;
      setTarget(match.firstInningsScore + 1);
    }
  }, [match.battingTeam.score, match.battingTeam.overs, match.battingTeam.balls, match.isSecondInnings, match.firstInningsScore]);

  // Update player stats after match completion with enhanced tracking
  useEffect(() => {
    const updatePlayerStats = async () => {
      if (match.isCompleted) {
        try {
          console.log('Updating player stats after match completion...');
          
          // Get all players who participated in the match (from both teams)
          const allMatchPlayers = [
            ...match.team1.players,
            ...match.team2.players,
            ...match.battingTeam.players,
            ...match.bowlingTeam.players
          ];
          
          // Remove duplicates based on player ID
          const uniquePlayers = allMatchPlayers.filter((player, index, self) => 
            index === self.findIndex(p => p.id === player.id)
          );
          
          console.log('Players to update:', uniquePlayers.map(p => p.name));
          
          // Update stats for each player
          for (const player of uniquePlayers) {
            console.log(`Updating stats for ${player.name}...`);
            
            // Calculate updated stats using cricket engine
            const updatedStats = CricketEngine.updatePlayerStats(player, match);
            
            // Create updated player object
            const updatedPlayer = { 
              ...player, 
              stats: updatedStats 
            };
            
            // Save to storage
            await storageService.savePlayer(updatedPlayer);
            
            // Save to cloud if online
            if (isOnline) {
              try {
                await cloudStorageService.savePlayer(updatedPlayer);
              } catch (error) {
                console.warn('Failed to save player to cloud:', error);
              }
            }
            
            console.log(`Stats updated for ${player.name}:`, {
              matches: updatedStats.matchesPlayed,
              runs: updatedStats.runsScored,
              wickets: updatedStats.wicketsTaken,
              motm: updatedStats.motmAwards
            });
          }
          
          console.log('All player stats updated successfully');
          
          // Force refresh of dashboard data by triggering a storage event
          window.dispatchEvent(new CustomEvent('playerStatsUpdated'));
          
        } catch (error) {
          console.error('Failed to update player stats:', error);
        }
      }
    };

    updatePlayerStats();
  }, [match.isCompleted, isOnline]);

  const handleInningsTransition = () => {
    setShowInningsBreak(true);
  };

  const handleInningsBreakContinue = () => {
    const updatedMatch = { ...match };
    updatedMatch.isSecondInnings = true;
    
    // Swap teams
    const temp = updatedMatch.battingTeam;
    updatedMatch.battingTeam = updatedMatch.bowlingTeam;
    updatedMatch.bowlingTeam = temp;
    
    updatedMatch.firstInningsScore = temp.score;
    setTarget(temp.score + 1);
    
    // Reset batting team stats
    updatedMatch.battingTeam.score = 0;
    updatedMatch.battingTeam.overs = 0;
    updatedMatch.battingTeam.balls = 0;
    updatedMatch.battingTeam.wickets = 0;
    updatedMatch.battingTeam.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
    updatedMatch.battingTeam.fallOfWickets = [];
    
    // Clear current players for new selection
    updatedMatch.currentStriker = undefined;
    updatedMatch.currentNonStriker = undefined;
    updatedMatch.currentBowler = undefined;
    
    setMatch(updatedMatch);
    setShowInningsBreak(false);
    setShowInningsSetup(true);
    setIsSecondInningsSetup(true);
  };

  const handleInningsSetup = (striker: Player, nonStriker: Player, bowler: Player) => {
    const updatedMatch = { ...match };
    updatedMatch.currentStriker = striker;
    updatedMatch.currentNonStriker = nonStriker;
    updatedMatch.currentBowler = bowler;

    // Add players to their respective teams if not already present
    if (!updatedMatch.battingTeam.players.find(p => p.id === striker.id)) {
      updatedMatch.battingTeam.players.push(striker);
    }
    if (!updatedMatch.battingTeam.players.find(p => p.id === nonStriker.id)) {
      updatedMatch.battingTeam.players.push(nonStriker);
    }
    if (!updatedMatch.bowlingTeam.players.find(p => p.id === bowler.id)) {
      updatedMatch.bowlingTeam.players.push(bowler);
    }

    setMatch(updatedMatch);
    setShowInningsSetup(false);
    setIsSecondInningsSetup(false);
  };

  const handleMatchComplete = async () => {
    try {
      const completedMatch = {
        ...match,
        isCompleted: true,
        endTime: new Date().toISOString(),
        winner: CricketEngine.getMatchResult(match).split(' won ')[0] || 'Unknown',
        manOfTheMatch: CricketEngine.calculateManOfTheMatch(match)
      };
      
      await storageService.saveMatchState(completedMatch);
      
      // Save to cloud if online
      if (isOnline) {
        try {
          await cloudStorageService.saveMatch(completedMatch);
        } catch (error) {
          console.warn('Failed to save completed match to cloud:', error);
        }
      }
      
      await storageService.clearIncompleteMatches();
      onMatchComplete(completedMatch);
    } catch (error) {
      console.error('Failed to complete match:', error);
    }
  };

  const handleScoreUpdate = (ball: Ball) => {
    console.log(`\n🏏 PROCESSING BALL: ${ball.runs} runs by ${ball.striker.name} off ${ball.bowler.name}`);
    
    // Add innings and batting team info to ball
    ball.innings = match.isSecondInnings ? 2 : 1;
    ball.battingTeamId = match.battingTeam.id || (match.isSecondInnings ? match.team2.id : match.team1.id);
    
    // Add to action history for undo functionality
    setActionHistory([...actionHistory, ball]);
    setRedoStack([]); // Clear redo stack when new action is performed

    // Process the ball using cricket engine
    let updatedMatch = CricketEngine.processBall(match, ball);

    console.log(`📊 After ball: ${updatedMatch.battingTeam.score}/${updatedMatch.battingTeam.wickets} in ${updatedMatch.battingTeam.overs}.${updatedMatch.battingTeam.balls}`);

    // CRITICAL FIX: Only check for bowler change when currentBowler becomes undefined (over complete)
    // AND only if the match is not complete (innings not finished)
    const wasOverComplete = match.currentBowler && !updatedMatch.currentBowler;
    const isInningsComplete = CricketEngine.isInningsComplete(updatedMatch);
    
    console.log(`🔍 OVER COMPLETE CHECK: wasOverComplete=${wasOverComplete}, isInningsComplete=${isInningsComplete}`);
    console.log(`🔍 Previous bowler: ${match.currentBowler?.name || 'None'}`);
    console.log(`🔍 Current bowler: ${updatedMatch.currentBowler?.name || 'None'}`);
    console.log(`🔍 Current state - showBowlerSelector: ${showBowlerSelector}, needsBowlerChange: ${needsBowlerChange}`);
    
    if (wasOverComplete && !isInningsComplete) {
      console.log(`🚨 OVER ${updatedMatch.battingTeam.overs} COMPLETED - BOWLER CHANGE MANDATORY!`);
      
      setOverCompleteMessage(`Over ${updatedMatch.battingTeam.overs} completed!`);
      setNeedsBowlerChange(true);
      
      // Get available bowlers for next over with ABSOLUTE filtering
      const nextOver = updatedMatch.battingTeam.overs + 1;
      const availableBowlers = CricketEngine.getAvailableBowlers(updatedMatch, nextOver);
      
      console.log(`🔍 Available bowlers for over ${nextOver}:`, availableBowlers.map(b => b.name));
      
      if (availableBowlers.length === 0) {
        console.log(`🚨 CRITICAL: NO AVAILABLE BOWLERS FOR OVER ${nextOver}!`);
        alert('🚨 CRITICAL ERROR: No eligible bowlers available for the next over!\n\nPlease add more bowlers to the team immediately.');
        setAddPlayerType('bowling');
        setShowAddPlayerModal(true);
      } else {
        console.log(`✅ Showing bowler selector for over ${nextOver}`);
        // Force the modal to show with a slight delay to ensure state updates
        setTimeout(() => {
        setShowBowlerSelector(true);
          console.log(`🔍 FORCED BOWLER SELECTOR SHOW - showBowlerSelector: true`);
        }, 100);
      }
    }

    // Check for wicket - need new batsman
    if (ball.isWicket) {
      console.log(`🏏 WICKET! ${ball.striker.name} is out`);
      setNeedsNewBatsman(true);
      setShowNewBatsmanSelector(true);
    }

    // Check for innings completion
    if (isInningsComplete) {
      console.log(`🏁 INNINGS COMPLETE!`);
      if (!updatedMatch.isSecondInnings) {
        console.log(`🔄 Moving to second innings`);
        handleInningsTransition();
      } else {
        console.log(`🏆 MATCH COMPLETE!`);
        handleMatchComplete();
      }
    }

    setMatch(updatedMatch);
  };

  const handleBowlerChange = (newBowler: Player) => {
    console.log(`\n🏏 ATTEMPTING BOWLER CHANGE TO: ${newBowler.name}`);
    
    try {
    const updatedMatch = { ...match };
    
    // ABSOLUTE VALIDATION: Check if this bowler can bowl the next over
    const nextOver = updatedMatch.battingTeam.overs + 1;
    const canBowl = CricketEngine.canBowlerBowlNextOver(newBowler, updatedMatch);
    
    if (!canBowl) {
      console.log(`❌ BOWLER CHANGE REJECTED: ${newBowler.name} cannot bowl consecutive overs!`);
      alert(`🚫 RULE VIOLATION!\n\n${newBowler.name} cannot bowl consecutive overs!\n\nThis is a fundamental cricket rule. Please select a different bowler.`);
      return;
    }
    
    console.log(`✅ BOWLER CHANGE APPROVED: ${newBowler.name} can bowl over ${nextOver}`);
    
    // Update bowler
    updatedMatch.previousBowler = updatedMatch.currentBowler;
    updatedMatch.currentBowler = newBowler;
    
    console.log(`🔄 Bowler changed: ${updatedMatch.previousBowler?.name} → ${newBowler.name}`);
    
    // Add bowler to bowling team if not already present
    if (!updatedMatch.bowlingTeam.players.find(p => p.id === newBowler.id)) {
      updatedMatch.bowlingTeam.players.push(newBowler);
      console.log(`➕ Added ${newBowler.name} to bowling team`);
    }
    
      // Update match state first
    setMatch(updatedMatch);
    
    // AUTO-CLOSE: Close all modals automatically after selection
    setShowBowlerSelector(false);
    setNeedsBowlerChange(false);
    setOverCompleteMessage(null);
    
    console.log(`✅ BOWLER CHANGE COMPLETE - READY FOR OVER ${nextOver}`);
      
    } catch (error) {
      console.error('Error during bowler change:', error);
      // Don't let the error prevent the bowler change
      alert('Bowler change completed successfully, but there was a minor sync issue. The match will continue normally.');
    }
  };

  const handleNewBatsman = (newBatsman: Player) => {
    const updatedMatch = { ...match };
    
    console.log(`✅ NEW BATSMAN SELECTED: ${newBatsman.name} (${newBatsman.isGuest ? 'Guest' : newBatsman.isGroupMember ? 'Group Member' : 'Player'})`);
    
    // Immediately update the match and UI
    // Replace the out batsman (striker) with new batsman
    updatedMatch.currentStriker = newBatsman;
    
    // Add new batsman to batting team if not already present
    if (!updatedMatch.battingTeam.players.find(p => p.id === newBatsman.id)) {
      updatedMatch.battingTeam.players.push(newBatsman);
      console.log(`🏏 Added ${newBatsman.name} to batting team as new batsman`);
    }
    
    setMatch(updatedMatch);
    
    // AUTO-CLOSE: Close modal automatically after selection
    setShowNewBatsmanSelector(false);
    setNeedsNewBatsman(false);
    
    // Save to storage in the background with indicator
    setBackgroundSaves(prev => prev + 1);
    storageService.savePlayer(newBatsman).then(() => {
      setBackgroundSaves(prev => Math.max(0, prev - 1));
    }).catch((error) => {
      console.error('Background save failed for new batsman:', error);
      setBackgroundSaves(prev => Math.max(0, prev - 1));
    });
  };

  const handleUndo = () => {
    if (actionHistory.length === 0) return;

    const lastBall = actionHistory[actionHistory.length - 1];
    const updatedMatch = { ...match };

    // Remove last ball from match
    updatedMatch.balls = updatedMatch.balls.filter(b => b.id !== lastBall.id);

    // Revert score changes
    updatedMatch.battingTeam.score -= lastBall.runs;

    // Revert extras
    if (lastBall.isWide) {
      updatedMatch.battingTeam.extras.wides--;
    } else if (lastBall.isNoBall) {
      updatedMatch.battingTeam.extras.noBalls--;
    } else if (lastBall.isBye) {
      updatedMatch.battingTeam.extras.byes -= lastBall.runs;
    } else if (lastBall.isLegBye) {
      updatedMatch.battingTeam.extras.legByes -= lastBall.runs;
    }

    // Revert wickets and Fall of Wickets
    if (lastBall.isWicket) {
      updatedMatch.battingTeam.wickets--;
      // Remove the last fall of wicket entry
      if (updatedMatch.battingTeam.fallOfWickets && updatedMatch.battingTeam.fallOfWickets.length > 0) {
        updatedMatch.battingTeam.fallOfWickets.pop();
      }
    }

    // Revert ball count and overs
    if (!lastBall.isWide && !lastBall.isNoBall) {
      if (updatedMatch.battingTeam.balls === 0 && updatedMatch.battingTeam.overs > 0) {
        updatedMatch.battingTeam.overs--;
        updatedMatch.battingTeam.balls = 5;
      } else {
        updatedMatch.battingTeam.balls--;
      }
    }

    // CRITICAL: Check if undoing the last ball of an over
    // If we're undoing and the current bowler is undefined (over complete), 
    // we need to restore the previous bowler
    if (!updatedMatch.currentBowler && updatedMatch.previousBowler) {
      console.log(`🔄 UNDO: Restoring bowler from over completion`);
      updatedMatch.currentBowler = updatedMatch.previousBowler;
      updatedMatch.previousBowler = undefined;
    }

    setMatch(updatedMatch);
    setActionHistory(actionHistory.slice(0, -1));
    setRedoStack([lastBall, ...redoStack]);
    setPendingStrikeRotation(false);
    setOverCompleteMessage(null);
    setNeedsBowlerChange(false);
    setNeedsNewBatsman(false);
    setShowBowlerSelector(false);
  };

  const getAvailableBowlers = (): Player[] => {
    const nextOver = match.battingTeam.overs + 1;
    const availableBowlers = CricketEngine.getAvailableBowlers(match, nextOver);
    
    console.log(`🏏 GETTING AVAILABLE BOWLERS FOR SELECTOR:`);
    console.log(`Next over: ${nextOver}`);
    console.log(`Current bowler: ${match.currentBowler?.name || 'None'}`);
    console.log(`Previous bowler: ${match.previousBowler?.name || 'None'}`);
    console.log(`All bowling team players:`, match.bowlingTeam.players.map(b => b.name));
    console.log(`Available bowlers:`, availableBowlers.map(b => b.name));
    
    // FALLBACK: If no bowlers available, show all bowling team players except current batsmen
    if (availableBowlers.length === 0) {
      console.log(`🚨 NO AVAILABLE BOWLERS - USING FALLBACK LOGIC`);
      const fallbackBowlers = match.bowlingTeam.players.filter(bowler => 
        bowler.id !== match.currentStriker?.id &&
        bowler.id !== match.currentNonStriker?.id
      );
      console.log(`✅ FALLBACK BOWLERS:`, fallbackBowlers.map(b => b.name));
      return fallbackBowlers;
    }
    
    return availableBowlers;
  };

  const getAvailableBatsmen = (): Player[] => {
    return match.battingTeam.players.filter(p => 
      p.id !== match.currentStriker?.id && 
      p.id !== match.currentNonStriker?.id
    );
  };

  const handleAddPlayer = (player: Player) => {
    const updatedMatch = { ...match };
    
    console.log(`✅ PLAYER SELECTED: ${player.name} (${player.isGuest ? 'Guest' : player.isGroupMember ? 'Group Member' : 'Player'})`);
    
    // Immediately update the match and UI
    if (addPlayerType === 'batting') {
      if (!updatedMatch.battingTeam.players.find(p => p.id === player.id)) {
        updatedMatch.battingTeam.players.push(player);
        console.log(`🏏 Added ${player.name} to batting team`);
      }
    } else {
      if (!updatedMatch.bowlingTeam.players.find(p => p.id === player.id)) {
        updatedMatch.bowlingTeam.players.push(player);
        console.log(`🎳 Added ${player.name} to bowling team`);
      }
    }
    
    setMatch(updatedMatch);
    setShowAddPlayerModal(false);
    
    // Save to storage in the background with indicator
    setBackgroundSaves(prev => prev + 1);
    storageService.savePlayer(player).then(() => {
      setBackgroundSaves(prev => Math.max(0, prev - 1));
    }).catch((error) => {
      console.error('Background save failed for player:', error);
      setBackgroundSaves(prev => Math.max(0, prev - 1));
    });
  };

  const currentGroup = authService.getCurrentGroup();
  const isGroupMatch = !match.isStandalone && currentGroup;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-2 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="text-center">
          <h1 className="font-bold text-base text-gray-900">Live Scorer</h1>
          {match.isStandalone && (
            <p className="text-xs text-orange-600">Standalone Match</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Connection Status */}
          <div className={`p-1 rounded-lg ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          
          {/* Cloud Status */}
          <div className={`p-1 rounded-lg ${lastCloudSave ? 'text-blue-600' : 'text-gray-400'}`}>
            {lastCloudSave ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
          </div>
          
          {/* Manual Save Button */}
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="Manual Save"
          >
            <Save className={`w-4 h-4 text-gray-600 ${isSaving ? 'animate-pulse' : ''}`} />
          </button>
          
          {/* Share Scoreboard */}
          {match.isCompleted && (
            <>
              <button
                onClick={async () => {
                  try {
                    await PDFService.shareToWhatsApp(match);
                  } catch (error) {
                    console.error('Failed to share to WhatsApp:', error);
                    alert('Failed to share to WhatsApp. Please try again.');
                  }
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-green-600"
                title="Share to WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              
              <button
                onClick={async () => {
                  try {
                    await PDFService.shareScoreboard(match);
                  } catch (error) {
                    console.error('Failed to share scoreboard:', error);
                    alert('Failed to share scoreboard. Please try again.');
                  }
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-blue-600"
                title="Share Scoreboard"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
          
          {/* Debug: Manual Bowler Selector */}
          {needsBowlerChange && (
            <button
              onClick={() => setShowBowlerSelector(true)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-red-600"
              title="Manual Bowler Selector"
            >
              <User className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => setShowScorecard(true)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="View Full Scorecard"
          >
            <span className="text-gray-600 font-semibold text-sm">Scorecard</span>
          </button>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* CRITICAL: Over Complete Message with MANDATORY Bowler Change */}
      {overCompleteMessage && needsBowlerChange && (
        <div className="bg-red-100 border-l-4 border-red-500 p-3 m-2">
          <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <p className="text-red-700 text-sm font-bold">{overCompleteMessage}</p>
              <p className="text-red-600 text-xs mt-1 font-semibold">
                🚫 MANDATORY: Select new bowler to continue. Same bowler CANNOT bowl consecutive overs!
              </p>
            </div>
            </div>
            {/* Manual trigger button - Fixed to be responsive */}
            <button
              onClick={() => {
                console.log('🔧 MANUAL BOWLER SELECTOR TRIGGER CLICKED');
                setShowBowlerSelector(true);
                console.log('🔧 showBowlerSelector set to true');
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 active:bg-red-800 transition-all duration-200 transform hover:scale-105 active:scale-95 font-medium shadow-md"
            >
              Select Bowler
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-2 space-y-2">
        <CompactScoreDisplay match={match} />
        
        <ScoringPanel
          match={match}
          onScoreUpdate={handleScoreUpdate}
          onUndo={handleUndo}
          canUndo={actionHistory.length > 0}
          pendingStrikeRotation={pendingStrikeRotation}
          onStrikeRotation={() => setPendingStrikeRotation(false)}
        />

        {/* Recent Balls */}
        {match.balls.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-2">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Recent Balls</h3>
            <div className="space-y-1">
              {match.balls.slice(-5).reverse().map((ball, index) => (
                <div key={ball.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0 text-xs">
                  <div className="text-gray-600">
                    {ball.overNumber}.{((ball.ballNumber - 1) % 6) + 1}
                  </div>
                  <div className="flex-1 mx-2">{ball.commentary}</div>
                  <div className="font-semibold">
                    {ball.runs}{ball.isWide ? 'wd' : ball.isNoBall ? 'nb' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Innings Break Modal */}
      <AnimatePresence>
        {showInningsBreak && (
          <InningsBreakModal
            match={match}
            onContinue={handleInningsBreakContinue}
          />
        )}
      </AnimatePresence>

      {/* Innings Setup Modal */}
      {showInningsSetup && (
        <InningsSetupModal
          match={match}
          isOpen={showInningsSetup}
          onClose={() => setShowInningsSetup(false)}
          onSetupComplete={handleInningsSetup}
          isSecondInnings={isSecondInningsSetup}
        />
      )}

      {/* CRITICAL: Bowler Selector Modal with ABSOLUTE filtering and MANDATORY selection */}
      {showBowlerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">🚫 MANDATORY: Select New Bowler</h2>
                <button
                  onClick={() => {
                    console.log('🔧 BOWLER SELECTOR CLOSE ATTEMPTED');
            // CRITICAL: Don't allow closing without selecting a bowler when it's mandatory
            if (needsBowlerChange) {
              alert('🚫 You MUST select a new bowler to continue!\n\nSame bowler cannot bowl consecutive overs.\n\nThis is a fundamental cricket rule.');
              return;
            }
            setShowBowlerSelector(false);
            setOverCompleteMessage(null);
            setNeedsBowlerChange(false);
          }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mt-2 opacity-90">Cannot Bowl Consecutive Overs</p>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">Available Bowlers:</h3>
                
                {/* Quick Add Guest Bowler */}
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-orange-800">Quick Add Guest Bowler</h4>
                      <p className="text-xs text-orange-600">Add a temporary player for this match</p>
                    </div>
                    <button
                      onClick={() => {
                        const guestName = prompt('Enter guest bowler name:');
                        if (guestName && guestName.trim()) {
                          const guestBowler: Player = {
                            id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            name: guestName.trim(),
                            isGroupMember: false,
                            isGuest: true,
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
                          
                          console.log(`🎯 QUICK ADD GUEST BOWLER: ${guestBowler.name}`);
                          
                          // Immediately add to bowling team and update UI
                          const updatedMatch = { ...match };
                          if (!updatedMatch.bowlingTeam.players.find(p => p.id === guestBowler.id)) {
                            updatedMatch.bowlingTeam.players.push(guestBowler);
                          }
                          setMatch(updatedMatch);
                          
                          // Select as current bowler immediately
                          handleBowlerChange(guestBowler);
                          
                          // Save to storage in the background with indicator
                          setBackgroundSaves(prev => prev + 1);
                          storageService.savePlayer(guestBowler).then(() => {
                            setBackgroundSaves(prev => Math.max(0, prev - 1));
                          }).catch((error) => {
                            console.error('Background save failed for guest bowler:', error);
                            setBackgroundSaves(prev => Math.max(0, prev - 1));
                          });
                        }
                      }}
                      className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 active:bg-orange-700 transition-all duration-200 transform hover:scale-105 active:scale-95 font-medium"
                    >
                      + Add Guest
                    </button>
                  </div>
                </div>
                
                {/* Group Players Section */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                    Group Players
                  </h4>
                  <div className="space-y-2">
                    {getAvailableBowlers()
                      .filter(bowler => bowler.isGroupMember)
                      .map((bowler) => (
                        <button
                          key={bowler.id}
                          onClick={() => {
                            console.log(`🎯 GROUP BOWLER SELECTED: ${bowler.name}`);
                            handleBowlerChange(bowler);
                          }}
                          className="w-full p-3 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 rounded-lg border border-purple-200 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-left"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {bowler.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{bowler.name}</span>
                              <div className="text-xs text-gray-500 mt-1">
                                Matches: {bowler.stats.matchesPlayed} | Wickets: {bowler.stats.wicketsTaken}
                              </div>
                            </div>
                            <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                              Member
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Guest Players Section */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                    Guest Players
                  </h4>
                  <div className="space-y-2">
                    {getAvailableBowlers()
                      .filter(bowler => bowler.isGuest)
                      .map((bowler) => (
                        <button
                          key={bowler.id}
                          onClick={() => {
                            console.log(`🎯 GUEST BOWLER SELECTED: ${bowler.name}`);
                            handleBowlerChange(bowler);
                          }}
                          className="w-full p-3 bg-orange-50 hover:bg-orange-100 active:bg-orange-200 rounded-lg border border-orange-200 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-left"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {bowler.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{bowler.name}</span>
                              <div className="text-xs text-gray-500 mt-1">
                                Matches: {bowler.stats.matchesPlayed} | Wickets: {bowler.stats.wicketsTaken}
                              </div>
                            </div>
                            <div className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                              Guest
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Other Players Section */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                    Other Players
                  </h4>
                  <div className="space-y-2">
                    {getAvailableBowlers()
                      .filter(bowler => !bowler.isGroupMember && !bowler.isGuest)
                      .map((bowler) => (
                        <button
                          key={bowler.id}
                          onClick={() => {
                            console.log(`🎯 OTHER BOWLER SELECTED: ${bowler.name}`);
                            handleBowlerChange(bowler);
                          }}
                          className="w-full p-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-lg border border-blue-200 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-left"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {bowler.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{bowler.name}</span>
                              <div className="text-xs text-gray-500 mt-1">
                                Matches: {bowler.stats.matchesPlayed} | Wickets: {bowler.stats.wicketsTaken}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
                
                {getAvailableBowlers().length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="font-medium mb-2">No available bowlers found</p>
                    <p className="text-sm mb-4">Add more bowlers to continue the match</p>
                    <button
                      onClick={() => {
                        setAddPlayerType('bowling');
                        setShowAddPlayerModal(true);
                        setShowBowlerSelector(false);
                      }}
                      className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 transform hover:scale-105 active:scale-95 font-medium shadow-md"
                    >
                      Add New Bowler
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Batsman Selector Modal */}
      {showNewBatsmanSelector && (
        <PlayerSelector
          title="Select New Batsman"
          onPlayerSelect={handleNewBatsman}
          onClose={() => {
            setShowNewBatsmanSelector(false);
            setNeedsNewBatsman(false);
          }}
          players={getAvailableBatsmen()}
          showOnlyAvailable={true}
          allowAddPlayer={true}
          groupId={currentGroup?.id}
          filterByGroup={isGroupMatch} // Filter by group for group matches
        />
      )}

      {/* Scorecard Modal */}
      {showScorecard && (
        <DetailedScorecardModal
          match={match}
          isOpen={showScorecard}
          onClose={() => setShowScorecard(false)}
        />
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <PlayerSelector
          title={`🚨 URGENT: Add ${addPlayerType === 'batting' ? 'Batsman' : 'Bowler'}`}
          onPlayerSelect={handleAddPlayer}
          onClose={() => setShowAddPlayerModal(false)}
          players={allPlayers}
          showOnlyAvailable={false}
          allowAddPlayer={true}
          groupId={currentGroup?.id}
          filterByGroup={isGroupMatch} // Filter by group for group matches
        />
      )}

      <AnimatePresence>
        {showVictoryAnimation && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <div className="bg-white rounded-lg p-8 text-center">
              <h2 className="text-3xl font-bold mb-4 text-green-600">
                {CricketEngine.getMatchResult(match)}
              </h2>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="text-6xl mb-4"
              >
                🏆
              </motion.div>
              {match.manOfTheMatch && (
                <div className="mt-4">
                  <p className="text-lg font-semibold text-yellow-600">Man of the Match</p>
                  <p className="text-xl font-bold text-gray-900">{match.manOfTheMatch.name}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Status Indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        {backgroundSaves > 0 && (
          <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg shadow-md flex items-center space-x-2 mb-2">
            <div className="animate-pulse rounded-full h-2 w-2 bg-green-600"></div>
            <span className="text-sm">Saving players... ({backgroundSaves})</span>
          </div>
        )}
        {isSaving && (
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-md flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800"></div>
            <span>Saving...</span>
          </div>
        )}
        {saveError && (
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg shadow-md flex items-center space-x-2 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{saveError}</span>
            {retryCount > 0 && (
              <span className="text-xs ml-2">(Retrying {retryCount}/3)</span>
            )}
          </div>
        )}
        {cloudSyncDisabled && (
          <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-md flex items-center space-x-2 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Cloud Sync Disabled</span>
            <button
              onClick={() => {
                setCloudSyncDisabled(false);
                setSaveError(null);
                setRetryCount(0);
                console.log('🔄 Cloud sync manually re-enabled');
              }}
              className="text-xs bg-red-200 hover:bg-red-300 px-2 py-1 rounded transition-colors"
            >
              Re-enable
            </button>
          </div>
        )}
        {!isOnline && (
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-lg shadow-md flex items-center space-x-2 mb-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">Offline Mode</span>
          </div>
        )}
        {lastCloudSave && (
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow-md flex items-center space-x-2 mb-2">
            <Cloud className="w-4 h-4" />
            <span className="text-xs">Last saved: {lastCloudSave.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};