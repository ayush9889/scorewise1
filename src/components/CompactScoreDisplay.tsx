import React from 'react';
import { Match } from '../types/cricket';
import { CricketEngine } from '../services/cricketEngine';

interface CompactScoreDisplayProps {
  match: Match;
}

export const CompactScoreDisplay: React.FC<CompactScoreDisplayProps> = ({ match }) => {
  const formatOvers = (balls: number): string => {
    const overs = Math.floor(balls / 6);
    const remainingBalls = balls % 6;
    return `${overs}.${remainingBalls}`;
  };

  const calculateRunRate = (runs: number, balls: number): string => {
    if (balls === 0) return '0.00';
    return ((runs / balls) * 6).toFixed(2);
  };

  const calculateRequiredRate = (): string | null => {
    if (!match.isSecondInnings) return null;
    
    const target = match.firstInningsScore + 1;
    const remaining = target - match.battingTeam.score;
    const ballsLeft = (match.totalOvers * 6) - (match.battingTeam.overs * 6 + match.battingTeam.balls);
    
    if (ballsLeft <= 0) return '0.00';
    return ((remaining / ballsLeft) * 6).toFixed(2);
  };

  const calculatePartnership = () => {
    if (!match.currentStriker || !match.currentNonStriker) return { runs: 0, balls: 0 };
    // Only use balls from the current innings
    const currentInningsBalls = match.balls.filter(ball =>
      (!match.isSecondInnings && (ball.innings === 1 || !ball.innings)) ||
      (match.isSecondInnings && ball.innings === 2)
    );
    // Find when current partnership started (last wicket or start of innings)
    const lastWicketIndex = currentInningsBalls.map((ball, index) => ball.isWicket ? index : -1)
      .filter(index => index !== -1)
      .pop() || -1;
    const partnershipBalls = currentInningsBalls.slice(lastWicketIndex + 1);
    const runs = partnershipBalls.reduce((sum, ball) => sum + ball.runs, 0);
    const balls = partnershipBalls.filter(ball => !ball.isWide && !ball.isNoBall).length;
    return { runs, balls };
  };

  const calculateBatsmanStats = (player: any) => {
    const playerBalls = match.balls.filter(b => b.striker.id === player.id);
    const runs = playerBalls.reduce((sum, ball) => {
      if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
        return sum + ball.runs;
      }
      return sum;
    }, 0);
    const ballsFaced = playerBalls.filter(b => !b.isWide && !b.isNoBall).length;
    const fours = playerBalls.filter(b => b.runs === 4).length;
    const sixes = playerBalls.filter(b => b.runs === 6).length;
    const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(2) : '0.00';

    return { runs, ballsFaced, fours, sixes, strikeRate };
  };

  const calculateBowlerStats = (player: any) => {
    const bowlerBalls = match.balls.filter(b => b.bowler.id === player.id);
    const runs = bowlerBalls.reduce((sum, ball) => sum + ball.runs, 0);
    const ballsBowled = bowlerBalls.filter(b => !b.isWide && !b.isNoBall).length;
    const wickets = bowlerBalls.filter(b => b.isWicket && b.wicketType !== 'run_out').length;
    const maidens = 0; // Calculate maiden overs if needed
    const economy = ballsBowled > 0 ? ((runs / ballsBowled) * 6).toFixed(2) : '0.00';
    const overs = Math.floor(ballsBowled / 6);
    const remainingBalls = ballsBowled % 6;

    return { runs, ballsBowled, wickets, maidens, economy, overs, remainingBalls };
  };

  const requiredRate = calculateRequiredRate();
  const currentRate = calculateRunRate(match.battingTeam.score, match.battingTeam.overs * 6 + match.battingTeam.balls);
  const partnership = calculatePartnership();

  // Get current player stats
  const strikerStats = match.currentStriker ? calculateBatsmanStats(match.currentStriker) : null;
  const nonStrikerStats = match.currentNonStriker ? calculateBatsmanStats(match.currentNonStriker) : null;
  const bowlerStats = match.currentBowler ? calculateBowlerStats(match.currentBowler) : null;

  // Get match result if completed
  const matchResult = match.isCompleted ? CricketEngine.getMatchResult(match) : null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      {/* Match Result (if completed) */}
      {matchResult && (
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 rounded-lg mb-4 text-center">
          <div className="text-lg font-bold">{matchResult}</div>
          {match.manOfTheMatch && (
            <div className="text-sm mt-1 opacity-90">
              Man of the Match: {match.manOfTheMatch.name}
            </div>
          )}
        </div>
      )}

      {/* Toss Info */}
      <div className="text-sm text-red-500 mb-2 font-medium">
        {match.tossWinner} opt to {match.tossDecision}
      </div>

      {/* Team Name */}
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {match.battingTeam.name}
      </div>

      {/* Main Score */}
      <div className="flex items-baseline space-x-2 mb-4">
        <div className="text-5xl font-bold text-gray-900">
          {match.battingTeam.score}
        </div>
        <div className="text-5xl font-bold text-gray-900">
          -
        </div>
        <div className="text-5xl font-bold text-gray-900">
          {match.battingTeam.wickets}
        </div>
        <div className="text-2xl text-gray-600 ml-2">
          ({formatOvers(match.battingTeam.overs * 6 + match.battingTeam.balls)})
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center space-x-6 text-sm text-gray-600 mb-6">
        <div>
          <span className="font-medium">CRR</span> {currentRate}
        </div>
        {partnership.balls > 0 && (
          <div>
            <span className="font-medium">P'SHIP</span> {partnership.runs}({partnership.balls})
          </div>
        )}
        {requiredRate && (
          <div>
            <span className="font-medium">RRR</span> {requiredRate}
          </div>
        )}
        <div className="ml-auto">
          <button className="text-blue-600 font-medium">More</button>
        </div>
      </div>

      {/* Target Display for Second Innings */}
      {match.isSecondInnings && (
        <div className="bg-orange-50 rounded-lg p-3 mb-6 text-center">
          <div className="text-sm text-orange-700">
            Target: {match.firstInningsScore + 1} • Need {match.firstInningsScore + 1 - match.battingTeam.score} runs from{' '}
            {(match.totalOvers * 6) - (match.battingTeam.overs * 6 + match.battingTeam.balls)} balls
          </div>
        </div>
      )}

      {/* Batsmen Stats Table */}
      <div className="mb-6">
        <div className="grid grid-cols-7 gap-2 text-xs font-medium text-gray-500 mb-3 border-b pb-2">
          <div className="col-span-2">Batter</div>
          <div className="text-center">R</div>
          <div className="text-center">B</div>
          <div className="text-center">4s</div>
          <div className="text-center">6s</div>
          <div className="text-center">SR</div>
        </div>
        
        {/* Striker */}
        {match.currentStriker && strikerStats && (
          <div className="grid grid-cols-7 gap-2 text-sm mb-3">
            <div className="col-span-2 flex items-center">
              <span className="text-blue-600 font-medium">{match.currentStriker.name}</span>
              <span className="ml-1 text-blue-600 font-bold">*</span>
            </div>
            <div className="text-center font-bold">{strikerStats.runs}</div>
            <div className="text-center">{strikerStats.ballsFaced}</div>
            <div className="text-center">{strikerStats.fours}</div>
            <div className="text-center">{strikerStats.sixes}</div>
            <div className="text-center">{strikerStats.strikeRate}</div>
          </div>
        )}
        
        {/* Non-Striker */}
        {match.currentNonStriker && nonStrikerStats && (
          <div className="grid grid-cols-7 gap-2 text-sm">
            <div className="col-span-2">
              <span className="text-blue-600 font-medium">{match.currentNonStriker.name}</span>
            </div>
            <div className="text-center font-bold">{nonStrikerStats.runs}</div>
            <div className="text-center">{nonStrikerStats.ballsFaced}</div>
            <div className="text-center">{nonStrikerStats.fours}</div>
            <div className="text-center">{nonStrikerStats.sixes}</div>
            <div className="text-center">{nonStrikerStats.strikeRate}</div>
          </div>
        )}
      </div>

      {/* Bowler Stats Table */}
      <div>
        <div className="grid grid-cols-7 gap-2 text-xs font-medium text-gray-500 mb-3 border-b pb-2">
          <div className="col-span-2">Bowler</div>
          <div className="text-center">O</div>
          <div className="text-center">M</div>
          <div className="text-center">R</div>
          <div className="text-center">W</div>
          <div className="text-center">ECO</div>
        </div>
        
        {match.currentBowler && bowlerStats && (
          <div className="grid grid-cols-7 gap-2 text-sm">
            <div className="col-span-2 flex items-center">
              <span className="text-blue-600 font-medium">{match.currentBowler.name}</span>
              <span className="ml-1 text-blue-600 font-bold">*</span>
            </div>
            <div className="text-center">{bowlerStats.overs}.{bowlerStats.remainingBalls}</div>
            <div className="text-center">{bowlerStats.maidens}</div>
            <div className="text-center font-bold">{bowlerStats.runs}</div>
            <div className="text-center font-bold">{bowlerStats.wickets}</div>
            <div className="text-center">{bowlerStats.economy}</div>
          </div>
        )}
      </div>
    </div>
  );
};