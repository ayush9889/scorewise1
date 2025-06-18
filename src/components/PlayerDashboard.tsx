import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Target, TrendingUp, Award, Camera, Edit3 } from 'lucide-react';
import { Player, Match } from '../types/cricket';
import { storageService } from '../services/storage';
import { CricketEngine } from '../services/cricketEngine';

interface PlayerDashboardProps {
  player: Player;
  onBack: () => void;
  onPlayerUpdate?: (player: Player) => void;
}

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ 
  player: initialPlayer, 
  onBack,
  onPlayerUpdate 
}) => {
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [editShortId, setEditShortId] = useState(player.shortId || '');

  useEffect(() => {
    loadPlayerData();
  }, [player.id]);

  const loadPlayerData = async () => {
    try {
      const allMatches = await storageService.getAllMatches();
      const playerMatches = allMatches.filter(match => 
        match.team1.players.some(p => p.id === player.id) ||
        match.team2.players.some(p => p.id === player.id)
      );
      
      setMatches(playerMatches);
      setRecentMatches(playerMatches.slice(-5).reverse());
    } catch (error) {
      console.error('Failed to load player data:', error);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const photoUrl = e.target?.result as string;
        const updatedPlayer = { ...player, photoUrl };
        
        try {
          await storageService.savePlayer(updatedPlayer);
          setPlayer(updatedPlayer);
          onPlayerUpdate?.(updatedPlayer);
        } catch (error) {
          console.error('Failed to update player photo:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    
    const updatedPlayer = {
      ...player,
      name: editName.trim(),
      shortId: editShortId.trim() || undefined
    };
    
    try {
      await storageService.savePlayer(updatedPlayer);
      setPlayer(updatedPlayer);
      setIsEditing(false);
      onPlayerUpdate?.(updatedPlayer);
    } catch (error) {
      console.error('Failed to update player:', error);
    }
  };

  const stats = player.stats;
  const battingAvg = CricketEngine.calculateBattingAverage(stats);
  const strikeRate = CricketEngine.calculateStrikeRate(stats);
  const bowlingAvg = CricketEngine.calculateBowlingAverage(stats);
  const economyRate = CricketEngine.calculateEconomyRate(stats);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        
        <h1 className="font-bold text-lg text-gray-900">Player Profile</h1>
        
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Edit3 className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Player Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <Trophy className="w-10 h-10 text-green-600" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-bold text-xl"
                  />
                  <input
                    type="text"
                    value={editShortId}
                    onChange={(e) => setEditShortId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Short ID (optional)"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditName(player.name);
                        setEditShortId(player.shortId || '');
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900">{player.name}</h2>
                  {player.shortId && (
                    <p className="text-gray-600">#{player.shortId}</p>
                  )}
                  <div className="flex items-center mt-2">
                    <Award className="w-4 h-4 text-yellow-500 mr-1" />
                    <span className="text-sm text-gray-600">
                      {stats.motmAwards} MOTM Awards
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.matchesPlayed}</div>
              <div className="text-sm text-gray-600">Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.runsScored}</div>
              <div className="text-sm text-gray-600">Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.wicketsTaken}</div>
              <div className="text-sm text-gray-600">Wickets</div>
            </div>
          </div>
        </div>

        {/* Batting Stats */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Batting Statistics
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-700">{battingAvg}</div>
              <div className="text-sm text-green-600">Average</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-700">{strikeRate}</div>
              <div className="text-sm text-blue-600">Strike Rate</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.highestScore}</div>
              <div className="text-gray-600">Highest Score</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.fifties}/{stats.hundreds}</div>
              <div className="text-gray-600">50s/100s</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.fours}</div>
              <div className="text-gray-600">Fours</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.sixes}</div>
              <div className="text-gray-600">Sixes</div>
            </div>
          </div>
        </div>

        {/* Bowling Stats */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-red-600" />
            Bowling Statistics
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-700">{bowlingAvg}</div>
              <div className="text-sm text-red-600">Average</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-700">{economyRate}</div>
              <div className="text-sm text-orange-600">Economy</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.bestBowlingFigures}</div>
              <div className="text-gray-600">Best Figures</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">{Math.floor(stats.ballsBowled / 6)}.{stats.ballsBowled % 6}</div>
              <div className="text-gray-600">Overs Bowled</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">{stats.maidenOvers}</div>
              <div className="text-gray-600">Maidens</div>
            </div>
          </div>
        </div>

        {/* Fielding Stats */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-purple-600" />
            Fielding & Achievements
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-purple-700">{stats.catches}</div>
              <div className="text-sm text-purple-600">Catches</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-700">{stats.runOuts}</div>
              <div className="text-sm text-purple-600">Run Outs</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-700">{stats.motmAwards}</div>
              <div className="text-sm text-yellow-600">MOTM Awards</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-700">{stats.ducks}</div>
              <div className="text-sm text-gray-600">Ducks</div>
            </div>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Matches</h3>
          
          {recentMatches.length > 0 ? (
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div key={match.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium text-gray-900">
                      {match.team1.name} vs {match.team2.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(match.startTime).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    {match.team1.score}/{match.team1.wickets} vs {match.team2.score}/{match.team2.wickets}
                  </div>
                  
                  {match.manOfTheMatch?.id === player.id && (
                    <div className="mt-2 inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                      <Award className="w-3 h-3 mr-1" />
                      Man of the Match
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No matches played yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};