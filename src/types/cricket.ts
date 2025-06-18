export interface Player {
  id: string;
  name: string;
  shortId?: string;
  photoUrl?: string;
  isGroupMember: boolean;
  isGuest?: boolean;
  groupIds?: string[]; // Support for multiple groups
  stats: PlayerStats;
}

export interface PlayerStats {
  matchesPlayed: number;
  runsScored: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highestScore: number;
  timesOut: number;
  wicketsTaken: number;
  ballsBowled: number;
  runsConceded: number;
  catches: number;
  runOuts: number;
  motmAwards: number;
  ducks: number;
  dotBalls: number;
  maidenOvers: number;
  bestBowlingFigures: string;
}

export interface FallOfWicket {
  wicketNumber: number;
  score: number;
  batsman: string;
  over: string;
  bowler: string;
  wicketType: string;
}

export interface Team {
  name: string;
  players: Player[];
  score: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: {
    byes: number;
    legByes: number;
    wides: number;
    noBalls: number;
  };
  fallOfWickets?: FallOfWicket[];
}

export interface Ball {
  id: string;
  ballNumber: number;
  overNumber: number;
  bowler: Player;
  striker: Player;
  nonStriker: Player;
  runs: number;
  isWide: boolean;
  isNoBall: boolean;
  isBye: boolean;
  isLegBye: boolean;
  isWicket: boolean;
  wicketType?: WicketType;
  fielder?: Player;
  commentary: string;
  timestamp: number;
  innings?: number; // Track which innings this ball belongs to
  battingTeamId?: string; // Track which team was batting
}

export type WicketType = 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket';

export interface Match {
  id: string;
  team1: Team;
  team2: Team;
  tossWinner: string;
  tossDecision: 'bat' | 'bowl';
  currentInnings: 1 | 2;
  battingTeam: Team;
  bowlingTeam: Team;
  totalOvers: number;
  balls: Ball[];
  isCompleted: boolean;
  isSecondInnings?: boolean;
  firstInningsScore?: number;
  winner?: string;
  resultMargin?: string; // e.g., "5 wickets", "23 runs"
  manOfTheMatch?: Player;
  startTime: number;
  endTime?: number;
  currentStriker?: Player;
  currentNonStriker?: Player;
  currentBowler?: Player;
  previousBowler?: Player;
  groupId?: string; // Associate match with a group
  isStandalone?: boolean; // Mark standalone matches
}

export interface MatchFormat {
  name: string;
  overs: number;
  maxOverPerBowler: number;
}

export const MATCH_FORMATS: MatchFormat[] = [
  { name: 'T20', overs: 20, maxOverPerBowler: 4 },
  { name: 'T10', overs: 10, maxOverPerBowler: 3 },
  { name: '5 Overs', overs: 5, maxOverPerBowler: 2 },
  { name: 'Custom', overs: 0, maxOverPerBowler: 0 }
];

export interface ScoringAction {
  type: 'run' | 'wicket' | 'extra' | 'over_complete' | 'innings_complete' | 'match_complete';
  data: any;
}

export interface PlayerPerformance {
  playerId: string;
  battingScore: number;
  bowlingScore: number;
  fieldingScore: number;
  totalScore: number;
  runsScored: number;
  ballsFaced: number;
  wicketsTaken: number;
  catches: number;
  runOuts: number;
}