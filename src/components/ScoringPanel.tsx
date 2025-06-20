import React, { useState, useEffect } from 'react';
import { RotateCcw, RefreshCw, UserPlus, Users } from 'lucide-react';
import { Match, Player, Ball, WicketType } from '../types/cricket';
import { PlayerSelector } from './PlayerSelector';
import { authService } from '../services/authService';

interface ScoringPanelProps {
  match: Match;
  onScoreUpdate: (ball: Ball) => void;
  onUndo: () => void;
  canUndo: boolean;
  pendingStrikeRotation?: boolean;
  onStrikeRotation?: () => void;
}

export const ScoringPanel: React.FC<ScoringPanelProps> = ({
  match,
  onScoreUpdate,
  onUndo,
  canUndo,
  pendingStrikeRotation,
  onStrikeRotation
}) => {
  const [showPlayerSelector, setShowPlayerSelector] = useState<{
    type: 'striker' | 'nonStriker' | 'bowler' | 'fielder' | 'newBatsman';
    title: string;
  } | null>(null);
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [showWicketOptions, setShowWicketOptions] = useState(false);
  const [showExtraRuns, setShowExtraRuns] = useState(false);
  const [extraRuns, setExtraRuns] = useState(0);
  const [extraType, setExtraType] = useState<'wide' | 'noBall' | 'bye' | 'legBye' | null>(null);

  const currentBallNumber = (match.battingTeam.overs * 6) + match.battingTeam.balls + 1;
  const currentOver = match.battingTeam.overs + 1;

  const createBall = (runs: number, extras: any = {}, wicket: any = {}): Ball => {
    return {
      id: `ball_${Date.now()}_${Math.random()}`,
      ballNumber: currentBallNumber,
      overNumber: currentOver,
      bowler: match.currentBowler!,
      striker: match.currentStriker!,
      nonStriker: match.currentNonStriker!,
      runs,
      isWide: extras.isWide || false,
      isNoBall: extras.isNoBall || false,
      isBye: extras.isBye || false,
      isLegBye: extras.isLegBye || false,
      isWicket: wicket.isWicket || false,
      wicketType: wicket.wicketType,
      fielder: wicket.fielder,
      commentary: generateCommentary(runs, extras, wicket),
      timestamp: Date.now()
    };
  };

  const generateCommentary = (runs: number, extras: any, wicket: any): string => {
    if (wicket.isWicket) {
      return `${match.currentStriker?.name} ${wicket.wicketType}${wicket.fielder ? ` by ${wicket.fielder.name}` : ''} for ${runs}`;
    }
    if (extras.isWide) return `Wide, ${runs} runs`;
    if (extras.isNoBall) return `No ball, ${runs} runs`;
    if (extras.isBye) return `${runs} bye${runs !== 1 ? 's' : ''}`;
    if (extras.isLegBye) return `${runs} leg bye${runs !== 1 ? 's' : ''}`;
    
    switch (runs) {
      case 0: return 'Dot ball';
      case 1: return 'Single';
      case 2: return 'Two runs';
      case 3: return 'Three runs';
      case 4: return 'Four!';
      case 6: return 'Six!';
      default: return `${runs} runs`;
    }
  };

  const handleRun = (runs: number) => {
    if (!match.currentStriker || !match.currentNonStriker || !match.currentBowler) {
      setShowPlayerSelector({
        type: 'striker',
        title: 'Please select all players first'
      });
      return;
    }

    const ball = createBall(runs);
    onScoreUpdate(ball);
  };

  const handleExtra = (type: 'wide' | 'noBall' | 'bye' | 'legBye') => {
    setExtraType(type);
    setExtraRuns(1);
    setShowExtraRuns(true);
  };

  const handleExtraConfirm = () => {
    if (!match.currentStriker || !match.currentNonStriker || !match.currentBowler || !extraType) {
      return;
    }

    const ball = createBall(extraRuns, {
      isWide: extraType === 'wide',
      isNoBall: extraType === 'noBall',
      isBye: extraType === 'bye',
      isLegBye: extraType === 'legBye'
    });

    onScoreUpdate(ball);
    setShowExtraRuns(false);
    setExtraRuns(0);
    setExtraType(null);
  };

  const handleWicket = (type: WicketType) => {
    if (!match.currentStriker || !match.currentNonStriker || !match.currentBowler) {
      return;
    }

    if (type === 'caught' || type === 'run_out' || type === 'stumped') {
      setWicketType(type);
      setShowPlayerSelector({
        type: 'fielder',
        title: `Select ${type === 'caught' ? 'Fielder' : type === 'run_out' ? 'Run Out By' : 'Wicket Keeper'}`
      });
    } else {
      const ball = createBall(0, {}, {
        isWicket: true,
        wicketType: type
      });
      onScoreUpdate(ball);
      setShowWicketOptions(false);
      
      // Show new batsman selector after wicket
      setTimeout(() => {
        setShowPlayerSelector({
          type: 'newBatsman',
          title: 'Select New Batsman'
        });
      }, 500);
    }
  };

  const handlePlayerSelect = (player: Player) => {
    if (!showPlayerSelector) return;

    switch (showPlayerSelector.type) {
      case 'fielder':
        const ball = createBall(0, {}, {
          isWicket: true,
          wicketType: wicketType,
          fielder: player
        });
        onScoreUpdate(ball);
        setWicketType(null);
        setShowWicketOptions(false);
        
        // Show new batsman selector after wicket
        setTimeout(() => {
          setShowPlayerSelector({
            type: 'newBatsman',
            title: 'Select New Batsman'
          });
        }, 500);
        break;
      case 'newBatsman':
        // Replace the out batsman with new batsman
        // This would be handled by the parent component
        break;
    }
    setShowPlayerSelector(null);
  };

  const getPlayersForSelector = (): Player[] => {
    if (!showPlayerSelector) return [];
    
    switch (showPlayerSelector.type) {
      case 'fielder':
        return match.bowlingTeam.players || [];
      case 'newBatsman':
        return match.battingTeam.players.filter(p => 
          p.id !== match.currentStriker?.id && 
          p.id !== match.currentNonStriker?.id
        ) || [];
      default:
        return [];
    }
  };

  const currentGroup = authService.getCurrentGroup();

  // Check if all players are selected
  const allPlayersSelected = match.currentStriker && match.currentNonStriker && match.currentBowler;

  if (!allPlayersSelected) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Players to Start</h3>
          <p className="text-gray-600 mb-6">Please select striker, non-striker, and bowler to begin scoring</p>
          
          <div className="space-y-3">
            {!match.currentStriker && (
              <button
                onClick={() => setShowPlayerSelector({
                  type: 'striker',
                  title: 'Select Striker'
                })}
                className="w-full p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <UserPlus className="w-5 h-5 inline mr-2 text-green-600" />
                <span className="text-green-700 font-medium">Select Striker</span>
              </button>
            )}
            
            {!match.currentNonStriker && (
              <button
                onClick={() => setShowPlayerSelector({
                  type: 'nonStriker',
                  title: 'Select Non-Striker'
                })}
                className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <UserPlus className="w-5 h-5 inline mr-2 text-blue-600" />
                <span className="text-blue-700 font-medium">Select Non-Striker</span>
              </button>
            )}
            
            {!match.currentBowler && (
              <button
                onClick={() => setShowPlayerSelector({
                  type: 'bowler',
                  title: 'Select Bowler'
                })}
                className="w-full p-4 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <UserPlus className="w-5 h-5 inline mr-2 text-red-600" />
                <span className="text-red-700 font-medium">Select Bowler</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        {/* Current Over Info */}
        <div className="bg-green-50 rounded-lg p-3 mb-4 text-center">
          <div className="text-sm text-green-600 font-medium">
            Over {currentOver} • Ball {(match.battingTeam.balls % 6) + 1}
          </div>
          <div className="text-xs text-green-500 mt-1">
            {match.currentBowler.name} to {match.currentStriker.name}
          </div>
        </div>

        {/* Strike Rotation Alert */}
        {pendingStrikeRotation && (
          <div className="bg-blue-100 border-l-4 border-blue-500 p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 text-blue-600 mr-2" />
                <p className="text-blue-700 text-sm font-semibold">Strike Rotated</p>
              </div>
              <button
                onClick={onStrikeRotation}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Runs */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Runs</h3>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 6].map((runs) => (
              <button
                key={runs}
                onClick={() => handleRun(runs)}
                className={`py-4 rounded-xl font-bold text-lg transition-all ${
                  runs === 0
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : runs === 4
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg'
                    : runs === 6
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
                    : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                }`}
              >
                {runs}
              </button>
            ))}
          </div>
        </div>

        {/* Extras */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Extras</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleExtra('wide')}
              className="py-3 px-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Wide
            </button>
            <button
              onClick={() => handleExtra('noBall')}
              className="py-3 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              No Ball
            </button>
            <button
              onClick={() => handleExtra('bye')}
              className="py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Bye
            </button>
            <button
              onClick={() => handleExtra('legBye')}
              className="py-3 px-4 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              Leg Bye
            </button>
          </div>
        </div>

        {/* Wicket */}
        <div className="mb-6">
          <button
            onClick={() => setShowWicketOptions(!showWicketOptions)}
            className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Wicket
          </button>

          {showWicketOptions && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleWicket('bowled')}
                className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                Bowled
              </button>
              <button
                onClick={() => handleWicket('caught')}
                className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                Caught
              </button>
              <button
                onClick={() => handleWicket('lbw')}
                className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                LBW
              </button>
              <button
                onClick={() => handleWicket('run_out')}
                className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                Run Out
              </button>
              <button
                onClick={() => handleWicket('stumped')}
                className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                Stumped
              </button>
              <button
                onClick={() => handleWicket('hit_wicket')}
                className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                Hit Wicket
              </button>
            </div>
          )}
        </div>

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${
            canUndo
              ? 'bg-gray-600 text-white hover:bg-gray-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-5 h-5 inline mr-2" />
          Undo Last Ball
        </button>
      </div>

      {/* Player Selector Modal */}
      {showPlayerSelector && (
        <PlayerSelector
          title={showPlayerSelector.title}
          onPlayerSelect={handlePlayerSelect}
          onClose={() => setShowPlayerSelector(null)}
          players={getPlayersForSelector()}
          allowAddPlayer={true}
          groupId={currentGroup?.id}
        />
      )}

      {/* Extra Runs Modal */}
      {showExtraRuns && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">
              {extraType === 'wide' ? 'Wide' : 
               extraType === 'noBall' ? 'No Ball' : 
               extraType === 'bye' ? 'Bye' : 'Leg Bye'} Runs
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6].map(runs => (
                <button
                  key={runs}
                  onClick={() => setExtraRuns(runs)}
                  className={`p-3 rounded-lg transition-colors ${
                    extraRuns === runs
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {runs}
                </button>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowExtraRuns(false);
                  setExtraType(null);
                  setExtraRuns(0);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExtraConfirm}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};