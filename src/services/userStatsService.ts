import { Match, Player, Ball } from '../types/cricket';
import { storageService } from './storage';
import { authService } from './authService';

export class UserStatsService {
  
  // Update user statistics automatically after match completion
  static async updateMatchStatistics(match: Match): Promise<void> {
    console.log('📊 Updating user statistics for completed match:', match.id);

    try {
      // Get all players who participated in the match
      const allPlayers = [
        ...match.team1.players,
        ...match.team2.players
      ];

      // Update statistics for each player
      for (const player of allPlayers) {
        const playerStats = this.calculatePlayerMatchStats(match, player);
        await storageService.updateUserStatistics(player.id, playerStats);
        console.log(`✅ Updated stats for player: ${player.name}`);
      }

      // If current user participated, update their session
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        const userParticipated = allPlayers.some(p => p.id === currentUser.id);
        if (userParticipated) {
          const userStats = this.calculatePlayerMatchStats(match, 
            allPlayers.find(p => p.id === currentUser.id)!
          );
          await authService.updateUserStatistics(userStats);
          console.log('✅ Updated current user session statistics');
        }
      }

      console.log('🎉 All user statistics updated successfully');

    } catch (error) {
      console.error('❌ Failed to update user statistics:', error);
    }
  }

  // Calculate comprehensive match statistics for a player
  static calculatePlayerMatchStats(match: Match, player: Player): any {
    console.log(`📊 Calculating match stats for ${player.name} in match ${match.id}`);

    const stats = {
      // Match result
      result: this.getMatchResult(match, player),
      
      // Batting statistics
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      
      // Bowling statistics
      wickets: 0,
      ballsBowled: 0,
      runsConceded: 0,
      maidenOvers: 0,
      
      // Fielding statistics
      catches: 0,
      runOuts: 0,
      stumpings: 0,
      
      // Special achievements
      isMotm: false,
      century: false,
      halfCentury: false,
      fiveWickets: false
    };

    // Calculate batting stats
    const battingBalls = match.balls.filter(ball => ball.striker.id === player.id);
    
    battingBalls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall) {
        stats.ballsFaced++;
      }
      
      if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
        stats.runs += ball.runs;
        
        if (ball.runs === 4) stats.fours++;
        if (ball.runs === 6) stats.sixes++;
      }
    });

    // Calculate bowling stats
    const bowlingBalls = match.balls.filter(ball => ball.bowler.id === player.id);
    const bowlingOvers = this.groupBallsByOver(bowlingBalls);
    
    bowlingBalls.forEach(ball => {
      stats.ballsBowled++;
      stats.runsConceded += ball.runs;
      
      if (ball.isWicket && ball.wicketType !== 'run_out') {
        stats.wickets++;
      }
      
      if (ball.isWide || ball.isNoBall) {
        stats.runsConceded += 1; // Extra run for wide/no-ball
      }
    });

    // Calculate maiden overs
    bowlingOvers.forEach(over => {
      const overRuns = over.reduce((total, ball) => total + ball.runs, 0);
      if (overRuns === 0 && over.length >= 6) {
        stats.maidenOvers++;
      }
    });

    // Calculate fielding stats
    const fieldingBalls = match.balls.filter(ball => 
      ball.isWicket && 
      (ball.wicketType === 'caught' || ball.wicketType === 'run_out' || ball.wicketType === 'stumped') &&
      ball.fielder?.id === player.id
    );

    fieldingBalls.forEach(ball => {
      if (ball.wicketType === 'caught') stats.catches++;
      if (ball.wicketType === 'run_out') stats.runOuts++;
      if (ball.wicketType === 'stumped') stats.stumpings++;
    });

    // Check for special achievements
    stats.century = stats.runs >= 100;
    stats.halfCentury = stats.runs >= 50 && stats.runs < 100;
    stats.fiveWickets = stats.wickets >= 5;
    stats.isMotm = match.manOfTheMatch?.id === player.id;

    console.log(`📊 Stats calculated for ${player.name}:`, stats);
    return stats;
  }

  // Get match result for a player (win/loss/draw)
  static getMatchResult(match: Match, player: Player): 'win' | 'loss' | 'draw' {
    if (!match.isCompleted || !match.winner) {
      return 'draw';
    }

    // Check which team the player belongs to
    const isTeam1 = match.team1.players.some(p => p.id === player.id);
    const isTeam2 = match.team2.players.some(p => p.id === player.id);

    if (!isTeam1 && !isTeam2) {
      return 'draw'; // Player not in either team
    }

    const playerTeam = isTeam1 ? match.team1.name : match.team2.name;
    
    if (match.winner === playerTeam) {
      return 'win';
    } else if (match.winner === 'Draw' || match.winner === 'Tie') {
      return 'draw';
    } else {
      return 'loss';
    }
  }

  // Group balls by over for maiden over calculation
  static groupBallsByOver(balls: Ball[]): Ball[][] {
    const overs: Ball[][] = [];
    let currentOver: Ball[] = [];
    let ballCount = 0;

    balls.forEach(ball => {
      if (!ball.isWide && !ball.isNoBall) {
        ballCount++;
      }

      currentOver.push(ball);

      // Complete over (6 legal balls)
      if (ballCount === 6) {
        overs.push([...currentOver]);
        currentOver = [];
        ballCount = 0;
      }
    });

    // Add incomplete over if it exists
    if (currentOver.length > 0) {
      overs.push(currentOver);
    }

    return overs;
  }

  // Calculate team statistics for match
  static calculateTeamStats(match: Match): any {
    return {
      team1: {
        name: match.team1.name,
        score: match.team1.score,
        wickets: match.team1.wickets,
        overs: `${match.team1.overs}.${match.team1.balls}`,
        runRate: match.team1.overs > 0 ? (match.team1.score / (match.team1.overs + match.team1.balls / 6)).toFixed(2) : '0.00'
      },
      team2: {
        name: match.team2.name,
        score: match.team2.score,
        wickets: match.team2.wickets,
        overs: `${match.team2.overs}.${match.team2.balls}`,
        runRate: match.team2.overs > 0 ? (match.team2.score / (match.team2.overs + match.team2.balls / 6)).toFixed(2) : '0.00'
      },
      winner: match.winner,
      margin: this.calculateWinMargin(match),
      motm: match.manOfTheMatch,
      matchDate: match.startTime,
      venue: match.venue || 'Not specified'
    };
  }

  // Calculate win margin (runs or wickets)
  static calculateWinMargin(match: Match): string {
    if (!match.isCompleted || !match.winner || match.winner === 'Draw' || match.winner === 'Tie') {
      return 'Match drawn/tied';
    }

    const team1 = match.team1;
    const team2 = match.team2;

    // Determine which team won
    const winningTeam = match.winner === team1.name ? team1 : team2;
    const losingTeam = match.winner === team1.name ? team2 : team1;

    // If team batting second won
    if (winningTeam.score > losingTeam.score) {
      const wicketsRemaining = 10 - winningTeam.wickets;
      return `Won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`;
    } else {
      // If team batting first won
      const runMargin = winningTeam.score - losingTeam.score;
      return `Won by ${runMargin} run${runMargin !== 1 ? 's' : ''}`;
    }
  }

  // Get player career summary
  static async getPlayerCareerSummary(playerId: string): Promise<any> {
    try {
      const user = await storageService.getUser(playerId);
      if (!user || !user.statistics) {
        return null;
      }

      const stats = user.statistics;
      
      return {
        personal: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          joinDate: new Date(user.createdAt).toLocaleDateString(),
          lastActive: new Date(user.lastLoginAt).toLocaleDateString()
        },
        career: {
          matches: stats.totalMatches,
          wins: stats.totalWins,
          losses: stats.totalLosses,
          winPercentage: stats.totalMatches > 0 ? ((stats.totalWins / stats.totalMatches) * 100).toFixed(1) : '0.0'
        },
        batting: {
          runs: stats.totalRuns,
          average: stats.battingAverage.toFixed(2),
          strikeRate: stats.strikeRate.toFixed(2),
          highestScore: stats.highestScore,
          centuries: stats.centuries,
          halfCenturies: stats.halfCenturies,
          fours: stats.fours,
          sixes: stats.sixes
        },
        bowling: {
          wickets: stats.totalWickets,
          average: stats.bowlingAverage.toFixed(2),
          economy: stats.economyRate.toFixed(2),
          bestFigures: stats.bestBowlingFigures,
          fiveWickets: stats.fiveWicketHauls,
          maidens: stats.maidenOvers
        },
        fielding: {
          catches: stats.catches,
          runOuts: stats.runOuts,
          stumpings: stats.stumpings
        },
        awards: {
          motm: stats.manOfTheMatchAwards,
          achievements: stats.achievements.length
        }
      };

    } catch (error) {
      console.error('❌ Failed to get player career summary:', error);
      return null;
    }
  }

  // Export player statistics as CSV
  static exportPlayerStatsCSV(playerStats: any): string {
    const csvHeaders = [
      'Category', 'Statistic', 'Value'
    ];

    const csvRows = [
      ['Personal', 'Name', playerStats.personal.name],
      ['Personal', 'Join Date', playerStats.personal.joinDate],
      ['Career', 'Matches', playerStats.career.matches],
      ['Career', 'Wins', playerStats.career.wins],
      ['Career', 'Win %', playerStats.career.winPercentage],
      ['Batting', 'Runs', playerStats.batting.runs],
      ['Batting', 'Average', playerStats.batting.average],
      ['Batting', 'Strike Rate', playerStats.batting.strikeRate],
      ['Batting', 'Highest Score', playerStats.batting.highestScore],
      ['Batting', 'Centuries', playerStats.batting.centuries],
      ['Batting', 'Half Centuries', playerStats.batting.halfCenturies],
      ['Bowling', 'Wickets', playerStats.bowling.wickets],
      ['Bowling', 'Average', playerStats.bowling.average],
      ['Bowling', 'Economy', playerStats.bowling.economy],
      ['Bowling', 'Best Figures', playerStats.bowling.bestFigures],
      ['Fielding', 'Catches', playerStats.fielding.catches],
      ['Fielding', 'Run Outs', playerStats.fielding.runOuts],
      ['Awards', 'MOTM', playerStats.awards.motm]
    ];

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }
}

export const userStatsService = new UserStatsService(); 