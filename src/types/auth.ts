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