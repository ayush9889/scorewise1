import React from 'react';
import { X, Trophy, Award, TrendingUp, Target, User } from 'lucide-react';
import { Match, Player } from '../types/cricket';
import { CricketEngine } from '../services/cricketEngine';

interface DetailedScorecardModalProps {
  match: Match;
  isOpen: boolean;
  onClose: () => void;
}

export const DetailedScorecardModal: React.FC<DetailedScorecardModalProps> = ({
  match,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const calculateBattingStats = (player: Player, innings: number) => {
    const battingBalls = match.balls.filter(b => 
      b.striker.id === player.id && 
      (innings === 1 ? b.battingTeamId === match.team1.id : b.battingTeamId === match.team2.id)
    );
    
    let runs = 0;
    let balls = 0;
    let fours = 0;
    let sixes = 0;
    let gotOut = false;

    battingBalls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
        runs += ball.runs;
      }
      if (!ball.isWide && !ball.isNoBall) {
        balls++;
      }
      if (ball.runs === 4) fours++;
      if (ball.runs === 6) sixes++;
      if (ball.isWicket && ball.striker.id === player.id) gotOut = true;
    });

    const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';

    return {
      runs,
      balls,
      fours,
      sixes,
      gotOut,
      strikeRate
    };
  };

  const calculateBowlingStats = (player: Player, innings: number) => {
    const bowlingBalls = match.balls.filter(b => 
      b.bowler.id === player.id && 
      (innings === 1 ? b.battingTeamId === match.team1.id : b.battingTeamId === match.team2.id)
    );
    
    let wickets = 0;
    let runs = 0;
    let balls = 0;
    let wides = 0;
    let noBalls = 0;
    let maidens = 0;

    // Calculate per over for maidens
    const oversMap = new Map<number, { runs: number, balls: number }>();
    
    bowlingBalls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall) {
        balls++;
      }
      if (ball.isWicket && ball.wicketType !== 'run_out') {
        wickets++;
      }
      runs += ball.runs;
      if (ball.isWide) wides++;
      if (ball.isNoBall) noBalls++;

      // Track per over for maidens
      if (!oversMap.has(ball.overNumber)) {
        oversMap.set(ball.overNumber, { runs: 0, balls: 0 });
      }
      const overStats = oversMap.get(ball.overNumber)!;
      overStats.runs += ball.runs;
      if (!ball.isWide && !ball.isNoBall) {
        overStats.balls++;
      }
    });

    // Count maiden overs
    oversMap.forEach(overStat => {
      if (overStat.balls === 6 && overStat.runs === 0) {
        maidens++;
      }
    });

    const overs = Math.floor(balls / 6) + (balls % 6) / 10;
    const economy = overs > 0 ? (runs / overs).toFixed(2) : '0.00';

    return {
      overs: overs.toFixed(1),
      maidens,
      wickets,
      runs,
      economy,
      wides,
      noBalls
    };
  };

  const getDismissalInfo = (player: Player, innings: number) => {
    const wicketBall = match.balls.find(b => 
      b.isWicket && 
      b.striker.id === player.id && 
      (innings === 1 ? b.battingTeamId === match.team1.id : b.battingTeamId === match.team2.id)
    );
    
    if (wicketBall) {
      let info = '';
      if (wicketBall.wicketType === 'caught' && wicketBall.fielder) {
        info = `c ${wicketBall.fielder.name} b ${wicketBall.bowler.name}`;
      } else if (wicketBall.wicketType === 'bowled') {
        info = `b ${wicketBall.bowler.name}`;
      } else if (wicketBall.wicketType === 'lbw') {
        info = `lbw b ${wicketBall.bowler.name}`;
      } else if (wicketBall.wicketType === 'run_out') {
        info = wicketBall.fielder ? `run out (${wicketBall.fielder.name})` : 'run out';
      } else if (wicketBall.wicketType === 'stumped') {
        info = `st ${wicketBall.fielder?.name || 'wk'} b ${wicketBall.bowler.name}`;
      } else if (wicketBall.wicketType === 'hit_wicket') {
        info = `hit wicket b ${wicketBall.bowler.name}`;
      } else {
        info = `${wicketBall.wicketType} b ${wicketBall.bowler.name}`;
      }
      return info;
    }
    return 'not out';
  };

  // Get match result
  const matchResult = CricketEngine.getMatchResult(match);

  // Calculate run rates
  const team1RunRate = match.team1.overs > 0 ? 
    ((match.team1.score / (match.team1.overs + match.team1.balls / 6))).toFixed(2) : '0.00';
  const team2RunRate = match.team2.overs > 0 ? 
    ((match.team2.score / (match.team2.overs + match.team2.balls / 6))).toFixed(2) : '0.00';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header with Match Result */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">{match.team1.name} vs {match.team2.name}</h2>
              <div className="text-lg font-semibold text-yellow-200 mb-2">
                {matchResult}
              </div>
              <div className="text-sm opacity-90">
                {new Date(match.startTime).toLocaleDateString()} • {match.totalOvers} overs per side
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Man of the Match */}
          {match.manOfTheMatch && (
            <div className="mt-4 flex items-center bg-white/10 rounded-lg p-3">
              <Award className="w-5 h-5 mr-2 text-yellow-300" />
              <span className="font-semibold">Man of the Match: {match.manOfTheMatch.name}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6 bg-gray-50">
          {/* First Innings */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{match.team1.name} - 1st Innings</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold">{match.team1.score}-{match.team1.wickets}</div>
                  <div className="text-sm">({match.team1.overs}.{match.team1.balls} overs, RR: {team1RunRate})</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-b-lg shadow-sm overflow-hidden">
              {/* Batting Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Batsman</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500">Dismissal</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">R</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">B</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">4s</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">6s</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">SR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {match.team1.players.map(player => {
                      const stats = calculateBattingStats(player, 1);
                      if (stats.balls === 0) return null;
                      return (
                        <tr key={player.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{player.name}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{getDismissalInfo(player, 1)}</td>
                          <td className="px-4 py-3 text-right font-bold">{stats.runs}</td>
                          <td className="px-4 py-3 text-right">{stats.balls}</td>
                          <td className="px-4 py-3 text-right">{stats.fours}</td>
                          <td className="px-4 py-3 text-right">{stats.sixes}</td>
                          <td className="px-4 py-3 text-right">{stats.strikeRate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Extras and Total */}
              <div className="p-4 bg-gray-50 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700">
                    Extras: (B {match.team1.extras.byes}, LB {match.team1.extras.legByes}, W {match.team1.extras.wides}, NB {match.team1.extras.noBalls})
                  </span>
                  <span className="font-semibold">
                    {match.team1.extras.byes + match.team1.extras.legByes + match.team1.extras.wides + match.team1.extras.noBalls}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total</span>
                  <span>{match.team1.score}-{match.team1.wickets} ({match.team1.overs}.{match.team1.balls} overs)</span>
                </div>
              </div>

              {/* Fall of Wickets */}
              {match.team1.fallOfWickets && match.team1.fallOfWickets.length > 0 && (
                <div className="p-4 border-t">
                  <h4 className="font-semibold text-gray-800 mb-2">Fall of Wickets</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    {match.team1.fallOfWickets.map((fall, index) => (
                      <div key={index}>
                        {fall.wicketNumber}-{fall.score} ({fall.batsman}, {fall.over} ov)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bowling Figures */}
              <div className="p-4 border-t">
                <h4 className="font-semibold text-gray-800 mb-3">Bowling</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Bowler</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">O</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">M</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">R</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">W</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">Econ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {match.team2.players.map(player => {
                        const stats = calculateBowlingStats(player, 1);
                        if (parseFloat(stats.overs) === 0) return null;
                        return (
                          <tr key={player.id}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{player.name}</td>
                            <td className="px-3 py-2 text-right text-sm">{stats.overs}</td>
                            <td className="px-3 py-2 text-right text-sm">{stats.maidens}</td>
                            <td className="px-3 py-2 text-right text-sm font-semibold">{stats.runs}</td>
                            <td className="px-3 py-2 text-right text-sm font-semibold">{stats.wickets}</td>
                            <td className="px-3 py-2 text-right text-sm">{stats.economy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Second Innings */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{match.team2.name} - 2nd Innings</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold">{match.team2.score}-{match.team2.wickets}</div>
                  <div className="text-sm">({match.team2.overs}.{match.team2.balls} overs, RR: {team2RunRate})</div>
                </div>
              </div>
              {match.firstInningsScore && (
                <div className="mt-2 text-sm opacity-90">
                  Target: {match.firstInningsScore + 1} runs
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-b-lg shadow-sm overflow-hidden">
              {/* Batting Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Batsman</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500">Dismissal</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">R</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">B</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">4s</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">6s</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500">SR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {match.team2.players.map(player => {
                      const stats = calculateBattingStats(player, 2);
                      if (stats.balls === 0) return null;
                      return (
                        <tr key={player.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{player.name}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{getDismissalInfo(player, 2)}</td>
                          <td className="px-4 py-3 text-right font-bold">{stats.runs}</td>
                          <td className="px-4 py-3 text-right">{stats.balls}</td>
                          <td className="px-4 py-3 text-right">{stats.fours}</td>
                          <td className="px-4 py-3 text-right">{stats.sixes}</td>
                          <td className="px-4 py-3 text-right">{stats.strikeRate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Extras and Total */}
              <div className="p-4 bg-gray-50 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700">
                    Extras: (B {match.team2.extras.byes}, LB {match.team2.extras.legByes}, W {match.team2.extras.wides}, NB {match.team2.extras.noBalls})
                  </span>
                  <span className="font-semibold">
                    {match.team2.extras.byes + match.team2.extras.legByes + match.team2.extras.wides + match.team2.extras.noBalls}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total</span>
                  <span>{match.team2.score}-{match.team2.wickets} ({match.team2.overs}.{match.team2.balls} overs)</span>
                </div>
              </div>

              {/* Fall of Wickets */}
              {match.team2.fallOfWickets && match.team2.fallOfWickets.length > 0 && (
                <div className="p-4 border-t">
                  <h4 className="font-semibold text-gray-800 mb-2">Fall of Wickets</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    {match.team2.fallOfWickets.map((fall, index) => (
                      <div key={index}>
                        {fall.wicketNumber}-{fall.score} ({fall.batsman}, {fall.over} ov)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bowling Figures */}
              <div className="p-4 border-t">
                <h4 className="font-semibold text-gray-800 mb-3">Bowling</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Bowler</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">O</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">M</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">R</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">W</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-500">Econ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {match.team1.players.map(player => {
                        const stats = calculateBowlingStats(player, 2);
                        if (parseFloat(stats.overs) === 0) return null;
                        return (
                          <tr key={player.id}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{player.name}</td>
                            <td className="px-3 py-2 text-right text-sm">{stats.overs}</td>
                            <td className="px-3 py-2 text-right text-sm">{stats.maidens}</td>
                            <td className="px-3 py-2 text-right text-sm font-semibold">{stats.runs}</td>
                            <td className="px-3 py-2 text-right text-sm font-semibold">{stats.wickets}</td>
                            <td className="px-3 py-2 text-right text-sm">{stats.economy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};