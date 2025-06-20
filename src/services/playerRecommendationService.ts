import { Player, Match, PlayerStats } from '../types/cricket';
import { CricketEngine } from './cricketEngine';

export interface PlayerRecommendation {
  player: Player;
  score: number;
  reasons: string[];
  badge: 'excellent' | 'good' | 'average' | 'backup';
  isTopChoice: boolean;
}

export interface RecommendationContext {
  role: 'batting' | 'bowling' | 'fielding' | 'wicketkeeper';
  situation: 'opening' | 'middle_order' | 'death_overs' | 'power_play' | 'chase' | 'defense';
  teamScore?: number;
  targetScore?: number;
  wicketsDown?: number;
  oversRemaining?: number;
  requiredRunRate?: number;
}

export class PlayerRecommendationService {
  
  /**
   * Get intelligent player recommendations for batting
   */
  static getBattingRecommendations(
    availablePlayers: Player[],
    context: RecommendationContext,
    match?: Match
  ): PlayerRecommendation[] {
    const recommendations: PlayerRecommendation[] = [];
    
    availablePlayers.forEach(player => {
      const score = this.calculateBattingScore(player, context, match);
      const reasons = this.getBattingReasons(player, context, match);
      const badge = this.getBadgeForScore(score);
      
      recommendations.push({
        player,
        score,
        reasons,
        badge,
        isTopChoice: false
      });
    });
    
    // Sort by score and mark top choices
    recommendations.sort((a, b) => b.score - a.score);
    if (recommendations.length > 0) {
      recommendations[0].isTopChoice = true;
      // Mark additional top choices if scores are close
      for (let i = 1; i < Math.min(3, recommendations.length); i++) {
        if (recommendations[i].score >= recommendations[0].score * 0.9) {
          recommendations[i].isTopChoice = true;
        }
      }
    }
    
    return recommendations;
  }
  
  /**
   * Get intelligent player recommendations for bowling
   */
  static getBowlingRecommendations(
    availablePlayers: Player[],
    context: RecommendationContext,
    match?: Match
  ): PlayerRecommendation[] {
    const recommendations: PlayerRecommendation[] = [];
    
    availablePlayers.forEach(player => {
      const score = this.calculateBowlingScore(player, context, match);
      const reasons = this.getBowlingReasons(player, context, match);
      const badge = this.getBadgeForScore(score);
      
      recommendations.push({
        player,
        score,
        reasons,
        badge,
        isTopChoice: false
      });
    });
    
    // Sort by score and mark top choices
    recommendations.sort((a, b) => b.score - a.score);
    if (recommendations.length > 0) {
      recommendations[0].isTopChoice = true;
      // Mark additional top choices if scores are close
      for (let i = 1; i < Math.min(3, recommendations.length); i++) {
        if (recommendations[i].score >= recommendations[0].score * 0.9) {
          recommendations[i].isTopChoice = true;
        }
      }
    }
    
    return recommendations;
  }
  
  /**
   * Get intelligent player recommendations for fielding positions
   */
  static getFieldingRecommendations(
    availablePlayers: Player[],
    context: RecommendationContext,
    match?: Match
  ): PlayerRecommendation[] {
    const recommendations: PlayerRecommendation[] = [];
    
    availablePlayers.forEach(player => {
      const score = this.calculateFieldingScore(player, context, match);
      const reasons = this.getFieldingReasons(player, context, match);
      const badge = this.getBadgeForScore(score);
      
      recommendations.push({
        player,
        score,
        reasons,
        badge,
        isTopChoice: false
      });
    });
    
    // Sort by score and mark top choices
    recommendations.sort((a, b) => b.score - a.score);
    if (recommendations.length > 0) {
      recommendations[0].isTopChoice = true;
      // Mark additional top choices if scores are close
      for (let i = 1; i < Math.min(3, recommendations.length); i++) {
        if (recommendations[i].score >= recommendations[0].score * 0.9) {
          recommendations[i].isTopChoice = true;
        }
      }
    }
    
    return recommendations;
  }
  
  /**
   * Calculate batting score based on player stats and context
   */
  private static calculateBattingScore(
    player: Player,
    context: RecommendationContext,
    match?: Match
  ): number {
    let score = 0;
    const stats = player.stats;
    
    // Base score from runs and average
    score += stats.runsScored * 0.1;
    const average = stats.timesOut > 0 ? stats.runsScored / stats.timesOut : stats.runsScored;
    score += average * 2;
    
    // Strike rate considerations
    const strikeRate = stats.ballsFaced > 0 ? (stats.runsScored / stats.ballsFaced) * 100 : 100;
    
    switch (context.situation) {
      case 'opening':
        // Openers need consistency and ability to see off new ball
        score += average * 3;
        if (strikeRate >= 120) score += 20;
        if (stats.fifties > 0) score += 15;
        if (stats.hundreds > 0) score += 25;
        break;
        
      case 'middle_order':
        // Middle order needs adaptability
        score += average * 2;
        score += strikeRate * 0.2;
        if (stats.fours + stats.sixes > 10) score += 15;
        break;
        
      case 'death_overs':
        // Death overs need power hitters
        score += strikeRate * 0.4;
        score += stats.sixes * 3;
        score += stats.fours * 1.5;
        if (strikeRate >= 150) score += 30;
        break;
        
      case 'chase':
        // Chasing needs calm finishers
        if (context.requiredRunRate) {
          if (strikeRate >= context.requiredRunRate * 6) score += 25;
        }
        score += average * 2.5;
        if (stats.matchesPlayed > 5) score += 10; // Experience bonus
        break;
    }
    
    // Penalize for ducks and low scores
    if (stats.ducks > 0) score -= stats.ducks * 5;
    
    // Experience bonus
    if (stats.matchesPlayed > 0) {
      score += Math.min(stats.matchesPlayed * 2, 20);
    } else {
      score += 10; // Give new players a chance
    }
    
    // Recent form bonus (if match data available)
    if (match) {
      const recentPerformance = this.getRecentBattingForm(player, match);
      score += recentPerformance;
    }
    
    return Math.max(score, 0);
  }
  
  /**
   * Calculate bowling score based on player stats and context
   */
  private static calculateBowlingScore(
    player: Player,
    context: RecommendationContext,
    match?: Match
  ): number {
    let score = 0;
    const stats = player.stats;
    
    // Base score from wickets and bowling stats
    score += stats.wicketsTaken * 8;
    
    const economyRate = stats.ballsBowled > 0 ? (stats.runsConceded / stats.ballsBowled) * 6 : 6;
    const bowlingAverage = stats.wicketsTaken > 0 ? stats.runsConceded / stats.wicketsTaken : 30;
    
    // Economy rate scoring (lower is better)
    if (economyRate <= 4) score += 30;
    else if (economyRate <= 6) score += 20;
    else if (economyRate <= 8) score += 10;
    else score -= 10;
    
    // Bowling average scoring (lower is better)
    if (bowlingAverage <= 15) score += 25;
    else if (bowlingAverage <= 20) score += 15;
    else if (bowlingAverage <= 25) score += 10;
    
    switch (context.situation) {
      case 'opening':
        // Opening bowlers need accuracy
        score += stats.maidenOvers * 5;
        if (economyRate <= 5) score += 20;
        break;
        
      case 'middle_order':
        // Middle overs need wicket takers
        score += stats.wicketsTaken * 5;
        if (stats.wicketsTaken >= 10) score += 25;
        break;
        
      case 'death_overs':
        // Death bowlers need tight economy
        if (economyRate <= 6) score += 35;
        if (economyRate <= 4) score += 20; // Additional bonus
        score += stats.wicketsTaken * 3; // Wickets still matter
        break;
        
      case 'power_play':
        // Powerplay needs wicket takers
        score += stats.wicketsTaken * 6;
        if (economyRate <= 6) score += 15;
        break;
    }
    
    // Experience bonus
    if (stats.matchesPlayed > 0) {
      score += Math.min(stats.matchesPlayed * 1.5, 15);
    } else {
      score += 8; // Give new players a chance
    }
    
    // Recent form bonus
    if (match) {
      const recentPerformance = this.getRecentBowlingForm(player, match);
      score += recentPerformance;
    }
    
    return Math.max(score, 0);
  }
  
  /**
   * Calculate fielding score based on player stats and context
   */
  private static calculateFieldingScore(
    player: Player,
    context: RecommendationContext,
    match?: Match
  ): number {
    let score = 0;
    const stats = player.stats;
    
    // Base fielding stats
    score += stats.catches * 8;
    score += stats.runOuts * 12;
    
    if (context.role === 'wicketkeeper') {
      // For wicketkeeper recommendations
      const stumpingScore = stats.catches * 0.5; // Assume some catches are keeper catches
      score += stumpingScore * 10;
      score += 20; // Base wicketkeeper bonus
    }
    
    // Experience in fielding
    if (stats.matchesPlayed > 0) {
      score += Math.min(stats.matchesPlayed * 1, 10);
    } else {
      score += 5; // Give new players a chance
    }
    
    // Athletic players (good batting/bowling indicates fitness)
    const athleticScore = (stats.runsScored * 0.01) + (stats.wicketsTaken * 2);
    score += Math.min(athleticScore, 15);
    
    return Math.max(score, 0);
  }
  
  /**
   * Get batting recommendation reasons
   */
  private static getBattingReasons(
    player: Player,
    context: RecommendationContext,
    match?: Match
  ): string[] {
    const reasons: string[] = [];
    const stats = player.stats;
    
    // Basic stats reasons
    if (stats.runsScored > 100) {
      reasons.push(`${stats.runsScored} total runs scored`);
    }
    
    const average = stats.timesOut > 0 ? stats.runsScored / stats.timesOut : stats.runsScored;
    if (average >= 30) reasons.push(`Excellent average (${average.toFixed(1)})`);
    else if (average >= 20) reasons.push(`Good average (${average.toFixed(1)})`);
    
    const strikeRate = stats.ballsFaced > 0 ? (stats.runsScored / stats.ballsFaced) * 100 : 100;
    if (strikeRate >= 150) reasons.push(`Explosive strike rate (${strikeRate.toFixed(1)})`);
    else if (strikeRate >= 120) reasons.push(`Good strike rate (${strikeRate.toFixed(1)})`);
    
    // Milestone achievements
    if (stats.hundreds > 0) reasons.push(`${stats.hundreds} century/centuries`);
    if (stats.fifties > 0) reasons.push(`${stats.fifties} fifty/fifties`);
    if (stats.sixes > 5) reasons.push(`Power hitter (${stats.sixes} sixes)`);
    if (stats.fours > 10) reasons.push(`Boundary scorer (${stats.fours} fours)`);
    
    // Situation-specific reasons
    switch (context.situation) {
      case 'opening':
        if (stats.matchesPlayed > 5) reasons.push('Experienced opener');
        if (stats.ducks === 0) reasons.push('Never got out for duck');
        break;
      case 'death_overs':
        if (strikeRate >= 140) reasons.push('Perfect for death overs');
        if (stats.sixes >= 3) reasons.push('Can clear the boundary');
        break;
      case 'chase':
        if (average >= 25) reasons.push('Reliable under pressure');
        break;
    }
    
    // Experience
    if (stats.matchesPlayed > 10) reasons.push('Highly experienced');
    else if (stats.matchesPlayed > 5) reasons.push('Good experience');
    else if (stats.matchesPlayed === 0) reasons.push('Fresh talent - worth a try');
    
    // Form and consistency
    if (stats.ducks === 0 && stats.matchesPlayed > 0) {
      reasons.push('Consistent performer');
    }
    
    if (reasons.length === 0) {
      reasons.push('Available for selection');
    }
    
    return reasons.slice(0, 4); // Limit to 4 reasons
  }
  
  /**
   * Get bowling recommendation reasons
   */
  private static getBowlingReasons(
    player: Player,
    context: RecommendationContext,
    match?: Match
  ): string[] {
    const reasons: string[] = [];
    const stats = player.stats;
    
    // Basic bowling stats
    if (stats.wicketsTaken > 5) {
      reasons.push(`${stats.wicketsTaken} wickets taken`);
    }
    
    const economyRate = stats.ballsBowled > 0 ? (stats.runsConceded / stats.ballsBowled) * 6 : 6;
    if (economyRate <= 4) reasons.push(`Excellent economy (${economyRate.toFixed(1)})`);
    else if (economyRate <= 6) reasons.push(`Good economy (${economyRate.toFixed(1)})`);
    else if (economyRate <= 8) reasons.push(`Decent economy (${economyRate.toFixed(1)})`);
    
    const bowlingAverage = stats.wicketsTaken > 0 ? stats.runsConceded / stats.wicketsTaken : 30;
    if (bowlingAverage <= 15) reasons.push(`Excellent average (${bowlingAverage.toFixed(1)})`);
    else if (bowlingAverage <= 20) reasons.push(`Good average (${bowlingAverage.toFixed(1)})`);
    
    // Special achievements
    if (stats.maidenOvers > 0) reasons.push(`${stats.maidenOvers} maiden overs`);
    if (stats.bestBowlingFigures !== '0/0') reasons.push(`Best: ${stats.bestBowlingFigures}`);
    
    // Situation-specific reasons
    switch (context.situation) {
      case 'opening':
        if (economyRate <= 5) reasons.push('Perfect for new ball');
        if (stats.maidenOvers > 0) reasons.push('Can build pressure');
        break;
      case 'death_overs':
        if (economyRate <= 6) reasons.push('Reliable in death overs');
        if (stats.wicketsTaken > 3) reasons.push('Can take crucial wickets');
        break;
      case 'middle_order':
        if (stats.wicketsTaken >= 5) reasons.push('Wicket-taking bowler');
        break;
    }
    
    // Experience
    if (stats.matchesPlayed > 10) reasons.push('Very experienced bowler');
    else if (stats.matchesPlayed > 5) reasons.push('Good bowling experience');
    else if (stats.matchesPlayed === 0) reasons.push('New bowler - could surprise');
    
    if (reasons.length === 0) {
      reasons.push('Available to bowl');
    }
    
    return reasons.slice(0, 4); // Limit to 4 reasons
  }
  
  /**
   * Get fielding recommendation reasons
   */
  private static getFieldingReasons(
    player: Player,
    context: RecommendationContext,
    match?: Match
  ): string[] {
    const reasons: string[] = [];
    const stats = player.stats;
    
    if (stats.catches > 0) reasons.push(`${stats.catches} catches taken`);
    if (stats.runOuts > 0) reasons.push(`${stats.runOuts} run outs`);
    
    if (context.role === 'wicketkeeper') {
      reasons.push('Can keep wickets');
      if (stats.catches > 2) reasons.push('Experienced keeper');
    }
    
    // Athletic indicators
    if (stats.runsScored > 50 || stats.wicketsTaken > 2) {
      reasons.push('Athletic and agile');
    }
    
    if (stats.matchesPlayed > 5) {
      reasons.push('Experienced fielder');
    }
    
    if (reasons.length === 0) {
      reasons.push('Ready to field');
    }
    
    return reasons.slice(0, 3); // Limit to 3 reasons
  }
  
  /**
   * Get badge based on recommendation score
   */
  private static getBadgeForScore(score: number): 'excellent' | 'good' | 'average' | 'backup' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'backup';
  }
  
  /**
   * Get recent batting form (placeholder for future implementation)
   */
  private static getRecentBattingForm(player: Player, match: Match): number {
    // TODO: Implement based on recent matches
    return 0;
  }
  
  /**
   * Get recent bowling form (placeholder for future implementation)
   */
  private static getRecentBowlingForm(player: Player, match: Match): number {
    // TODO: Implement based on recent matches
    return 0;
  }
  
  /**
   * Get contextual recommendations based on match situation
   */
  static getContextualRecommendations(
    availablePlayers: Player[],
    role: 'batting' | 'bowling' | 'fielding',
    match?: Match
  ): RecommendationContext {
    const context: RecommendationContext = {
      role: role as any,
      situation: 'middle_order' // Default
    };
    
    if (!match) return context;
    
    // Determine situation based on match state
    if (role === 'batting') {
      if (match.battingTeam.wickets === 0) {
        context.situation = 'opening';
      } else if (match.battingTeam.overs >= match.totalOvers - 5) {
        context.situation = 'death_overs';
      } else if (match.isSecondInnings && match.firstInningsScore) {
        context.situation = 'chase';
        context.targetScore = match.firstInningsScore;
        context.teamScore = match.battingTeam.score;
        const ballsRemaining = (match.totalOvers * 6) - (match.battingTeam.overs * 6 + match.battingTeam.balls);
        const runsNeeded = match.firstInningsScore - match.battingTeam.score + 1;
        context.requiredRunRate = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 0;
      } else {
        context.situation = 'middle_order';
      }
    } else if (role === 'bowling') {
      if (match.battingTeam.overs <= 6) {
        context.situation = 'power_play';
      } else if (match.battingTeam.overs >= match.totalOvers - 5) {
        context.situation = 'death_overs';
      } else if (match.battingTeam.overs === 0) {
        context.situation = 'opening';
      } else {
        context.situation = 'middle_order';
      }
    }
    
    return context;
  }
} 