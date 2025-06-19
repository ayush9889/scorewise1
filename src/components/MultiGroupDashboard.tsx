import React, { useState, useEffect } from 'react';
import { Users, Plus, Trophy, Target, TrendingUp, BarChart3, Settings, UserPlus, Crown, Clock, Activity, Share2, Calendar, Zap, Sparkles, ExternalLink, QrCode, Copy, MessageSquare } from 'lucide-react';
import { Group, User } from '../types/auth';
import { Player, Match } from '../types/cricket';
import { authService } from '../services/authService';
import { storageService } from '../services/storage';
import { GroupSelector } from './GroupSelector';
import GroupShareModal from './GroupShareModal';

interface MultiGroupDashboardProps {
  onNavigate: (destination: string) => void;
  onBack: () => void;
}

interface GroupOverview {
  group: Group;
  memberCount: number;
  playerCount: number;
  matchCount: number;
  recentMatches: Match[];
  userRole: string;
}

export const MultiGroupDashboard: React.FC<MultiGroupDashboardProps> = ({
  onNavigate,
  onBack
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [groupOverviews, setGroupOverviews] = useState<GroupOverview[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalGroups: 0,
    totalMembers: 0,
    totalMatches: 0,
    adminGroups: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const user = authService.getCurrentUser();
      setCurrentUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      // Load user's groups
      await authService.loadUserGroups();
      const groups = authService.getUserGroups();
      setUserGroups(groups);

      // Set current group (first group or currently selected)
      const current = authService.getCurrentGroup() || groups[0] || null;
      setCurrentGroup(current);

      // Load overview for each group
      const overviews = await Promise.all(
        groups.map(async (group) => {
          const members = await authService.getGroupMembers(group.id);
          const players = await storageService.getGroupPlayers(group.id);
          const matches = await storageService.getGroupMatches(group.id);
          const userMember = group.members.find(m => m.userId === user.id);

          return {
            group,
            memberCount: members.length,
            playerCount: players.length,
            matchCount: matches.length,
            recentMatches: matches.slice(-3).reverse(),
            userRole: userMember?.role || 'member'
          };
        })
      );

      setGroupOverviews(overviews);

      // Calculate total stats
      setTotalStats({
        totalGroups: groups.length,
        totalMembers: overviews.reduce((sum, overview) => sum + overview.memberCount, 0),
        totalMatches: overviews.reduce((sum, overview) => sum + overview.matchCount, 0),
        adminGroups: overviews.filter(overview => overview.userRole === 'admin').length
      });

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSelect = async (group: Group) => {
    setCurrentGroup(group);
    authService.setCurrentGroup(group);
    // Optionally reload current group data
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const group = await authService.createGroup(groupName.trim(), groupDescription.trim());
      await loadDashboardData(); // Refresh data
      setShowCreateModal(false);
      setGroupName('');
      setGroupDescription('');
      setCurrentGroup(group); // Switch to new group
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      console.log('🤝 Attempting to join group with code:', inviteCode.trim().toUpperCase());
      const group = await authService.joinGroup(inviteCode.trim());
      await loadDashboardData(); // Refresh data
      setShowJoinModal(false);
      setInviteCode('');
      setCurrentGroup(group); // Switch to joined group
      console.log('✅ Successfully joined group:', group.name);
    } catch (err) {
      console.error('❌ Failed to join group:', err);
      
      // Enhanced error handling with helpful suggestions
      let errorMessage = err instanceof Error ? err.message : 'Failed to join group';
      
      // If it's an invite code issue, add helpful troubleshooting info
      if (errorMessage.includes('Invalid invite code')) {
        errorMessage = `${errorMessage}

🔧 Quick Fixes to Try:
1. Copy the invite code again (ensure all 6 characters)
2. Refresh this page and try again
3. Ask the group admin to share the code again

💡 Advanced Troubleshooting:
• Open browser console (F12) and run: troubleshootInviteCode("${inviteCode.trim().toUpperCase()}")
• This will automatically diagnose and attempt to fix the issue`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your groups...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to access your groups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-green-600 hover:text-green-700 font-semibold"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cricket Groups</h1>
                <p className="text-gray-600">Manage your cricket communities</p>
              </div>
            </div>

            {/* Group Selector */}
            <div className="w-80">
              <GroupSelector
                currentGroup={currentGroup}
                onGroupSelect={handleGroupSelect}
                onCreateGroup={() => setShowCreateModal(true)}
                onJoinGroup={() => setShowJoinModal(true)}
                onManageGroup={() => onNavigate('group-management')}
                showManagement={true}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalStats.totalGroups}</div>
                <div className="text-sm text-gray-600">Total Groups</div>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalStats.adminGroups}</div>
                <div className="text-sm text-gray-600">Groups You Admin</div>
              </div>
              <Crown className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalStats.totalMembers}</div>
                <div className="text-sm text-gray-600">Total Players</div>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalStats.totalMatches}</div>
                <div className="text-sm text-gray-600">Total Matches</div>
              </div>
              <Trophy className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Current Group Focus */}
        {currentGroup && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {currentGroup.name} Dashboard
                </h2>
                <p className="text-gray-600">Your active group overview</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  View Dashboard
                </button>
                <button
                  onClick={() => onNavigate('match-setup')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  New Match
                </button>
              </div>
            </div>

            {/* Current Group Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {groupOverviews
                .filter(overview => overview.group.id === currentGroup.id)
                .map(overview => (
                  <React.Fragment key={overview.group.id}>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-xl font-bold text-gray-900">{overview.memberCount}</div>
                      <div className="text-sm text-gray-600">Players</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-xl font-bold text-gray-900">{overview.playerCount}</div>
                      <div className="text-sm text-gray-600">Active Players</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-xl font-bold text-gray-900">{overview.matchCount}</div>
                      <div className="text-sm text-gray-600">Matches</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-xl font-bold text-gray-900 capitalize">{overview.userRole}</div>
                      <div className="text-sm text-gray-600">Your Role</div>
                    </div>
                  </React.Fragment>
                ))}
            </div>
          </div>
        )}

        {/* All Groups Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">All Your Groups</h2>
            <div className="flex space-x-3">
              {currentGroup && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center space-x-2 shadow-lg"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Current Group</span>
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group</span>
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Join Group</span>
              </button>
            </div>
          </div>

          {groupOverviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupOverviews.map((overview) => (
                <div
                  key={overview.group.id}
                  className={`border rounded-xl p-6 cursor-pointer transition-all hover:shadow-md ${
                    currentGroup?.id === overview.group.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleGroupSelect(overview.group)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{overview.group.name}</h3>
                    <div className="flex items-center space-x-2">
                      {overview.userRole === 'admin' && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                      {currentGroup?.id === overview.group.id && (
                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Active
                        </div>
                      )}
                    </div>
                  </div>

                  {overview.group.description && (
                    <p className="text-sm text-gray-600 mb-4">{overview.group.description}</p>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{overview.playerCount}</div>
                      <div className="text-xs text-gray-600">Players</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{overview.matchCount}</div>
                      <div className="text-xs text-gray-600">Matches</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{overview.recentMatches.length}</div>
                      <div className="text-xs text-gray-600">Recent</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Role: <span className="capitalize font-medium">{overview.userRole}</span>
                    </span>
                    <span className="text-gray-500">
                      Code: <span className="font-mono">{overview.group.inviteCode}</span>
                    </span>
                  </div>

                  {overview.recentMatches.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">Recent Activity</div>
                      <div className="space-y-1">
                        {overview.recentMatches.slice(0, 2).map((match) => (
                          <div key={match.id} className="text-xs text-gray-600 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {match.team1.name} vs {match.team2.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Groups Yet</h3>
              <p className="text-gray-600 mb-6">Create your first group or join an existing one to get started</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Group
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Join Group
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Group</h2>
            </div>
            <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter group name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your cricket group"
                  rows={3}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setGroupName('');
                    setGroupDescription('');
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Join Group</h2>
            </div>
            <form onSubmit={handleJoinGroup} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invite Code *</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                  placeholder="Enter 6-character invite code"
                  maxLength={6}
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Joining...' : 'Join Group'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setInviteCode('');
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Share Modal */}
      {showShareModal && currentGroup && (
        <GroupShareModal
          group={currentGroup}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};