import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Target, Award, Users, Download, Upload, User, RefreshCw, BarChart3, Star, ArrowLeft } from 'lucide-react';
import { Player, Match } from '../types/cricket';
import { storageService } from '../services/storage';
import { PDFService } from '../services/pdfService';
import { authService } from '../services/authService';

interface GroupDashboardProps {
  onBack: () => void;
}

interface PlayerStats {
  player: Player;
  matches: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs: number;
  runsConceded: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  average: number;
  strikeRate: number;
  economy: number;
  bestBowling: string;
  highestScore: number;
  fifties: number;
  hundreds: number;
  motmAwards: number;
}

export const GroupDashboard: React.FC<GroupDashboardProps> = ({ onBack }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [activeTab, setActiveTab] = useState<'batting' | 'bowling' | 'fielding'>('batting');
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week'>('all');
  const [loading, setLoading] = useState(true);
  const [currentGroup, setCurrentGroup] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get current group
      const group = authService.getCurrentGroup();
      setCurrentGroup(group);
      
      if (!group) {
        console.log('No group selected for leaderboards');
        setLoading(false);
        return;
      }
      
      console.log('📊 Loading group leaderboard data for:', group.name);
      
      const storedMatches = await storageService.getAllMatches();
      const storedPlayers = await storageService.getAllPlayers();
      
      // Filter matches by group - only show matches where players are from this group
      const groupMatches = storedMatches.filter(match => {
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
      
      // Filter players by group
      const groupPlayers = storedPlayers.filter(player => 
        player.isGroupMember && 
        player.groupIds?.includes(group.id)
      );
      
      // Filter matches based on time range
      let filteredMatches = groupMatches;
      if (timeRange !== 'all') {
        const now = new Date();
        const cutoff = new Date();
        if (timeRange === 'month') {
          cutoff.setMonth(now.getMonth() - 1);
        } else {
          cutoff.setDate(now.getDate() - 7);
        }
        filteredMatches = groupMatches.filter(match => new Date(match.startTime) >= cutoff);
      }
      
      console.log(`📊 Group ${group.name} leaderboard data:`, {
        totalMatches: groupMatches.length,
        filteredMatches: filteredMatches.length,
        players: groupPlayers.length,
        timeRange
      });
      
      setMatches(filteredMatches);
      setPlayers(groupPlayers);
      calculatePlayerStats(filteredMatches, groupPlayers);
    } catch (error) {
      console.error('Failed to load group leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlayerStats = (matches: Match[], players: Player[]) => {
    const stats: PlayerStats[] = players.map(player => {
      const playerMatches = matches.filter(match => 
        match.team1.players.some(p => p.id === player.id) || 
        match.team2.players.some(p => p.id === player.id)
      );

      const battingStats = playerMatches.reduce((acc, match) => {
        const balls = match.balls.filter(b => b.striker.id === player.id);
        let runs = 0;
        let ballsFaced = 0;
        let fours = 0;
        let sixes = 0;
        let highestInThisMatch = 0;

        balls.forEach(ball => {
          if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
            runs += ball.runs;
            highestInThisMatch += ball.runs;
          }
          if (!ball.isWide && !ball.isNoBall) {
            ballsFaced++;
          }
          if (ball.runs === 4) fours++;
          if (ball.runs === 6) sixes++;
        });
        
        return {
          runs: acc.runs + runs,
          balls: acc.balls + ballsFaced,
          fours: acc.fours + fours,
          sixes: acc.sixes + sixes,
          highestScore: Math.max(acc.highestScore, highestInThisMatch)
        };
      }, { runs: 0, balls: 0, fours: 0, sixes: 0, highestScore: 0 });

      const bowlingStats = playerMatches.reduce((acc, match) => {
        const balls = match.balls.filter(b => b.bowler.id === player.id);
        const wickets = balls.filter(b => b.isWicket && b.wicketType !== 'run_out').length;
        const runs = balls.reduce((sum, b) => sum + b.runs, 0);
        const ballsBowled = balls.filter(b => !b.isWide && !b.isNoBall).length;
        
        return {
          wickets: acc.wickets + wickets,
          overs: acc.overs + (ballsBowled / 6),
          runsConceded: acc.runsConceded + runs
        };
      }, { wickets: 0, overs: 0, runsConceded: 0 });

      const fieldingStats = playerMatches.reduce((acc, match) => {
        const catches = match.balls.filter(b => b.fielder?.id === player.id && b.wicketType === 'caught').length;
        const stumpings = match.balls.filter(b => b.fielder?.id === player.id && b.wicketType === 'stumped').length;
        const runOuts = match.balls.filter(b => b.fielder?.id === player.id && b.wicketType === 'run_out').length;
        
        return {
          catches: acc.catches + catches,
          stumpings: acc.stumpings + stumpings,
          runOuts: acc.runOuts + runOuts
        };
      }, { catches: 0, stumpings: 0, runOuts: 0 });

      const average = battingStats.balls > 0 ? battingStats.runs / Math.max(1, playerMatches.filter(m => {
        // Count matches where player got out
        return m.balls.some(b => b.isWicket && b.striker.id === player.id);
      }).length) : 0;
      
      const strikeRate = battingStats.balls > 0 ? (battingStats.runs / battingStats.balls) * 100 : 0;
      const economy = bowlingStats.overs > 0 ? bowlingStats.runsConceded / bowlingStats.overs : 0;

      return {
        player,
        matches: playerMatches.length,
        ...battingStats,
        ...bowlingStats,
        ...fieldingStats,
        average: Number(average.toFixed(2)),
        strikeRate: Number(strikeRate.toFixed(2)),
        economy: Number(economy.toFixed(2)),
        bestBowling: `${bowlingStats.wickets}/${bowlingStats.runsConceded}`,
        fifties: Math.floor(battingStats.runs / 50),
        hundreds: Math.floor(battingStats.runs / 100),
        motmAwards: playerMatches.filter(m => m.manOfTheMatch?.id === player.id).length
      };
    });

    setPlayerStats(stats);
  };

  const handleExportStats = async () => {
    try {
      const doc = new (await import('jspdf')).jsPDF();
      const autoTable = (await import('jspdf-autotable')).default;
      
      // Title
      doc.setFontSize(16);
      doc.text(`${currentGroup?.name || 'Group'} Statistics Report`, 14, 15);
      
      // Time Range
      doc.setFontSize(12);
      doc.text(`Period: ${timeRange === 'all' ? 'All Time' : timeRange === 'month' ? 'Last Month' : 'Last Week'}`, 14, 25);
      
      // Batting Stats
      doc.setFontSize(14);
      doc.text('Batting Statistics', 14, 35);
      
      const battingStats = playerStats
        .filter(p => p.balls > 0)
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 10);
      
      const battingTable = battingStats.map(p => [
        p.player.name,
        p.runs.toString(),
        p.balls.toString(),
        p.average.toString(),
        p.strikeRate.toString(),
        p.fifties.toString(),
        p.hundreds.toString()
      ]);
      
      autoTable(doc, {
        startY: 40,
        head: [['Player', 'Runs', 'Balls', 'Avg', 'SR', '50s', '100s']],
        body: battingTable,
        theme: 'grid'
      });
      
      // Bowling Stats
      const lastY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('Bowling Statistics', 14, lastY);
      
      const bowlingStats = playerStats
        .filter(p => p.overs > 0)
        .sort((a, b) => b.wickets - a.wickets)
        .slice(0, 10);
      
      const bowlingTable = bowlingStats.map(p => [
        p.player.name,
        p.wickets.toString(),
        p.overs.toFixed(1),
        p.runsConceded.toString(),
        p.economy.toString(),
        p.bestBowling
      ]);
      
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Player', 'Wickets', 'Overs', 'Runs', 'Econ', 'Best']],
        body: bowlingTable,
        theme: 'grid'
      });
      
      // Save the PDF
      doc.save(`${currentGroup?.name || 'group'}-statistics.pdf`);
    } catch (error) {
      console.error('Failed to export stats:', error);
      alert('Failed to export statistics. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group leaderboards...</p>
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Group Selected</h2>
          <p className="text-gray-600 mb-6">Please select a group to view leaderboards.</p>
          <button
            onClick={onBack}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 mr-2" />
            <span className="text-gray-600">Back to Dashboard</span>
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{currentGroup.name} Leaderboards</h1>
            <p className="text-gray-600">Group statistics and rankings</p>
          </div>
          <button
            onClick={handleExportStats}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Export Statistics"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Time Range Filter */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setTimeRange('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === 'all'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === 'month'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === 'week'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Last Week
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('batting')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'batting'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Trophy className="w-5 h-5 inline mr-2" />
            Batting
          </button>
          <button
            onClick={() => setActiveTab('bowling')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'bowling'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Target className="w-5 h-5 inline mr-2" />
            Bowling
          </button>
          <button
            onClick={() => setActiveTab('fielding')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'fielding'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Award className="w-5 h-5 inline mr-2" />
            Fielding
          </button>
        </div>

        {/* Statistics Display */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'batting' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Batting Leaderboard</h2>
              {playerStats.filter(p => p.balls > 0).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Player</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Matches</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Runs</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Avg</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">SR</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">50s</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">100s</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">HS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {playerStats
                        .filter(p => p.balls > 0)
                        .sort((a, b) => b.runs - a.runs)
                        .map((stat, index) => (
                          <tr key={stat.player.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <span className="mr-2">#{index + 1}</span>
                                {index < 3 && <Star className="w-4 h-4 text-yellow-500" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                                  {stat.player.photoUrl ? (
                                    <img src={stat.player.photoUrl} alt={stat.player.name} className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    <span className="text-white font-bold text-xs">
                                      {stat.player.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                {stat.player.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.matches}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right font-bold">{stat.runs}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.average}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.strikeRate}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.fifties}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.hundreds}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.highestScore}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No batting statistics available for this time period</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bowling' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Bowling Leaderboard</h2>
              {playerStats.filter(p => p.overs > 0).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Player</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Matches</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Wickets</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Overs</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Runs</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Econ</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Best</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {playerStats
                        .filter(p => p.overs > 0)
                        .sort((a, b) => b.wickets - a.wickets)
                        .map((stat, index) => (
                          <tr key={stat.player.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <span className="mr-2">#{index + 1}</span>
                                {index < 3 && <Star className="w-4 h-4 text-yellow-500" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mr-3">
                                  {stat.player.photoUrl ? (
                                    <img src={stat.player.photoUrl} alt={stat.player.name} className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    <span className="text-white font-bold text-xs">
                                      {stat.player.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                {stat.player.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.matches}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right font-bold">{stat.wickets}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.overs.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.runsConceded}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.economy}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.bestBowling}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No bowling statistics available for this time period</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fielding' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Fielding Leaderboard</h2>
              {playerStats.filter(p => p.catches > 0 || p.stumpings > 0 || p.runOuts > 0).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Player</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Matches</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Catches</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Stumpings</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Run Outs</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {playerStats
                        .filter(p => p.catches > 0 || p.stumpings > 0 || p.runOuts > 0)
                        .sort((a, b) => (b.catches + b.stumpings + b.runOuts) - (a.catches + a.stumpings + a.runOuts))
                        .map((stat, index) => (
                          <tr key={stat.player.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <span className="mr-2">#{index + 1}</span>
                                {index < 3 && <Star className="w-4 h-4 text-yellow-500" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mr-3">
                                  {stat.player.photoUrl ? (
                                    <img src={stat.player.photoUrl} alt={stat.player.name} className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    <span className="text-white font-bold text-xs">
                                      {stat.player.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                {stat.player.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.matches}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.catches}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.stumpings}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right">{stat.runOuts}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right font-bold">
                              {stat.catches + stat.stumpings + stat.runOuts}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No fielding statistics available for this time period</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};