import React, { useState, useEffect } from 'react';
import { Play, Users, Trophy, Sparkles, Target, Clock, ChevronDown, Search, History, Plus, AlertCircle, AlertTriangle } from 'lucide-react';
import { Match, Team, MatchFormat, MATCH_FORMATS, Player } from '../types/cricket';
import { InningsSetupModal } from './InningsSetupModal';
import { storageService } from '../services/storage';
import { authService } from '../services/authService';

interface MatchSetupProps {
  onMatchStart: (match: Match) => void;
  isStandalone?: boolean;
}

export const MatchSetup: React.FC<MatchSetupProps> = ({ onMatchStart, isStandalone = false }) => {
  const [team1Name, setTeam1Name] = useState('');
  const [team2Name, setTeam2Name] = useState('');
  const [tossWinner, setTossWinner] = useState<'team1' | 'team2' | ''>('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | ''>('');
  const [selectedFormat, setSelectedFormat] = useState<MatchFormat>(MATCH_FORMATS[0]);
  const [customOvers, setCustomOvers] = useState(15);
  const [showInningsSetup, setShowInningsSetup] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  
  // Team suggestions state
  const [teamSuggestions, setTeamSuggestions] = useState<string[]>([]);
  const [showTeam1Suggestions, setShowTeam1Suggestions] = useState(false);
  const [showTeam2Suggestions, setShowTeam2Suggestions] = useState(false);
  const [filteredTeam1Suggestions, setFilteredTeam1Suggestions] = useState<string[]>([]);
  const [filteredTeam2Suggestions, setFilteredTeam2Suggestions] = useState<string[]>([]);

  const canStartMatch = team1Name.trim() && team2Name.trim() && tossWinner && tossDecision && (isStandalone || currentGroup);

  // Load current group and team suggestions
  useEffect(() => {
    const loadGroupAndSuggestions = async () => {
      if (!isStandalone) {
        // Get current group for group matches
        const group = authService.getCurrentGroup();
        setCurrentGroup(group);
        
        if (!group) {
          console.log('No group selected for match setup');
          return;
        }
        
        console.log('🏏 Setting up group match for:', group.name);
        
        // Load team suggestions from group match history
        try {
          const matches = await storageService.getAllMatches();
          
          // Filter matches by group
          const groupMatches = matches.filter(match => {
            const allMatchPlayers = [
              ...match.team1.players,
              ...match.team2.players,
              ...(match.battingTeam?.players || []),
              ...(match.bowlingTeam?.players || [])
            ];
            
            return allMatchPlayers.some(player => 
              player.isGroupMember && 
              player.groupIds?.includes(group.id)
            );
          });
          
          const teamNames = new Set<string>();
          
          groupMatches.forEach(match => {
            if (match.team1.name) teamNames.add(match.team1.name);
            if (match.team2.name) teamNames.add(match.team2.name);
          });
          
          const sortedTeams = Array.from(teamNames).sort((a, b) => {
            // Sort by frequency (most used first)
            const aCount = groupMatches.filter(m => m.team1.name === a || m.team2.name === a).length;
            const bCount = groupMatches.filter(m => m.team1.name === b || m.team2.name === b).length;
            return bCount - aCount;
          });
          
          setTeamSuggestions(sortedTeams);
          console.log('📋 Loaded team suggestions for group:', sortedTeams);
        } catch (error) {
          console.error('Failed to load team suggestions:', error);
        }
      } else {
        // For standalone matches, load all team suggestions
        console.log('🏏 Setting up standalone match');
        try {
          const matches = await storageService.getAllMatches();
          const teamNames = new Set<string>();
          
          matches.forEach(match => {
            if (match.team1.name) teamNames.add(match.team1.name);
            if (match.team2.name) teamNames.add(match.team2.name);
          });
          
          setTeamSuggestions(Array.from(teamNames).sort());
        } catch (error) {
          console.error('Failed to load team suggestions:', error);
        }
      }
    };
    
    loadGroupAndSuggestions();
  }, [isStandalone]);

  // Filter suggestions based on input
  useEffect(() => {
    const filter1 = teamSuggestions.filter(name => 
      name.toLowerCase().includes(team1Name.toLowerCase()) && 
      name !== team1Name
    );
    setFilteredTeam1Suggestions(filter1.slice(0, 5));
  }, [team1Name, teamSuggestions]);

  useEffect(() => {
    const filter2 = teamSuggestions.filter(name => 
      name.toLowerCase().includes(team2Name.toLowerCase()) && 
      name !== team2Name
    );
    setFilteredTeam2Suggestions(filter2.slice(0, 5));
  }, [team2Name, teamSuggestions]);

  const handleCreateMatch = () => {
    if (!canStartMatch) return;

    const overs = selectedFormat.name === 'Custom' ? customOvers : selectedFormat.overs;

    const team1: Team = {
      name: team1Name.trim(),
      players: [],
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      extras: { byes: 0, legByes: 0, wides: 0, noBalls: 0 }
    };

    const team2: Team = {
      name: team2Name.trim(),
      players: [],
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      extras: { byes: 0, legByes: 0, wides: 0, noBalls: 0 }
    };

    const battingFirst = (tossWinner === 'team1' && tossDecision === 'bat') || 
                        (tossWinner === 'team2' && tossDecision === 'bowl');

    const newMatch: Match = {
      id: `match_${Date.now()}`,
      team1,
      team2,
      tossWinner: tossWinner === 'team1' ? team1Name : team2Name,
      tossDecision,
      currentInnings: 1,
      battingTeam: battingFirst ? team1 : team2,
      bowlingTeam: battingFirst ? team2 : team1,
      totalOvers: overs,
      balls: [],
      isCompleted: false,
      isSecondInnings: false,
      startTime: Date.now(),
      groupId: isStandalone ? undefined : currentGroup?.id, // No group ID for standalone matches
      isStandalone: isStandalone // Mark as standalone match
    };

    console.log('🏏 Creating match:', isStandalone ? 'Standalone' : `Group (${currentGroup?.name})`, newMatch);
    setMatch(newMatch);
    setShowInningsSetup(true);
  };

  const handleInningsSetup = (striker: Player, nonStriker: Player, bowler: Player) => {
    if (!match) return;

    const updatedMatch = { ...match };
    updatedMatch.currentStriker = striker;
    updatedMatch.currentNonStriker = nonStriker;
    updatedMatch.currentBowler = bowler;

    // For standalone matches, don't associate players with groups
    const ensurePlayerSetup = (player: Player) => {
      // Create a copy of the player to avoid modifying the original
      const updatedPlayer = { ...player };
      
      if (isStandalone) {
        // For standalone matches, only mark new players as guests
        if (!updatedPlayer.isGroupMember) {
          updatedPlayer.isGuest = true;
        }
        // Don't modify groupIds for existing group members in standalone matches
      } else if (currentGroup) {
        // For group matches, associate with current group if not already a guest
        if (!updatedPlayer.isGuest) {
          if (!updatedPlayer.groupIds) {
            updatedPlayer.groupIds = [];
          }
          if (!updatedPlayer.groupIds.includes(currentGroup.id)) {
            updatedPlayer.groupIds.push(currentGroup.id);
          }
          updatedPlayer.isGroupMember = true;
        }
      }
      return updatedPlayer;
    };

    // Setup players
    const updatedStriker = ensurePlayerSetup(striker);
    const updatedNonStriker = ensurePlayerSetup(nonStriker);
    const updatedBowler = ensurePlayerSetup(bowler);

    // Add players to their respective teams
    if (!updatedMatch.battingTeam.players.find(p => p.id === updatedStriker.id)) {
      updatedMatch.battingTeam.players.push(updatedStriker);
    }
    if (!updatedMatch.battingTeam.players.find(p => p.id === updatedNonStriker.id)) {
      updatedMatch.battingTeam.players.push(updatedNonStriker);
    }
    if (!updatedMatch.bowlingTeam.players.find(p => p.id === updatedBowler.id)) {
      updatedMatch.bowlingTeam.players.push(updatedBowler);
    }

    // Save updated players to storage
    storageService.savePlayer(updatedStriker);
    storageService.savePlayer(updatedNonStriker);
    storageService.savePlayer(updatedBowler);

    console.log('🏏 Starting match:', {
      type: isStandalone ? 'Standalone' : 'Group',
      group: currentGroup?.name,
      striker: updatedStriker.name,
      nonStriker: updatedNonStriker.name,
      bowler: updatedBowler.name,
      playerTypes: {
        striker: updatedStriker.isGuest ? 'Guest' : updatedStriker.isGroupMember ? 'Group Member' : 'Player',
        nonStriker: updatedNonStriker.isGuest ? 'Guest' : updatedNonStriker.isGroupMember ? 'Group Member' : 'Player',
        bowler: updatedBowler.isGuest ? 'Guest' : updatedBowler.isGroupMember ? 'Group Member' : 'Player'
      }
    });

    setShowInningsSetup(false);
    onMatchStart(updatedMatch);
  };

  const selectTeamSuggestion = (teamNumber: 1 | 2, name: string) => {
    if (teamNumber === 1) {
      setTeam1Name(name);
      setShowTeam1Suggestions(false);
    } else {
      setTeam2Name(name);
      setShowTeam2Suggestions(false);
    }
  };

  // Show group selection prompt if no group is selected for group matches
  if (!isStandalone && !currentGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20 text-center">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-4">No Group Selected</h1>
            <p className="text-purple-200 mb-8">You need to create or join a group before starting a group match. All match statistics will be associated with your group.</p>
            
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-2xl font-bold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              Manage Groups
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-2xl border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-medium">
                {isStandalone ? 'Standalone Match Setup' : 'Group Match Setup'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Setup Your
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Match</span>
            </h1>
            
            <p className="text-xl text-purple-200 mb-4">Configure teams, format & toss in seconds</p>
            
            {/* Match Type Info */}
            {isStandalone ? (
              <div className="inline-flex items-center space-x-2 bg-orange-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-orange-400/30">
                <AlertTriangle className="w-4 h-4 text-orange-300" />
                <span className="text-orange-200 text-sm font-medium">Standalone Mode - Personal stats only</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 bg-green-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-green-400/30">
                <Users className="w-4 h-4 text-green-300" />
                <span className="text-green-200 text-sm font-medium">Group: {currentGroup?.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {/* Standalone Mode Disclaimer */}
            {isStandalone && (
              <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-orange-400 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-orange-200 font-semibold mb-2">Standalone Match Notice</h3>
                    <ul className="text-orange-300 text-sm space-y-1">
                      <li>• This match will NOT count towards group records or leaderboards</li>
                      <li>• Player statistics will still be tracked for personal records</li>
                      <li>• Match data is saved locally and can be synced to cloud if signed in</li>
                      <li>• Perfect for casual games, practice matches, or when no group is available</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Team Names Section */}
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Team Names</h2>
                <p className="text-purple-200">Enter team names or select from {isStandalone ? 'match' : 'group'} history</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Team 1 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-purple-200 mb-3">
                    <Users className="w-4 h-4 inline mr-2" />
                    Team 1 Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={team1Name}
                      onChange={(e) => {
                        setTeam1Name(e.target.value);
                        setShowTeam1Suggestions(true);
                      }}
                      onFocus={() => setShowTeam1Suggestions(true)}
                      className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter team name"
                    />
                    <button
                      onClick={() => setShowTeam1Suggestions(!showTeam1Suggestions)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-300 hover:text-white transition-colors"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${showTeam1Suggestions ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  {/* Team 1 Suggestions */}
                  {showTeam1Suggestions && filteredTeam1Suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden">
                      {filteredTeam1Suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => selectTeamSuggestion(1, suggestion)}
                          className="w-full px-4 py-3 text-left text-white hover:bg-white/20 transition-colors flex items-center space-x-3"
                        >
                          <History className="w-4 h-4 text-purple-300" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team 2 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-purple-200 mb-3">
                    <Users className="w-4 h-4 inline mr-2" />
                    Team 2 Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={team2Name}
                      onChange={(e) => {
                        setTeam2Name(e.target.value);
                        setShowTeam2Suggestions(true);
                      }}
                      onFocus={() => setShowTeam2Suggestions(true)}
                      className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="Enter team name"
                    />
                    <button
                      onClick={() => setShowTeam2Suggestions(!showTeam2Suggestions)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-300 hover:text-white transition-colors"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${showTeam2Suggestions ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  {/* Team 2 Suggestions */}
                  {showTeam2Suggestions && filteredTeam2Suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden">
                      {filteredTeam2Suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => selectTeamSuggestion(2, suggestion)}
                          className="w-full px-4 py-3 text-left text-white hover:bg-white/20 transition-colors flex items-center space-x-3"
                        >
                          <History className="w-4 h-4 text-purple-300" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Match Format Section */}
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Match Format</h2>
                <p className="text-purple-200">Choose your preferred format</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {MATCH_FORMATS.map((format) => (
                  <button
                    key={format.name}
                    onClick={() => setSelectedFormat(format)}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                      selectedFormat.name === format.name
                        ? 'border-purple-500 bg-purple-500/20 text-white'
                        : 'border-white/20 bg-white/5 text-purple-200 hover:border-purple-400/50 hover:bg-white/10'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="font-bold text-lg mb-2">{format.name}</div>
                      {format.overs > 0 && (
                        <div className="flex items-center justify-center space-x-1 text-sm opacity-80">
                          <Clock className="w-4 h-4" />
                          <span>{format.overs} overs</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {selectedFormat.name === 'Custom' && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <label className="block text-sm font-medium text-purple-200 mb-3">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Custom Overs (1-50)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      value={customOvers || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setCustomOvers(1);
                        } else {
                          const numValue = parseInt(value);
                          if (numValue >= 1 && numValue <= 50) {
                            setCustomOvers(numValue);
                          } else if (numValue > 50) {
                            setCustomOvers(50);
                          } else if (numValue < 1) {
                            setCustomOvers(1);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (!customOvers || customOvers < 1) {
                          setCustomOvers(1);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white text-center text-lg font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="15"
                      min="1"
                      max="50"
                    />
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setCustomOvers(Math.max(1, customOvers - 1))}
                        className="p-2 bg-purple-500/20 hover:bg-purple-500/40 text-white rounded-lg transition-colors"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomOvers(Math.min(50, customOvers + 1))}
                        className="p-2 bg-purple-500/20 hover:bg-purple-500/40 text-white rounded-lg transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-purple-300 text-sm">
                      Match Duration: Approximately {Math.round(customOvers * 4)} minutes
                    </span>
                  </div>
                  {/* Quick Select Buttons */}
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[5, 10, 15, 20, 25, 30].map((overs) => (
                      <button
                        key={overs}
                        type="button"
                        onClick={() => setCustomOvers(overs)}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                          customOvers === overs
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                      >
                        {overs}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Toss Section */}
            {team1Name && team2Name && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Toss</h2>
                  <p className="text-purple-200">Who won the toss and what did they choose?</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Toss Winner */}
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-3">Toss Winner</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTossWinner('team1')}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 ${
                          tossWinner === 'team1'
                            ? 'border-green-500 bg-green-500/20 text-white'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-green-400/50 hover:bg-white/10'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 font-medium">{team1Name}</div>
                      </button>
                      <button
                        onClick={() => setTossWinner('team2')}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 ${
                          tossWinner === 'team2'
                            ? 'border-green-500 bg-green-500/20 text-white'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-green-400/50 hover:bg-white/10'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 font-medium">{team2Name}</div>
                      </button>
                    </div>
                  </div>

                  {/* Toss Decision */}
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-3">Toss Decision</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTossDecision('bat')}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 ${
                          tossDecision === 'bat'
                            ? 'border-blue-500 bg-blue-500/20 text-white'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-blue-400/50 hover:bg-white/10'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 font-medium">Bat First</div>
                      </button>
                      <button
                        onClick={() => setTossDecision('bowl')}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 ${
                          tossDecision === 'bowl'
                            ? 'border-blue-500 bg-blue-500/20 text-white'
                            : 'border-white/20 bg-white/5 text-purple-200 hover:border-blue-400/50 hover:bg-white/10'
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative z-10 font-medium">Bowl First</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Start Match Button */}
            <button
              onClick={handleCreateMatch}
              disabled={!canStartMatch}
              className={`w-full py-6 rounded-2xl font-bold text-lg transition-all duration-300 ${
                canStartMatch
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:scale-105 text-white'
                  : 'bg-white/10 text-purple-300 cursor-not-allowed'
              }`}
            >
              <Play className="w-6 h-6 inline mr-3" />
              Setup Players & Start {isStandalone ? 'Standalone' : 'Group'} Match
            </button>
          </div>
        </div>
      </div>

      {/* Innings Setup Modal */}
      {match && (
        <InningsSetupModal
          match={match}
          isOpen={showInningsSetup}
          onClose={() => setShowInningsSetup(false)}
          onSetupComplete={handleInningsSetup}
          isSecondInnings={false}
        />
      )}
    </div>
  );
};