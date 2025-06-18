export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  isVerified: boolean;
  isGuest?: boolean; // For guest mode users
  createdAt: number;
  lastLoginAt: number;
  groupIds?: string[]; // Support for multiple groups
  
  // Enhanced User Profile Data
  profile: UserProfile;
  statistics: UserStatistics;
  preferences: UserPreferences;
  socialProfile: UserSocialProfile;
}

export interface UserProfile {
  displayName?: string;
  bio?: string;
  location?: string;
  favoriteTeam?: string;
  playingRole: 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper' | 'captain' | 'none';
  battingStyle: 'right-hand' | 'left-hand' | 'unknown';
  bowlingStyle: 'right-arm-fast' | 'left-arm-fast' | 'right-arm-medium' | 'left-arm-medium' | 'right-arm-spin' | 'left-arm-spin' | 'none';
  dateOfBirth?: number;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface UserStatistics {
  // Career Statistics
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  
  // Batting Statistics
  totalRuns: number;
  totalBallsFaced: number;
  highestScore: number;
  battingAverage: number;
  strikeRate: number;
  centuries: number;
  halfCenturies: number;
  fours: number;
  sixes: number;
  ducks: number;
  
  // Bowling Statistics
  totalWickets: number;
  totalBallsBowled: number;
  totalRunsConceded: number;
  bestBowlingFigures: string;
  bowlingAverage: number;
  economyRate: number;
  maidenOvers: number;
  fiveWicketHauls: number;
  
  // Fielding Statistics
  catches: number;
  runOuts: number;
  stumpings: number;
  
  // Awards and Achievements
  manOfTheMatchAwards: number;
  manOfTheSeriesAwards: number;
  achievements: Achievement[];
  
  // Match History
  recentMatches: string[]; // Match IDs
  favoriteGroups: string[]; // Group IDs
  
  // Performance Trends
  lastUpdated: number;
  performanceRating: number; // 0-100 overall rating
  consistency: number; // Performance consistency metric
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'batting' | 'bowling' | 'fielding' | 'team' | 'milestone';
  achievedAt: number;
  matchId?: string;
  groupId?: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  matchSettings: MatchPreferences;
}

export interface NotificationSettings {
  matchInvites: boolean;
  groupUpdates: boolean;
  achievements: boolean;
  weeklyStats: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  statsVisibility: 'public' | 'friends' | 'private';
  contactVisibility: 'public' | 'friends' | 'private';
  allowGroupInvites: boolean;
  allowFriendRequests: boolean;
}

export interface MatchPreferences {
  defaultFormat: string;
  preferredRole: 'batting' | 'bowling' | 'any';
  autoSaveFrequency: number; // minutes
  scoringShortcuts: boolean;
  soundEffects: boolean;
  vibration: boolean;
}

export interface UserSocialProfile {
  friends: string[]; // User IDs
  followedUsers: string[]; // User IDs
  followers: string[]; // User IDs
  blockedUsers: string[]; // User IDs
  socialLinks: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
    youtube?: string;
  };
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  members: GroupMember[];
  isPublic: boolean;
  inviteCode: string;
  settings: GroupSettings;
}

export interface GroupMember {
  userId: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: number;
  isActive: boolean;
  permissions: GroupPermissions;
}

export interface GroupPermissions {
  canCreateMatches: boolean;
  canScoreMatches: boolean;
  canManageMembers: boolean;
  canViewStats: boolean;
}

export interface GroupSettings {
  allowPublicJoin: boolean;
  requireApproval: boolean;
  allowGuestScoring: boolean;
  defaultMatchFormat: string;
}

export interface Invitation {
  id: string;
  groupId: string;
  invitedBy: string;
  invitedEmail?: string;
  invitedPhone?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: number;
  expiresAt: number;
}