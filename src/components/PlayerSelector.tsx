import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, User, Camera, X, Phone, Crown, Users as UsersIcon, Star, Award, Target, Shield, TrendingUp } from 'lucide-react';
import { Player, Match } from '../types/cricket';
import { storageService } from '../services/storage';
import { authService } from '../services/authService';
import { PlayerRecommendationService, PlayerRecommendation, RecommendationContext } from '../services/playerRecommendationService';

interface PlayerSelectorProps {
  onPlayerSelect: (player: Player) => void;
  onClose: () => void;
  title: string;
  excludePlayerIds?: string[];
  players: Player[];
  showOnlyAvailable?: boolean;
  allowAddPlayer?: boolean;
  groupId?: string;
  filterByGroup?: boolean; // New prop to filter by current group
  // NEW: Enhanced recommendation props
  recommendationRole?: 'batting' | 'bowling' | 'fielding' | 'wicketkeeper';
  match?: Match; // Current match for contextual recommendations
  showRecommendations?: boolean; // Whether to show recommendation badges and sorting
}

export const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  onPlayerSelect,
  onClose,
  title,
  excludePlayerIds = [],
  players,
  showOnlyAvailable = false,
  allowAddPlayer = true,
  groupId,
  filterByGroup = false,
  recommendationRole,
  match,
  showRecommendations = true
}) => {
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerShortId, setNewPlayerShortId] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<Player[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // NEW: Recommendation state
  const [recommendations, setRecommendations] = useState<PlayerRecommendation[]>([]);
  const [showRecommendationPanel, setShowRecommendationPanel] = useState(false);

  const currentGroup = authService.getCurrentGroup();

  // PERFORMANCE FIX: Instant filtering with provided players (no async loading)
  useEffect(() => {
    // INSTANT FILTER: Use provided players immediately, no async operations
    let availablePlayers = [...players]; // Create copy to avoid mutations

    // Apply group filtering if requested
    if (filterByGroup && currentGroup) {
      console.log(`🔍 FILTERING PLAYERS BY GROUP: ${currentGroup.name}`);
      
      // Only show players that belong to the current group
      availablePlayers = availablePlayers.filter(player => {
        const belongsToGroup = player.isGroupMember && 
                             player.groupIds?.includes(currentGroup.id);
        return belongsToGroup;
      });
      
      console.log(`✅ GROUP FILTERED RESULT: ${availablePlayers.length} players from group ${currentGroup.name}`);
    }

    // Apply exclusion filter
    const finalPlayers = availablePlayers.filter(player => 
      !excludePlayerIds.includes(player.id)
    );

    console.log(`🎯 FINAL AVAILABLE PLAYERS: ${finalPlayers.length} players`);
    setFilteredPlayers(finalPlayers);
    setAllPlayers(players); // Set all players for search
  }, [players, excludePlayerIds, filterByGroup, currentGroup]);

  // Generate recommendations when players or role changes
  useEffect(() => {
    if (showRecommendations && recommendationRole && players.length > 0) {
      const context = PlayerRecommendationService.getContextualRecommendations(
        players,
        recommendationRole,
        match
      );
      
      let recs: PlayerRecommendation[] = [];
      
      switch (recommendationRole) {
        case 'batting':
          recs = PlayerRecommendationService.getBattingRecommendations(players, context, match);
          break;
        case 'bowling':
          recs = PlayerRecommendationService.getBowlingRecommendations(players, context, match);
          break;
        case 'fielding':
        case 'wicketkeeper':
          recs = PlayerRecommendationService.getFieldingRecommendations(players, { ...context, role: recommendationRole }, match);
          break;
      }
      
      setRecommendations(recs);
      console.log(`🎯 Generated ${recs.length} recommendations for ${recommendationRole}:`, 
        recs.slice(0, 3).map(r => `${r.player.name} (${r.badge}, ${r.score.toFixed(1)})`));
    }
  }, [players, recommendationRole, match, showRecommendations]);

  // MEMOIZED: Base players for search (prevents recalculation)
  const basePlayersForSearch = useMemo(() => {
    return filterByGroup && currentGroup 
      ? allPlayers.filter(player => 
          player.isGroupMember && 
          player.groupIds?.includes(currentGroup.id)
        )
      : allPlayers;
  }, [allPlayers, filterByGroup, currentGroup]);

  // MEMOIZED: Search results (only recalculate when inputs change)
  const searchResults = useMemo(() => {
    if (searchTerm.trim() === '') {
      return basePlayersForSearch.filter(player => !excludePlayerIds.includes(player.id));
    }

    // Filter by search term
    const results = basePlayersForSearch.filter(player => {
      const matchesName = player.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesShortId = player.shortId && 
                            player.shortId.toLowerCase().includes(searchTerm.toLowerCase());
      const notExcluded = !excludePlayerIds.includes(player.id);
      
      return (matchesName || matchesShortId) && notExcluded;
    });

    // Sort by relevance (exact matches first, then starts with, then contains)
    results.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      // Exact match
      if (aName === searchLower) return -1;
      if (bName === searchLower) return 1;
      
      // Starts with
      if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
      if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;
      
      // Group members first
      if (a.isGroupMember && !b.isGroupMember) return -1;
      if (b.isGroupMember && !a.isGroupMember) return 1;
      
      // Alphabetical
      return aName.localeCompare(bName);
    });

    return results;
  }, [searchTerm, basePlayersForSearch, excludePlayerIds]);

  // Update filtered players when search results change
  useEffect(() => {
    setFilteredPlayers(searchResults);
    
    // Show suggestions for single character searches
    if (searchTerm.length === 1) {
      const suggestions = searchResults.slice(0, 5);
      setSearchSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }

    console.log(`🔍 SEARCH "${searchTerm}": ${searchResults.length} results`);
  }, [searchResults, searchTerm]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const player: Player = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newPlayerName.trim(),
        shortId: newPlayerShortId.trim() || undefined,
        photoUrl: selectedPhoto || undefined,
        isGroupMember: !!groupId,
        isGuest: false,
        groupIds: groupId ? [groupId] : undefined,
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

      console.log(`✅ PLAYER CREATED: ${player.name}`);
      
      // Immediately select the player (don't wait for storage)
      onPlayerSelect(player);
      
      // Reset form immediately
      setNewPlayerName('');
      setNewPlayerShortId('');
      setNewPlayerEmail('');
      setNewPlayerPhone('');
      setSelectedPhoto(null);
      setShowAddPlayer(false);
      setShowQuickAdd(false);
      setLoading(false);
      
      // Save to storage in the background (non-blocking)
      storageService.savePlayer(player).catch((err) => {
        console.error('Background save failed for player:', err);
      });
      
      // Handle group invitation in the background (non-blocking)
      if (groupId && newPlayerEmail.trim()) {
        authService.inviteToGroupByEmail(groupId, newPlayerEmail.trim(), newPlayerName.trim()).catch((inviteError) => {
          console.warn('Failed to send email invitation:', inviteError);
        });
      }
      
    } catch (err) {
      console.error('Error creating player:', err);
      setError('Failed to add player. Please try again.');
      setLoading(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const player: Player = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newPlayerName.trim(),
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

      console.log(`✅ GUEST PLAYER CREATED: ${player.name}`);
      
      // Immediately select the player (don't wait for storage)
      onPlayerSelect(player);
      
      // Reset form immediately
      setNewPlayerName('');
      setShowQuickAdd(false);
      setLoading(false);
      
      // Save to storage in the background (non-blocking)
      storageService.savePlayer(player).catch((err) => {
        console.error('Background save failed for guest player:', err);
        // Player is already selected, so this failure won't affect the UI
      });
      
    } catch (err) {
      setError('Failed to add guest player. Please try again.');
      console.error('Error creating guest player:', err);
      setLoading(false);
    }
  };

  const handlePlayerClick = (player: Player) => {
    console.log(`🎯 PLAYER SELECTED: ${player.name} (${player.isGuest ? 'Guest' : player.isGroupMember ? 'Group Member' : 'Other'})`);
    onPlayerSelect(player);
  };

  const handleClose = () => {
    console.log('❌ Player selector closed');
    onClose();
  };

  const handleSuggestionClick = (player: Player) => {
    setSearchTerm(player.name);
    setShowSuggestions(false);
    // Don't auto-select, just fill the search
  };

  const getPlayerTypeIcon = (player: Player) => {
    if (player.isGuest) {
      return <User className="w-3 h-3 text-orange-500" />;
    } else if (player.isGroupMember) {
      return <Crown className="w-3 h-3 text-purple-500" />;
    } else {
      return <UsersIcon className="w-3 h-3 text-gray-500" />;
    }
  };

  const getPlayerTypeBadge = (player: Player) => {
    // Check if player is group admin/creator (match by user ID embedded in player ID)
    const isGroupAdmin = currentGroup && 
      (currentGroup.createdBy === player.id.replace('player_', '') || 
       currentGroup.members?.some(m => m.userId === player.id.replace('player_', '') && m.role === 'admin'));

    if (player.isGuest) {
      return (
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full flex items-center">
          <User className="w-3 h-3 mr-1" />
          Guest
        </span>
      );
    } else if (player.isGroupMember && currentGroup && player.groupIds?.includes(currentGroup.id)) {
      if (isGroupAdmin) {
        return (
          <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full flex items-center">
            <Crown className="w-3 h-3 mr-1" />
            Admin
          </span>
        );
      } else {
        return (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center">
            <Crown className="w-3 h-3 mr-1" />
            Member
          </span>
        );
      }
    } else if (player.isGroupMember) {
      return (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center">
          <UsersIcon className="w-3 h-3 mr-1" />
          Other Group
        </span>
      );
    } else {
      return (
        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center">
          <User className="w-3 h-3 mr-1" />
          Player
        </span>
      );
    }
  };

  // Get recommendation badge for a player
  const getRecommendationBadge = (player: Player) => {
    if (!showRecommendations || recommendations.length === 0) return null;
    
    const rec = recommendations.find(r => r.player.id === player.id);
    if (!rec) return null;

    const badgeConfig = {
      excellent: { 
        color: 'bg-green-500 text-white', 
        icon: <Star className="w-3 h-3" />,
        text: 'Excellent'
      },
      good: { 
        color: 'bg-blue-500 text-white', 
        icon: <Award className="w-3 h-3" />,
        text: 'Good'
      },
      average: { 
        color: 'bg-yellow-500 text-white', 
        icon: <Target className="w-3 h-3" />,
        text: 'Average'
      },
      backup: { 
        color: 'bg-gray-500 text-white', 
        icon: <Shield className="w-3 h-3" />,
        text: 'Backup'
      }
    };

    const config = badgeConfig[rec.badge];
    
    return (
      <div className="flex flex-col items-center space-y-1">
        <span className={`text-xs px-2 py-1 rounded-full flex items-center space-x-1 ${config.color}`}>
          {config.icon}
          <span>{config.text}</span>
        </span>
        {rec.isTopChoice && (
          <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">
            TOP CHOICE
          </span>
        )}
      </div>
    );
  };

  // Get recommendation reasons for a player
  const getRecommendationReasons = (player: Player): string[] => {
    if (!showRecommendations || recommendations.length === 0) return [];
    
    const rec = recommendations.find(r => r.player.id === player.id);
    return rec ? rec.reasons : [];
  };

  // Sort players by recommendations if available
  const sortPlayersByRecommendations = (players: Player[]): Player[] => {
    if (!showRecommendations || recommendations.length === 0) {
      return players;
    }

    return [...players].sort((a, b) => {
      const recA = recommendations.find(r => r.player.id === a.id);
      const recB = recommendations.find(r => r.player.id === b.id);
      
      // Players with recommendations come first
      if (recA && !recB) return -1;
      if (!recA && recB) return 1;
      if (!recA && !recB) return 0;
      
      // Sort by recommendation score
      return recB!.score - recA!.score;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col modal-performance no-flicker animate-slideUp">
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 sm:p-6 text-white rounded-t-2xl flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              {filterByGroup && currentGroup && (
                <p className="text-purple-100 text-sm mt-1">
                  Showing {currentGroup.name} players only
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar with Suggestions - Fixed */}
        <div className="p-4 border-b border-gray-200 relative flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(e.target.value.length === 1);
              }}
              onFocus={() => setShowSuggestions(searchTerm.length === 1)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={`Search ${filterByGroup ? 'group ' : ''}players...`}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute z-20 w-full left-4 right-4 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              <div className="p-2">
                <div className="text-xs text-gray-500 mb-2 px-2">Quick suggestions:</div>
                {searchSuggestions.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleSuggestionClick(player)}
                    className="w-full text-left p-2 hover:bg-gray-50 rounded-lg flex items-center space-x-3"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      {getPlayerTypeIcon(player)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{player.name}</div>
                      {player.shortId && (
                        <div className="text-xs text-gray-500">ID: {player.shortId}</div>
                      )}
                    </div>
                    {getPlayerTypeBadge(player)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendation Panel - Fixed */}
        {showRecommendations && recommendationRole && recommendations.length > 0 && (
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                Smart Recommendations for {recommendationRole.charAt(0).toUpperCase() + recommendationRole.slice(1)}
              </h3>
              <button
                onClick={() => setShowRecommendationPanel(!showRecommendationPanel)}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-200 transition-colors"
              >
                {showRecommendationPanel ? 'Hide' : 'Show'} Details
              </button>
            </div>
            
            {showRecommendationPanel && (
              <div className="text-sm text-gray-600 space-y-2">
                <p>🎯 Top recommendations based on player stats, match situation, and {recommendationRole} requirements.</p>
                <div className="flex flex-wrap gap-2">
                  {recommendations.slice(0, 3).map((rec) => (
                    <span key={rec.player.id} className="bg-white px-2 py-1 rounded-lg border text-xs">
                      <span className="font-medium">{rec.player.name}</span> - {rec.badge}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guest Player Quick Add - Fixed */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-yellow-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <User className="w-4 h-4 mr-2 text-orange-600" />
              Quick Add Guest Player
            </h3>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Guest</span>
          </div>
          
          {showQuickAdd ? (
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Guest player name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={loading || !newPlayerName.trim()}
                  className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Adding...' : 'Add Guest'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="w-full bg-orange-500 text-white py-3 px-4 rounded-xl hover:bg-orange-600 transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Guest Player</span>
            </button>
          )}
          
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Player List - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {filteredPlayers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No players found</p>
                {searchTerm && (
                  <p className="text-sm mt-1">Try adjusting your search or add a new player</p>
                )}
                {filterByGroup && currentGroup && (
                  <p className="text-sm mt-1 text-blue-600">
                    Only showing players from {currentGroup.name}
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Group Members Section */}
                {filteredPlayers.some(p => p.isGroupMember && currentGroup && p.groupIds?.includes(currentGroup.id)) && (
                  <>
                    <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                      <h4 className="text-sm font-semibold text-purple-800 flex items-center">
                        <Crown className="w-4 h-4 mr-2" />
                        {currentGroup?.name || 'Group'} Members
                        <span className="ml-2 text-xs bg-white text-purple-600 px-2 py-1 rounded-full">
                          Admins can play too!
                        </span>
                      </h4>
                    </div>
                    {sortPlayersByRecommendations(
                      filteredPlayers
                        .filter(p => p.isGroupMember && currentGroup && p.groupIds?.includes(currentGroup.id))
                        .sort((a, b) => {
                          // Sort admins first, then regular members
                          const aIsAdmin = currentGroup.createdBy === a.id.replace('player_', '') || 
                            currentGroup.members?.some(m => m.userId === a.id.replace('player_', '') && m.role === 'admin');
                          const bIsAdmin = currentGroup.createdBy === b.id.replace('player_', '') || 
                            currentGroup.members?.some(m => m.userId === b.id.replace('player_', '') && m.role === 'admin');
                          
                          if (aIsAdmin && !bIsAdmin) return -1;
                          if (!aIsAdmin && bIsAdmin) return 1;
                          
                          // Then sort alphabetically if no recommendations
                          return a.name.localeCompare(b.name);
                        })
                    )
                      .map((player) => (
                        <button
                          key={player.id}
                          onClick={() => handlePlayerClick(player)}
                          className="w-full p-4 hover:bg-purple-50 transition-colors text-left flex items-center space-x-3 group"
                        >
                          {/* Player Avatar */}
                          <div className="relative">
                            {player.photoUrl ? (
                              <img
                                src={player.photoUrl}
                                alt={player.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                              <Crown className="w-3 h-3 text-white" />
                            </div>
                          </div>

                          {/* Player Info */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{player.name}</span>
                              {getPlayerTypeBadge(player)}
                            </div>
                            {player.shortId && (
                              <p className="text-sm text-gray-500">ID: {player.shortId}</p>
                            )}
                            <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                              <span>Matches: {player.stats.matchesPlayed}</span>
                              <span>Runs: {player.stats.runsScored}</span>
                              <span>Wickets: {player.stats.wicketsTaken}</span>
                            </div>
                            {/* Recommendation Reasons */}
                            {showRecommendations && getRecommendationReasons(player).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {getRecommendationReasons(player).slice(0, 2).map((reason, index) => (
                                  <div key={index} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    💡 {reason}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Recommendation Badge & Selection Indicator */}
                          <div className="flex flex-col items-center space-y-2">
                            {getRecommendationBadge(player)}
                            <div className="w-6 h-6 rounded-full border-2 border-purple-300 group-hover:border-purple-500 transition-colors"></div>
                          </div>
                        </button>
                      ))}
                  </>
                )}

                {/* Guest Players Section */}
                {filteredPlayers.some(p => p.isGuest) && (
                  <>
                    <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
                      <h4 className="text-sm font-semibold text-orange-800 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Guest Players
                      </h4>
                    </div>
                    {sortPlayersByRecommendations(
                      filteredPlayers
                        .filter(p => p.isGuest)
                    )
                      .map((player) => (
                        <button
                          key={player.id}
                          onClick={() => handlePlayerClick(player)}
                          className="w-full p-4 hover:bg-orange-50 transition-colors text-left flex items-center space-x-3 group"
                        >
                          {/* Player Avatar */}
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">G</span>
                            </div>
                          </div>

                          {/* Player Info */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{player.name}</span>
                              {getPlayerTypeBadge(player)}
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                              <span>Matches: {player.stats.matchesPlayed}</span>
                              <span>Runs: {player.stats.runsScored}</span>
                              <span>Wickets: {player.stats.wicketsTaken}</span>
                            </div>
                            {/* Recommendation Reasons */}
                            {showRecommendations && getRecommendationReasons(player).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {getRecommendationReasons(player).slice(0, 2).map((reason, index) => (
                                  <div key={index} className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                    💡 {reason}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Recommendation Badge & Selection Indicator */}
                          <div className="flex flex-col items-center space-y-2">
                            {getRecommendationBadge(player)}
                            <div className="w-6 h-6 rounded-full border-2 border-orange-300 group-hover:border-orange-500 transition-colors"></div>
                          </div>
                        </button>
                      ))}
                  </>
                )}

                {/* Other Players Section */}
                {filteredPlayers.some(p => !p.isGuest && !(p.isGroupMember && currentGroup && p.groupIds?.includes(currentGroup.id))) && (
                  <>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                        <UsersIcon className="w-4 h-4 mr-2" />
                        Other Players
                      </h4>
                    </div>
                    {sortPlayersByRecommendations(
                      filteredPlayers
                        .filter(p => !p.isGuest && !(p.isGroupMember && currentGroup && p.groupIds?.includes(currentGroup.id)))
                    )
                      .map((player) => (
                        <button
                          key={player.id}
                          onClick={() => handlePlayerClick(player)}
                          className="w-full p-4 hover:bg-gray-50 transition-colors text-left flex items-center space-x-3 group"
                        >
                          {/* Player Avatar */}
                          <div className="relative">
                            {player.photoUrl ? (
                              <img
                                src={player.photoUrl}
                                alt={player.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center text-white font-semibold">
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Player Info */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{player.name}</span>
                              {getPlayerTypeBadge(player)}
                            </div>
                            {player.shortId && (
                              <p className="text-sm text-gray-500">ID: {player.shortId}</p>
                            )}
                            <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                              <span>Matches: {player.stats.matchesPlayed}</span>
                              <span>Runs: {player.stats.runsScored}</span>
                              <span>Wickets: {player.stats.wicketsTaken}</span>
                            </div>
                            {/* Recommendation Reasons */}
                            {showRecommendations && getRecommendationReasons(player).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {getRecommendationReasons(player).slice(0, 2).map((reason, index) => (
                                  <div key={index} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                    💡 {reason}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Recommendation Badge & Selection Indicator */}
                          <div className="flex flex-col items-center space-y-2">
                            {getRecommendationBadge(player)}
                            <div className="w-6 h-6 rounded-full border-2 border-gray-300 group-hover:border-gray-500 transition-colors"></div>
                          </div>
                        </button>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Fixed Bottom Section */}
          <div className="flex-shrink-0 border-t border-gray-200">
            {/* Add Full Player Button - Always visible */}
            {allowAddPlayer && !showAddPlayer && (
              <div className="p-4">
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="w-full bg-purple-500 text-white py-3 px-4 rounded-xl hover:bg-purple-600 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add {filterByGroup ? 'Group' : 'Full'} Player</span>
                </button>
              </div>
            )}

            {/* Full Player Add Form - Scrollable when expanded */}
            {showAddPlayer && (
              <div className="max-h-64 overflow-y-auto">
                <div className="p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2 text-purple-600" />
                    Add {filterByGroup ? 'Group' : 'Full'} Player
                  </h3>
                  
                  <form onSubmit={handleAddPlayer} className="space-y-3">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                      autoFocus
                    />
                    
                    <input
                      type="text"
                      value={newPlayerShortId}
                      onChange={(e) => setNewPlayerShortId(e.target.value)}
                      placeholder="Short ID (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    
                    <input
                      type="email"
                      value={newPlayerEmail}
                      onChange={(e) => setNewPlayerEmail(e.target.value)}
                      placeholder="Email address (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    
                    <input
                      type="tel"
                      value={newPlayerPhone}
                      onChange={(e) => setNewPlayerPhone(e.target.value)}
                      placeholder="Phone number (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    
                    {/* Photo Upload */}
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Camera className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Photo</span>
                      </button>
                      {selectedPhoto && (
                        <img src={selectedPhoto} alt="Preview" className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={loading || !newPlayerName.trim()}
                        className="flex-1 bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? 'Adding...' : 'Add Player'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddPlayer(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};