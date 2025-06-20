import { Match, Player, Ball, Team, WicketType, PlayerStats, PlayerPerformance } from '../types/cricket';

export class CricketEngine {
  // STRICT match format enforcement - EXACTLY n overs, no more, no less
  static isInningsComplete(match: Match): boolean {
    const battingTeam = match.battingTeam;
    
    console.log(`🏏 CHECKING INNINGS COMPLETION:`);
    console.log(`Current: ${battingTeam.overs}.${battingTeam.balls} / ${match.totalOvers} overs`);
    console.log(`Wickets: ${battingTeam.wickets}/10`);
    
    // CRITICAL: EXACTLY the specified number of overs must be completed
    if (battingTeam.overs >= match.totalOvers) {
      console.log(`✅ INNINGS COMPLETE: All ${match.totalOvers} overs bowled`);
      return true;
    }
    
    // All wickets lost (10 wickets max)
    if (battingTeam.wickets >= 10) {
      console.log(`✅ INNINGS COMPLETE: All wickets lost`);
      return true;
    }
    
    // Target reached in second innings
    if (match.isSecondInnings && match.firstInningsScore && 
        battingTeam.score > match.firstInningsScore) {
      console.log(`✅ INNINGS COMPLETE: Target reached`);
      return true;
    }
    
    console.log(`⏳ INNINGS CONTINUES: ${match.totalOvers - battingTeam.overs} overs remaining`);
    return false;
  }

  // STRICT over completion - EXACTLY 6 valid balls
  static isOverComplete(match: Match): boolean {
    const currentOver = match.battingTeam.overs + 1;
    const validBalls = match.balls.filter(b => 
      b.overNumber === currentOver && 
      !b.isWide && 
      !b.isNoBall
    );
    
    const isComplete = validBalls.length >= 6;
    
    if (isComplete) {
      console.log(`🏏 OVER ${currentOver} COMPLETED: 6 valid balls bowled`);
    }
    
    return isComplete;
  }

  // Strike rotation logic based on real cricket rules
  static shouldRotateStrike(ball: Ball, isOverComplete: boolean): boolean {
    // Don't rotate on wides or no-balls (unless runs are taken)
    if (ball.isWide || ball.isNoBall) {
      return ball.runs > 1; // Only rotate if extra runs are taken
    }
    
    // Rotate on odd runs (1, 3, 5, etc.)
    const shouldRotateOnRuns = ball.runs % 2 === 1;
    
    // Always rotate at end of over (even if no runs scored)
    return shouldRotateOnRuns || isOverComplete;
  }

  // ABSOLUTE STRICT bowler validation - ZERO tolerance for consecutive overs
  static canBowlerBowlNextOver(bowler: Player, match: Match): boolean {
    console.log(`🏏 CHECKING: Can ${bowler.name} bowl next over?`);
    
    if (match.balls.length === 0) {
      console.log(`✅ ALLOWED: First over of match`);
      return true;
    }
    
    const currentOver = match.battingTeam.overs + 1;
    const previousOver = currentOver - 1;
    
    if (previousOver <= 0) {
      console.log(`✅ ALLOWED: No previous over to check`);
      return true;
    }
    
    // Get ALL balls from the previous over
    const previousOverBalls = match.balls.filter(b => b.overNumber === previousOver);
    
    if (previousOverBalls.length === 0) {
      console.log(`✅ ALLOWED: No balls found in previous over ${previousOver}`);
      return true;
    }
    
    // Check who bowled the previous over - ALL balls must be from same bowler
    const previousOverBowlerId = previousOverBalls[0]?.bowler?.id;
    const previousOverBowlerName = previousOverBalls[0]?.bowler?.name;
    
    console.log(`🔍 Previous over ${previousOver} bowled by: ${previousOverBowlerName} (ID: ${previousOverBowlerId})`);
    console.log(`🔍 Checking bowler: ${bowler.name} (ID: ${bowler.id})`);
    
    // ABSOLUTE RULE: If this bowler bowled the previous over, REJECT
    if (previousOverBowlerId === bowler.id) {
      console.log(`❌ REJECTED: ${bowler.name} bowled previous over ${previousOver}. CONSECUTIVE OVERS NOT ALLOWED!`);
      return false;
    }
    
    console.log(`✅ ALLOWED: ${bowler.name} did not bowl previous over`);
    return true;
  }

  // Get available bowlers with ABSOLUTE filtering
  static getAvailableBowlers(match: Match, nextOver: number): Player[] {
    console.log(`\n🏏 GETTING AVAILABLE BOWLERS FOR OVER ${nextOver}`);
    
    const allBowlers = match.bowlingTeam.players;
    console.log(`📋 All bowlers in team:`, allBowlers.map(b => b.name));
    
    if (nextOver <= 1) {
      // First over - exclude current batsmen only
      const available = allBowlers.filter(bowler => 
        bowler.id !== match.currentStriker?.id &&
        bowler.id !== match.currentNonStriker?.id
      );
      console.log(`✅ First over - Available bowlers:`, available.map(b => b.name));
      return available;
    }
    
    const previousOver = nextOver - 1;
    console.log(`🔍 Checking previous over: ${previousOver}`);
    
    // Get who bowled the previous over
    const previousOverBalls = match.balls.filter(b => b.overNumber === previousOver);
    
    if (previousOverBalls.length === 0) {
      console.log(`⚠️ No balls found in previous over ${previousOver}`);
      const available = allBowlers.filter(bowler => 
        bowler.id !== match.currentStriker?.id &&
        bowler.id !== match.currentNonStriker?.id
      );
      console.log(`✅ Available bowlers (no previous over):`, available.map(b => b.name));
      return available;
    }
    
    const previousBowlerId = previousOverBalls[0]?.bowler?.id;
    const previousBowlerName = previousOverBalls[0]?.bowler?.name;
    
    console.log(`🚫 Previous over ${previousOver} bowled by: ${previousBowlerName} (EXCLUDED)`);
    
    // ABSOLUTE FILTERING: Exclude previous bowler and current batsmen
    const availableBowlers = allBowlers.filter(bowler => {
      const isNotPreviousBowler = bowler.id !== previousBowlerId;
      const isNotCurrentBatsman = bowler.id !== match.currentStriker?.id && bowler.id !== match.currentNonStriker?.id;
      
      const isAvailable = isNotPreviousBowler && isNotCurrentBatsman;
      
      console.log(`🔍 ${bowler.name}: Previous bowler? ${!isNotPreviousBowler}, Current batsman? ${!isNotCurrentBatsman}, Available? ${isAvailable}`);
      
      return isAvailable;
    });

    console.log(`✅ FINAL AVAILABLE BOWLERS FOR OVER ${nextOver}:`, availableBowlers.map(b => b.name));
    
    if (availableBowlers.length === 0) {
      console.log(`🚨 WARNING: NO AVAILABLE BOWLERS FOR OVER ${nextOver}!`);
    }
    
    return availableBowlers;
  }

  // Process ball and update match state with STRICT over completion checking
  static processBall(match: Match, ball: Ball): Match {
    const updatedMatch = { ...match };
    
    // Add ball to match
    updatedMatch.balls.push(ball);
    
    // Update team score
    updatedMatch.battingTeam.score += ball.runs;
    
    // Handle extras
    if (ball.isWide) {
      updatedMatch.battingTeam.extras.wides++;
    } else if (ball.isNoBall) {
      updatedMatch.battingTeam.extras.noBalls++;
    } else if (ball.isBye) {
      updatedMatch.battingTeam.extras.byes += ball.runs;
    } else if (ball.isLegBye) {
      updatedMatch.battingTeam.extras.legByes += ball.runs;
    }
    
    // Handle wickets and Fall of Wickets
    if (ball.isWicket) {
      updatedMatch.battingTeam.wickets++;
      
      // Add to Fall of Wickets
      if (!updatedMatch.battingTeam.fallOfWickets) {
        updatedMatch.battingTeam.fallOfWickets = [];
      }
      
      const wicketNumber = updatedMatch.battingTeam.wickets;
      const currentScore = updatedMatch.battingTeam.score;
      const currentOver = `${updatedMatch.battingTeam.overs}.${updatedMatch.battingTeam.balls + (ball.isWide || ball.isNoBall ? 0 : 1)}`;
      
      updatedMatch.battingTeam.fallOfWickets.push({
        wicketNumber,
        score: currentScore,
        batsman: ball.striker.name,
        over: currentOver,
        bowler: ball.bowler.name,
        wicketType: ball.wicketType || 'out'
      });
    }
    
    // Update ball count (only for valid deliveries)
    if (!ball.isWide && !ball.isNoBall) {
      updatedMatch.battingTeam.balls++;
      
      // Check if over is complete (EXACTLY 6 valid balls)
      if (updatedMatch.battingTeam.balls >= 6) {
        console.log(`🏏 OVER ${updatedMatch.battingTeam.overs + 1} COMPLETED!`);
        
        updatedMatch.battingTeam.overs++;
        updatedMatch.battingTeam.balls = 0;
        
        // Force strike rotation at end of over
        const temp = updatedMatch.currentStriker;
        updatedMatch.currentStriker = updatedMatch.currentNonStriker;
        updatedMatch.currentNonStriker = temp;
        
        console.log(`🔄 Strike rotated: ${updatedMatch.currentStriker?.name} now on strike`);
        
        // CRITICAL: Clear current bowler to force new selection
        console.log(`🚫 CLEARING CURRENT BOWLER - NEW BOWLER MUST BE SELECTED`);
        updatedMatch.previousBowler = updatedMatch.currentBowler;
        updatedMatch.currentBowler = undefined;
        
      } else {
        // Check for strike rotation during over
        if (this.shouldRotateStrike(ball, false)) {
          const temp = updatedMatch.currentStriker;
          updatedMatch.currentStriker = updatedMatch.currentNonStriker;
          updatedMatch.currentNonStriker = temp;
          console.log(`🔄 Strike rotated mid-over: ${updatedMatch.currentStriker?.name} now on strike`);
        }
      }
    } else {
      // For wides and no-balls, only rotate if extra runs are taken
      if (ball.runs > 1) {
        const temp = updatedMatch.currentStriker;
        updatedMatch.currentStriker = updatedMatch.currentNonStriker;
        updatedMatch.currentNonStriker = temp;
        console.log(`🔄 Strike rotated on extra: ${updatedMatch.currentStriker?.name} now on strike`);
      }
    }
    
    return updatedMatch;
  }

  // Get proper cricket match result
  static getMatchResult(match: Match): string {
    if (!match.isCompleted) {
      return 'Match in progress';
    }

    // Determine which team batted first and second
    let firstInningsTeam: Team;
    let secondInningsTeam: Team;
    let firstInningsScore: number;
    let secondInningsScore: number;

    // Check if we have proper team data
    if (match.isSecondInnings) {
      // Current batting team is chasing
      secondInningsTeam = match.battingTeam;
      firstInningsTeam = match.bowlingTeam;
      firstInningsScore = match.firstInningsScore || firstInningsTeam.score;
      secondInningsScore = secondInningsTeam.score;
    } else {
      // Use team1 and team2 data
      firstInningsTeam = match.team1;
      secondInningsTeam = match.team2;
      firstInningsScore = firstInningsTeam.score;
      secondInningsScore = secondInningsTeam.score;
    }

    // Calculate result based on cricket rules
    if (secondInningsScore > firstInningsScore) {
      // Team 2 (chasing team) won
      const wicketsRemaining = 10 - secondInningsTeam.wickets;
      const ballsRemaining = (match.totalOvers * 6) - (secondInningsTeam.overs * 6 + secondInningsTeam.balls);
      
      if (wicketsRemaining === 10) {
        return `${secondInningsTeam.name} won by 10 wickets`;
      } else {
        return `${secondInningsTeam.name} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`;
      }
    } else if (firstInningsScore > secondInningsScore) {
      // Team 1 (batting first) won
      const runsMargin = firstInningsScore - secondInningsScore;
      return `${firstInningsTeam.name} won by ${runsMargin} run${runsMargin === 1 ? '' : 's'}`;
    } else if (firstInningsScore === secondInningsScore) {
      // Match tied
      return 'Match tied';
    } else {
      // Fallback
      return 'Match completed';
    }
  }

  // Calculate comprehensive player stats with enhanced tracking
  static updatePlayerStats(player: Player, match: Match): PlayerStats {
    const stats = { ...player.stats };
    stats.matchesPlayed++;

    // Batting stats
    const battingBalls = match.balls.filter(b => b.striker.id === player.id);
    let runsScored = 0;
    let ballsFaced = 0;
    let fours = 0;
    let sixes = 0;
    let gotOut = false;
    let dotBalls = 0;

    battingBalls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
        runsScored += ball.runs;
      }
      if (!ball.isWide && !ball.isNoBall) {
        ballsFaced++;
        if (ball.runs === 0) dotBalls++;
      }
      if (ball.runs === 4) fours++;
      if (ball.runs === 6) sixes++;
      if (ball.isWicket && ball.striker.id === player.id) gotOut = true;
    });

    stats.runsScored += runsScored;
    stats.ballsFaced += ballsFaced;
    stats.fours += fours;
    stats.sixes += sixes;
    stats.dotBalls += dotBalls;
    if (gotOut) stats.timesOut++;
    if (gotOut && runsScored === 0) stats.ducks++;
    if (runsScored >= 50 && runsScored < 100) stats.fifties++;
    if (runsScored >= 100) stats.hundreds++;
    if (runsScored > stats.highestScore) stats.highestScore = runsScored;

    // Bowling stats with proper over calculation
    const bowlingBalls = match.balls.filter(b => b.bowler.id === player.id);
    let wicketsTaken = 0;
    let runsConceded = 0;
    let ballsBowled = 0;
    let maidenOvers = 0;

    // Calculate bowling stats per over
    const bowlingOvers = new Map<number, { runs: number, wickets: number, balls: number }>();
    
    bowlingBalls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall) {
        ballsBowled++;
      }
      if (ball.isWicket && ball.wicketType !== 'run_out') {
        wicketsTaken++;
      }
      runsConceded += ball.runs;

      // Track per over
      const overKey = ball.overNumber;
      if (!bowlingOvers.has(overKey)) {
        bowlingOvers.set(overKey, { runs: 0, wickets: 0, balls: 0 });
      }
      const overStats = bowlingOvers.get(overKey)!;
      overStats.runs += ball.runs;
      if (ball.isWicket && ball.wicketType !== 'run_out') {
        overStats.wickets++;
      }
      if (!ball.isWide && !ball.isNoBall) {
        overStats.balls++;
      }
    });

    // Count maiden overs (6 balls, 0 runs)
    bowlingOvers.forEach(overStat => {
      if (overStat.balls === 6 && overStat.runs === 0) {
        maidenOvers++;
      }
    });

    stats.wicketsTaken += wicketsTaken;
    stats.ballsBowled += ballsBowled;
    stats.runsConceded += runsConceded;
    stats.maidenOvers += maidenOvers;

    // Update best bowling figures
    if (wicketsTaken > 0) {
      const currentFigures = `${wicketsTaken}/${runsConceded}`;
      if (!stats.bestBowlingFigures || stats.bestBowlingFigures === '0/0' || 
          this.compareBowlingFigures(currentFigures, stats.bestBowlingFigures)) {
        stats.bestBowlingFigures = currentFigures;
      }
    }

    // Fielding stats
    const catches = match.balls.filter(b => 
      b.isWicket && b.wicketType === 'caught' && b.fielder?.id === player.id
    ).length;
    
    const runOuts = match.balls.filter(b => 
      b.isWicket && b.wicketType === 'run_out' && b.fielder?.id === player.id
    ).length;

    const stumpings = match.balls.filter(b => 
      b.isWicket && b.wicketType === 'stumped' && b.fielder?.id === player.id
    ).length;

    stats.catches += catches;
    stats.runOuts += runOuts;

    // MOTM awards
    if (match.manOfTheMatch?.id === player.id) {
      stats.motmAwards++;
    }

    console.log(`Updated stats for ${player.name}:`, {
      runsScored,
      ballsFaced,
      wicketsTaken,
      ballsBowled,
      catches,
      runOuts,
      motmAwards: stats.motmAwards
    });

    return stats;
  }

  private static compareBowlingFigures(current: string, best: string): boolean {
    const [currentWickets, currentRuns] = current.split('/').map(Number);
    const [bestWickets, bestRuns] = best.split('/').map(Number);
    
    if (currentWickets > bestWickets) return true;
    if (currentWickets === bestWickets && currentRuns < bestRuns) return true;
    return false;
  }

  // Calculate batting average
  static calculateBattingAverage(stats: PlayerStats): string {
    if (stats.timesOut === 0) return stats.runsScored > 0 ? stats.runsScored.toString() : '0';
    return (stats.runsScored / stats.timesOut).toFixed(2);
  }

  // Calculate strike rate
  static calculateStrikeRate(stats: PlayerStats): string {
    if (stats.ballsFaced === 0) return '0.00';
    return ((stats.runsScored / stats.ballsFaced) * 100).toFixed(2);
  }

  // Calculate bowling average
  static calculateBowlingAverage(stats: PlayerStats): string {
    if (stats.wicketsTaken === 0) return '0.00';
    return (stats.runsConceded / stats.wicketsTaken).toFixed(2);
  }

  // Calculate economy rate
  static calculateEconomyRate(stats: PlayerStats): string {
    if (stats.ballsBowled === 0) return '0.00';
    return ((stats.runsConceded / stats.ballsBowled) * 6).toFixed(2);
  }

  // Calculate Man of the Match based on performance
  static calculateManOfTheMatch(match: Match): Player | null {
    if (!match.isCompleted) return null;

    const allPlayers = [...match.team1.players, ...match.team2.players];
    const performances: PlayerPerformance[] = [];

    allPlayers.forEach(player => {
      const performance = this.calculatePlayerPerformance(player, match);
      if (performance.totalScore > 0) { // Only consider players who participated
        performances.push(performance);
      }
    });

    // Sort by total performance score
    performances.sort((a, b) => b.totalScore - a.totalScore);
    
    if (performances.length === 0) return null;
    
    const topPerformer = performances[0];
    const motmPlayer = allPlayers.find(p => p.id === topPerformer.playerId);
    
    console.log('MOTM Calculation:', {
      topPerformer: motmPlayer?.name,
      score: topPerformer.totalScore,
      batting: topPerformer.battingScore,
      bowling: topPerformer.bowlingScore,
      fielding: topPerformer.fieldingScore
    });
    
    return motmPlayer || null;
  }

  private static calculatePlayerPerformance(player: Player, match: Match): PlayerPerformance {
    let battingScore = 0;
    let bowlingScore = 0;
    let fieldingScore = 0;

    // Batting Performance
    const battingBalls = match.balls.filter(b => b.striker.id === player.id);
    let runsScored = 0;
    let ballsFaced = 0;
    let fours = 0;
    let sixes = 0;
    let gotOut = false;

    battingBalls.forEach(ball => {
      if (ball.striker.id === player.id) {
        if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
          runsScored += ball.runs;
        }
        if (!ball.isWide && !ball.isNoBall) {
          ballsFaced++;
        }
        if (ball.runs === 4) fours++;
        if (ball.runs === 6) sixes++;
        if (ball.isWicket) gotOut = true;
      }
    });

    // Enhanced batting score calculation
    if (ballsFaced > 0) {
      const strikeRate = (runsScored / ballsFaced) * 100;
      
      // Base runs score
      battingScore += runsScored * 1.5;
      
      // Strike rate bonus/penalty
      if (strikeRate >= 150) battingScore += runsScored * 0.4;
      else if (strikeRate >= 120) battingScore += runsScored * 0.2;
      else if (strikeRate < 80 && ballsFaced >= 10) battingScore -= runsScored * 0.1;
      
      // Milestone bonuses
      if (runsScored >= 100) battingScore += 50;
      else if (runsScored >= 50) battingScore += 25;
      else if (runsScored >= 30) battingScore += 10;
      
      // Boundary bonuses
      battingScore += fours * 2;
      battingScore += sixes * 4;
      
      // Not out bonus for significant scores
      if (!gotOut && runsScored >= 20) battingScore += 10;
      
      // Duck penalty
      if (gotOut && runsScored === 0) battingScore -= 10;
    }

    // Bowling Performance
    const bowlingBalls = match.balls.filter(b => b.bowler.id === player.id);
    let wicketsTaken = 0;
    let runsConceded = 0;
    let ballsBowled = 0;
    let dotBalls = 0;

    bowlingBalls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall) {
        ballsBowled++;
        if (ball.runs === 0) dotBalls++;
      }
      if (ball.isWicket && ball.wicketType !== 'run_out') {
        wicketsTaken++;
      }
      runsConceded += ball.runs;
    });

    // Enhanced bowling score calculation
    if (ballsBowled > 0) {
      const economyRate = (runsConceded / ballsBowled) * 6;
      const dotBallPercentage = (dotBalls / ballsBowled) * 100;
      
      // Wicket points
      bowlingScore += wicketsTaken * 25;
      
      // Economy rate bonus/penalty
      if (economyRate <= 4) bowlingScore += 20;
      else if (economyRate <= 6) bowlingScore += 10;
      else if (economyRate >= 10) bowlingScore -= 10;
      
      // Dot ball bonus
      if (dotBallPercentage >= 60) bowlingScore += 15;
      else if (dotBallPercentage >= 40) bowlingScore += 8;
      
      // Wicket milestone bonuses
      if (wicketsTaken >= 5) bowlingScore += 30;
      else if (wicketsTaken >= 3) bowlingScore += 15;
    }

    // Fielding Performance
    const catches = match.balls.filter(b => 
      b.isWicket && b.wicketType === 'caught' && b.fielder?.id === player.id
    ).length;
    
    const runOuts = match.balls.filter(b => 
      b.isWicket && b.wicketType === 'run_out' && b.fielder?.id === player.id
    ).length;

    const stumpings = match.balls.filter(b => 
      b.isWicket && b.wicketType === 'stumped' && b.fielder?.id === player.id
    ).length;

    // Enhanced fielding score calculation
    fieldingScore += catches * 8;
    fieldingScore += runOuts * 12;
    fieldingScore += stumpings * 10;

    const totalScore = battingScore + bowlingScore + fieldingScore;

    return {
      playerId: player.id,
      battingScore,
      bowlingScore,
      fieldingScore,
      totalScore,
      runsScored,
      ballsFaced,
      wicketsTaken,
      catches,
      runOuts
    };
  }
}