import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, Target, Play } from 'lucide-react';
import { Player, Match } from '../types/cricket';
import { PlayerSelector } from './PlayerSelector';
import { storageService } from '../services/storage';
import { authService } from '../services/authService';

interface InningsSetupModalProps {
  match: Match;
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: (striker: Player, nonStriker: Player, bowler: Player) => void;
  isSecondInnings?: boolean;
}

export const InningsSetupModal: React.FC<InningsSetupModalProps> = ({
  match,
  isOpen,
  onClose,
  onSetupComplete,
  isSecondInnings = false
}) => {
  const [striker, setStriker] = useState<Player | null>(null);
  const [nonStriker, setNonStriker] = useState<Player | null>(null);
  const [bowler, setBowler] = useState<Player | null>(null);
  const [showPlayerSelector, setShowPlayerSelector] = useState<{
    type: 'striker' | 'nonStriker' | 'bowler';
    title: string;
  } | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset selections when modal opens
      setStriker(null);
      setNonStriker(null);
      setBowler(null);
      
      // PERFORMANCE FIX: Load players instantly from match data first
      const quickPlayers = getPlayersFromMatch();
      if (quickPlayers.length > 0) {
        setAllPlayers(quickPlayers);
        setLoading(false);
        console.log('⚡ INSTANT LOAD: Using players from match data');
      } else {
        // Fallback to async loading if no match players
        loadPlayersAsync();
      }
    }
  }, [isOpen]);

  // PERFORMANCE OPTIMIZATION: Get players from match teams instantly
  const getPlayersFromMatch = (): Player[] => {
    const players: Player[] = [];
    
    // Get all players from both teams
    if (match.team1?.players) {
      players.push(...match.team1.players);
    }
    if (match.team2?.players) {
      players.push(...match.team2.players);
    }
    
    // Remove duplicates by ID
    const uniquePlayers = players.filter((player, index, self) => 
      index === self.findIndex(p => p.id === player.id)
    );
    
    return uniquePlayers;
  };

  // BACKGROUND: Load additional players from storage (non-blocking)
  const loadPlayersAsync = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading additional players from storage...');
      
      // Get players from storage in background
      const storedPlayers = await storageService.getAllPlayers();
      
      // Merge with match players (avoid duplicates)
      const matchPlayers = getPlayersFromMatch();
      const allUniqueIds = new Set(matchPlayers.map(p => p.id));
      const additionalPlayers = storedPlayers.filter(p => !allUniqueIds.has(p.id));
      
      const combinedPlayers = [...matchPlayers, ...additionalPlayers];
      
      console.log(`✅ Combined total: ${combinedPlayers.length} players (${matchPlayers.length} from match, ${additionalPlayers.length} additional)`);
      setAllPlayers(combinedPlayers);
    } catch (error) {
      console.error('❌ Failed to load additional players:', error);
      // Keep the match players we already have
      console.log('ℹ️ Continuing with match players only');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSelect = (player: Player) => {
    if (!showPlayerSelector) return;

    console.log(`Selected ${showPlayerSelector.type}: ${player.name}`);

    switch (showPlayerSelector.type) {
      case 'striker':
        setStriker(player);
        break;
      case 'nonStriker':
        setNonStriker(player);
        break;
      case 'bowler':
        setBowler(player);
        break;
    }
    
    // AUTO-CLOSE: Close player selector modal automatically after selection
    setShowPlayerSelector(null);
  };

  // MEMOIZED: Available players calculation to prevent re-computation
  const getAvailablePlayers = useMemo(() => {
    return (type: string): Player[] => {
      const currentGroup = authService.getCurrentGroup();
      const isGroupMatch = !match.isStandalone && currentGroup;
      
      switch (type) {
        case 'striker':
        case 'nonStriker':
          // For batsmen, exclude:
          // 1. The other selected batsman
          // 2. Any selected bowler
          // 3. Players who are already in the bowling team
          let battingPlayers = allPlayers.filter(p => 
            p.id !== striker?.id && 
            p.id !== nonStriker?.id &&
            p.id !== bowler?.id &&
            !match.bowlingTeam.players.some(bowler => bowler.id === p.id)
          );
          
          // For group matches, prioritize group members but allow others
          if (isGroupMatch) {
            const groupPlayers = battingPlayers.filter(p => 
              p.isGroupMember && p.groupIds?.includes(currentGroup.id)
            );
            const otherPlayers = battingPlayers.filter(p => 
              !(p.isGroupMember && p.groupIds?.includes(currentGroup.id))
            );
            return [...groupPlayers, ...otherPlayers];
          }
          
          return battingPlayers;
          
        case 'bowler':
          // For bowler, exclude:
          // 1. Selected batsmen
          // 2. Players who are already in the batting team
          let bowlingPlayers = allPlayers.filter(p => 
            p.id !== striker?.id && 
            p.id !== nonStriker?.id &&
            !match.battingTeam.players.some(batsman => batsman.id === p.id)
          );
          
          // For group matches, prioritize group members but allow others
          if (isGroupMatch) {
            const groupPlayers = bowlingPlayers.filter(p => 
              p.isGroupMember && p.groupIds?.includes(currentGroup.id)
            );
            const otherPlayers = bowlingPlayers.filter(p => 
              !(p.isGroupMember && p.groupIds?.includes(currentGroup.id))
            );
            return [...groupPlayers, ...otherPlayers];
          }
          
          return bowlingPlayers;
          
        default:
          return allPlayers;
      }
    };
  }, [allPlayers, striker, nonStriker, bowler, match]);

  const handleInningsSetup = (striker: Player, nonStriker: Player, bowler: Player) => {
    if (!striker || !nonStriker || !bowler) {
      alert('Please select all three players (striker, non-striker, and bowler) before starting the innings.');
      return;
    }

    // Validate that players are not already in the opposite team
    if (match.bowlingTeam.players.some(p => p.id === striker.id || p.id === nonStriker.id)) {
      alert('Selected batsmen cannot be from the bowling team.');
      return;
    }

    if (match.battingTeam.players.some(p => p.id === bowler.id)) {
      alert('Selected bowler cannot be from the batting team.');
      return;
    }

    console.log('Starting innings with:', {
      striker: striker.name,
      nonStriker: nonStriker.name,
      bowler: bowler.name
    });

    onSetupComplete(striker, nonStriker, bowler);
  };

  const canComplete = striker && nonStriker && bowler;
  const currentGroup = authService.getCurrentGroup();
  const isGroupMatch = !match.isStandalone && currentGroup;

  if (!isOpen) return null;

  // PERFORMANCE: Show modal immediately, load additional players in background
  // No loading spinner needed since we show match players instantly

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all duration-200 animate-slideUp">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {isSecondInnings ? 'Second Innings Setup' : 'First Innings Setup'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          {isSecondInnings && (
            <p className="text-sm text-gray-600 mt-2">
              Select opening batsmen and bowler for the chase
            </p>
          )}
          {isGroupMatch && (
            <p className="text-sm text-blue-600 mt-2">
              Group players from {currentGroup.name} will be shown first
            </p>
          )}
        </div>

        <div className="p-6 space-y-6">
          {isSecondInnings && match.firstInningsScore && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center mb-2">
                <Target className="w-5 h-5 text-orange-600 mr-2" />
                <span className="font-semibold text-orange-800">Target to Win</span>
              </div>
              <div className="text-3xl font-bold text-orange-900 mb-1">
                {match.firstInningsScore + 1} runs
              </div>
              <div className="text-sm text-orange-700">
                {match.battingTeam.name} needs {match.firstInningsScore + 1} runs in {match.totalOvers} overs
              </div>
              <div className="text-xs text-orange-600 mt-1">
                Required run rate: {((match.firstInningsScore + 1) / match.totalOvers).toFixed(2)} per over
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Select Players ({canComplete ? '3/3' : `${[striker, nonStriker, bowler].filter(Boolean).length}/3`} selected)
            </h3>

            {/* Striker Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Batsman (Striker) *
              </label>
              <button
                onClick={() => setShowPlayerSelector({
                  type: 'striker',
                  title: 'Select Opening Batsman (Striker)'
                })}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  striker
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-300'
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    {striker ? striker.name : 'Select Striker'}
                  </div>
                  {striker ? (
                    <div className="text-sm text-green-600">
                      ✓ {striker.stats.runsScored} runs • {striker.stats.matchesPlayed} matches
                      {striker.isGroupMember && isGroupMatch && (
                        <span className="ml-2 text-purple-600">👑 Group Member</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Tap to select opening batsman (on strike)
                    </div>
                  )}
                </div>
              </button>
            </div>

            {/* Non-Striker Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Batsman (Non-Striker) *
              </label>
              <button
                onClick={() => setShowPlayerSelector({
                  type: 'nonStriker',
                  title: 'Select Opening Batsman (Non-Striker)'
                })}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  nonStriker
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    {nonStriker ? nonStriker.name : 'Select Non-Striker'}
                  </div>
                  {nonStriker ? (
                    <div className="text-sm text-blue-600">
                      ✓ {nonStriker.stats.runsScored} runs • {nonStriker.stats.matchesPlayed} matches
                      {nonStriker.isGroupMember && isGroupMatch && (
                        <span className="ml-2 text-purple-600">👑 Group Member</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Tap to select opening batsman (not on strike)
                    </div>
                  )}
                </div>
              </button>
            </div>

            {/* Bowler Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Bowler *
              </label>
              <button
                onClick={() => setShowPlayerSelector({
                  type: 'bowler',
                  title: 'Select Opening Bowler'
                })}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  bowler
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 hover:border-red-300'
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    {bowler ? bowler.name : 'Select Bowler'}
                  </div>
                  {bowler ? (
                    <div className="text-sm text-red-600">
                      ✓ {bowler.stats.wicketsTaken} wickets • {bowler.stats.matchesPlayed} matches
                      {bowler.isGroupMember && isGroupMatch && (
                        <span className="ml-2 text-purple-600">👑 Group Member</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Tap to select opening bowler
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Setup Progress</span>
              <span className={`font-semibold ${canComplete ? 'text-green-600' : 'text-orange-600'}`}>
                {[striker, nonStriker, bowler].filter(Boolean).length}/3 players selected
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  canComplete ? 'bg-green-500' : 'bg-orange-500'
                }`}
                style={{ width: `${([striker, nonStriker, bowler].filter(Boolean).length / 3) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleInningsSetup(striker, nonStriker, bowler)}
              disabled={!canComplete}
              className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center ${
                canComplete
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 mr-2" />
              {isSecondInnings ? 'Start Second Innings' : 'Start Match'}
            </button>
          </div>

          {!canComplete && (
            <div className="text-center">
              <p className="text-sm text-orange-600 font-medium">
                ⚠️ Please select all 3 players to continue
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Player Selector Modal */}
      {showPlayerSelector && (
        <PlayerSelector
          title={showPlayerSelector.title}
          onPlayerSelect={handlePlayerSelect}
          onClose={() => setShowPlayerSelector(null)}
          players={getAvailablePlayers(showPlayerSelector.type)}
          allowAddPlayer={true}
          groupId={currentGroup?.id}
          filterByGroup={isGroupMatch} // Filter by group for group matches
        />
      )}
    </div>
  );
};