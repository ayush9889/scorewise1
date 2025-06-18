import React, { useState, useEffect } from 'react';
import { User, Group } from '../types/auth';
import { Match } from '../types/cricket';
import { authService } from '../services/authService';
import { 
  User as UserIcon, 
  TrendingUp, 
  Star, 
  Target, 
  Clock, 
  Download, 
  Settings, 
  Phone, 
  Mail, 
  Calendar, 
  Trophy, 
  Award, 
  BarChart3, 
  Users as UsersIcon, 
  Gamepad2, 
  ArrowLeft 
} from 'lucide-react';

interface UserProfileData {
  user: User;
  groups: Group[];
  matches: Match[];
  recentActivity: any[];
}

interface UserProfileDashboardProps {
  onBack?: () => void;
}

const UserProfileDashboard: React.FC<UserProfileDashboardProps> = ({ onBack }) => {
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'groups' | 'matches' | 'settings'>('overview');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await authService.getUserCricketProfile();
      if (data) {
        setProfileData(data);
        console.log('🏏 Complete user profile loaded:', data);
      } else {
        setError('Failed to load user profile');
      }
    } catch (error) {
      console.error('❌ Failed to load user profile:', error);
      setError('Failed to load user profile data');
    } finally {
      setLoading(false);
    }
  };

  const exportUserData = async () => {
    try {
      const exportData = await authService.exportUserData();
      if (exportData) {
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scorewise-data-${profileData?.user.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Your complete cricket data has been exported successfully! 📊');
      }
    } catch (error) {
      console.error('❌ Failed to export user data:', error);
      alert('Failed to export user data. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600"></div>
            <span className="ml-4 text-lg text-gray-600">Loading your cricket profile...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-500 text-xl mb-2">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Profile Load Error</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadUserProfile}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user, groups, matches, recentActivity } = profileData;
  const stats = user.statistics;

  const tabButtons = [
    { id: 'overview', label: 'Overview', icon: UserIcon },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
    { id: 'groups', label: 'Groups', icon: UsersIcon },
    { id: 'matches', label: 'Matches', icon: Gamepad2 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}
            <div className="flex-1"></div>
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{user.profile.displayName || user.name}</h1>
                <div className="flex items-center space-x-4 text-gray-600 mt-1">
                  {user.email && (
                    <div className="flex items-center space-x-1">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>
                  )}
                  {user.phone && (
                    <div className="flex items-center space-x-1">
                      <Phone className="h-4 w-4" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={exportUserData}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalMatches}</div>
              <div className="text-sm text-blue-500">Total Matches</div>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalRuns}</div>
              <div className="text-sm text-green-500">Total Runs</div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalWickets}</div>
              <div className="text-sm text-purple-500">Total Wickets</div>
            </div>
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{groups.length}</div>
              <div className="text-sm text-orange-500">Active Groups</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {tabButtons.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Career Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center">
                      <Trophy className="h-5 w-5 mr-2" />
                      Career Highlights
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Win Rate:</span>
                        <span className="font-semibold text-emerald-800">
                          {stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Batting Average:</span>
                        <span className="font-semibold text-emerald-800">{stats.battingAverage.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Strike Rate:</span>
                        <span className="font-semibold text-emerald-800">{stats.strikeRate.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Bowling Economy:</span>
                        <span className="font-semibold text-emerald-800">{stats.economyRate.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                      <Award className="h-5 w-5 mr-2" />
                      Achievements
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-blue-600">Centuries:</span>
                        <span className="font-semibold text-blue-800">{stats.centuries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Half Centuries:</span>
                        <span className="font-semibold text-blue-800">{stats.halfCenturies}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Best Bowling:</span>
                        <span className="font-semibold text-blue-800">{stats.bestBowlingFigures}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">MOTM Awards:</span>
                        <span className="font-semibold text-blue-800">{stats.manOfTheMatchAwards}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Recent Activity
                  </h3>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.slice(0, 5).map((activity, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600">{activity.description}</div>
                          <div className="text-xs text-gray-400">{activity.date}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No recent activity</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* Batting Stats */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Batting Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.totalRuns}</div>
                      <div className="text-sm text-green-500">Total Runs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.battingAverage.toFixed(2)}</div>
                      <div className="text-sm text-green-500">Average</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.strikeRate.toFixed(2)}</div>
                      <div className="text-sm text-green-500">Strike Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.boundaries}</div>
                      <div className="text-sm text-green-500">Boundaries</div>
                    </div>
                  </div>
                </div>

                {/* Bowling Stats */}
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Bowling Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.totalWickets}</div>
                      <div className="text-sm text-purple-500">Total Wickets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.economyRate.toFixed(2)}</div>
                      <div className="text-sm text-purple-500">Economy Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.maidenOvers}</div>
                      <div className="text-sm text-purple-500">Maiden Overs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{stats.bestBowlingFigures}</div>
                      <div className="text-sm text-purple-500">Best Figures</div>
                    </div>
                  </div>
                </div>

                {/* Fielding Stats */}
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
                    <Star className="h-5 w-5 mr-2" />
                    Fielding Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.catches}</div>
                      <div className="text-sm text-orange-500">Catches</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.runOuts}</div>
                      <div className="text-sm text-orange-500">Run Outs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.stumpings}</div>
                      <div className="text-sm text-orange-500">Stumpings</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Groups</h3>
                {groups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groups.map((group) => (
                      <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800">{group.name}</h4>
                        <p className="text-sm text-gray-600">{group.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded">
                            {group.ownerId === user.id ? 'Owner' : 'Member'}
                          </span>
                          <span className="text-xs text-gray-500">{group.memberIds.length} members</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">You haven't joined any groups yet.</p>
                )}
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Match History</h3>
                {matches.length > 0 ? (
                  <div className="space-y-3">
                    {matches.slice(0, 10).map((match) => (
                      <div key={match.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {match.teams.team1.name} vs {match.teams.team2.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {new Date(match.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded text-xs ${
                              match.status === 'completed' ? 'bg-green-100 text-green-600' :
                              match.status === 'in-progress' ? 'bg-blue-100 text-blue-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {match.status}
                            </span>
                          </div>
                        </div>
                        {match.result && (
                          <p className="text-sm text-gray-600 mt-2">{match.result}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No matches played yet.</p>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                      <div className="text-gray-900">{user.profile.displayName || user.name}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <div className="text-gray-900">{user.email || 'Not provided'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <div className="text-gray-900">{user.phone || 'Not provided'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Playing Role</label>
                      <div className="text-gray-900">{user.profile.playingRole || 'Not specified'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Cricket Profile</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Batting Style</label>
                      <div className="text-gray-900">{user.profile.battingStyle || 'Not specified'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bowling Style</label>
                      <div className="text-gray-900">{user.profile.bowlingStyle || 'Not specified'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Favorite Team</label>
                      <div className="text-gray-900">{user.profile.favoriteTeam || 'Not specified'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <div className="text-gray-900">{user.profile.location || 'Not specified'}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Theme</span>
                      <span className="text-gray-500">{user.preferences.theme}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Language</span>
                      <span className="text-gray-500">{user.preferences.language}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Timezone</span>
                      <span className="text-gray-500">{user.preferences.timezone}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileDashboard; 