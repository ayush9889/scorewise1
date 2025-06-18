import React, { useState, useEffect } from 'react';
import { ArrowLeft, Crown, Users, Trophy, Settings, Mail, Phone, Calendar, Award, TrendingUp, Target } from 'lucide-react';
import { User, Group } from '../types/auth';
import { Player, Match } from '../types/cricket';
import { authService } from '../services/authService';
import { storageService } from '../services/storage';
import { CricketEngine } from '../services/cricketEngine';

interface AdminDashboardProps {
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupPlayers, setGroupPlayers] = useState<Player[]>([]);
  const [groupMatches, setGroupMatches] = useState<Match[]>([]);
  const [personalStats, setPersonalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'personal' | 'settings'>('overview');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const user = authService.getCurrentUser();
      if (!user) return;

      setCurrentUser(user);
      
      // Load user's groups
      await authService.loadUserGroups();
      const groups = authService.getUserGroups();
      setUserGroups(groups);
      
      if (groups.length > 0) {
        const primaryGroup = groups[0];
        setSelectedGroup(primaryGroup);
        await loadGroupData(primaryGroup);
      }
      
      // Load personal stats
      await loadPersonalStats(user);
      
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async (group: Group) => {
    try {
      // Load group members
      const members = await authService.getGroupMembers(group.id);
      setGroupMembers(members);
      
      // Load group players
      const allPlayers = await storageService.getAllPlayers();
      const groupPlayers = allPlayers.filter(p => p.isGroupMember);
      setGroupPlayers(groupPlayers);
      
      // Load group matches
      const allMatches = await storageService.getAllMatches();
      setGroupMatches(allMatches);
      
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  };

  const loadPersonalStats = async (user: User) => {
    try {
      const allPlayers = await storageService.getAllPlayers();
      const allMatches = await storageService.getAllMatches();
      
      // Find player record for this user (by email matching)
      const userPlayer = allPlayers.find(p => 
        p.name.toLowerCase().includes(user.name.toLowerCase()) ||
        (user.email && p.name.toLowerCase().includes(user.email.split('@')[0].toLowerCase()))
      );
      
      if (userPlayer) {
        const stats = {
          player: userPlayer,
          matchesPlayed: userPlayer.stats.matchesPlayed,
          runsScored: userPlayer.stats.runsScored,
          wicketsTaken: userPlayer.stats.wicketsTaken,
          battingAverage: CricketEngine.calculateBattingAverage(userPlayer.stats),
          strikeRate: CricketEngine.calculateStrikeRate(userPlayer.stats),
          bowlingAverage: CricketEngine.calculateBowlingAverage(userPlayer.stats),
          economyRate: CricketEngine.calculateEconomyRate(userPlayer.stats),
          motmAwards: userPlayer.stats.motmAwards,
          recentMatches: allMatches.filter(m => 
            m.team1.players.some(p => p.id === userPlayer.id) ||
            m.team2.players.some(p => p.id === userPlayer.id)
          ).slice(-5)
        };
        setPersonalStats(stats);
      }
    } catch (error) {
      console.error('Failed to load personal stats:', error);
    }
  };

  const handleGroupSelect = async (group: Group) => {
    setSelectedGroup(group);
    authService.setCurrentGroup(group);
    await loadGroupData(group);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to access admin dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-green-600 hover:text-green-700 font-semibold"
        >
          ← Back to Home
        </button>
        
        <div className="flex items-center space-x-3">
          <Crown className="w-6 h-6 text-yellow-500" />
          <h1 className="font-bold text-xl text-gray-900">Admin Dashboard</h1>
        </div>
        
        <div className="w-16"></div>
      </div>

      {/* User Info Banner */}
      <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            {currentUser.photoUrl ? (
              <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-2xl font-bold">
                {currentUser.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{currentUser.name}</h2>
            <div className="flex items-center space-x-4 text-green-100">
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-1" />
                <span className="text-sm">{currentUser.email}</span>
              </div>
              {currentUser.phone && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-1" />
                  <span className="text-sm">{currentUser.phone}</span>
                </div>
              )}
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span className="text-sm">Joined {new Date(currentUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4">
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Trophy },
            { id: 'groups', label: 'My Groups', icon: Users },
            { id: 'personal', label: 'Personal Stats', icon: Award },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{userGroups.length}</div>
                      <div className="text-sm text-gray-600">Groups Managed</div>
                    </div>
                    <Users className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{groupMembers.length}</div>
                      <div className="text-sm text-gray-600">Total Members</div>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{groupPlayers.length}</div>
                      <div className="text-sm text-gray-600">Active Players</div>
                    </div>
                    <Trophy className="w-8 h-8 text-orange-600" />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{groupMatches.filter(m => m.isCompleted).length}</div>
                      <div className="text-sm text-gray-600">Matches Completed</div>
                    </div>
                    <Target className="w-8 h-8 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Current Group Overview */}
              {selectedGroup && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Group: {selectedGroup.name}</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Group Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Created:</span>
                          <span className="font-medium">{new Date(selectedGroup.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invite Code:</span>
                          <span className="font-mono font-medium">{selectedGroup.inviteCode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Members:</span>
                          <span className="font-medium">{selectedGroup.members.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Your Role:</span>
                          <span className="font-medium capitalize">
                            {selectedGroup.members.find(m => m.userId === currentUser.id)?.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Recent Activity</h4>
                      <div className="space-y-2">
                        {groupMatches.slice(-3).reverse().map((match) => (
                          <div key={match.id} className="text-sm p-2 bg-gray-50 rounded">
                            <div className="font-medium">{match.team1.name} vs {match.team2.name}</div>
                            <div className="text-gray-600">{new Date(match.startTime).toLocaleDateString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">My Groups ({userGroups.length})</h3>
                
                <div className="space-y-4">
                  {userGroups.map((group) => {
                    const userMember = group.members.find(m => m.userId === currentUser.id);
                    const isSelected = selectedGroup?.id === group.id;
                    
                    return (
                      <div
                        key={group.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleGroupSelect(group)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-gray-900">{group.name}</h4>
                              {userMember?.role === 'admin' && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                              {isSelected && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            {group.description && (
                              <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                            )}
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>{group.members.length} members</span>
                              <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                              <span className="capitalize">{userMember?.role}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-gray-600">{group.inviteCode}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="space-y-6">
              {personalStats ? (
                <>
                  {/* Personal Stats Overview */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">My Cricket Statistics</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{personalStats.matchesPlayed}</div>
                        <div className="text-sm text-gray-600">Matches Played</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{personalStats.runsScored}</div>
                        <div className="text-sm text-gray-600">Runs Scored</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{personalStats.wicketsTaken}</div>
                        <div className="text-sm text-gray-600">Wickets Taken</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{personalStats.motmAwards}</div>
                        <div className="text-sm text-gray-600">MOTM Awards</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                          <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                          Batting Stats
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Average:</span>
                            <span className="font-medium">{personalStats.battingAverage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Strike Rate:</span>
                            <span className="font-medium">{personalStats.strikeRate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Highest Score:</span>
                            <span className="font-medium">{personalStats.player.stats.highestScore}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">50s/100s:</span>
                            <span className="font-medium">{personalStats.player.stats.fifties}/{personalStats.player.stats.hundreds}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                          <Target className="w-4 h-4 mr-2 text-red-600" />
                          Bowling Stats
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Average:</span>
                            <span className="font-medium">{personalStats.bowlingAverage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Economy:</span>
                            <span className="font-medium">{personalStats.economyRate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Best Figures:</span>
                            <span className="font-medium">{personalStats.player.stats.bestBowlingFigures}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Catches:</span>
                            <span className="font-medium">{personalStats.player.stats.catches}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Matches */}
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">My Recent Matches</h3>
                    
                    <div className="space-y-3">
                      {personalStats.recentMatches.map((match: Match) => (
                        <div key={match.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium">{match.team1.name} vs {match.team2.name}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(match.startTime).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            {match.team1.score}/{match.team1.wickets} vs {match.team2.score}/{match.team2.wickets}
                          </div>
                          {match.manOfTheMatch?.id === personalStats.player.id && (
                            <div className="mt-2 inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              <Award className="w-3 h-3 mr-1" />
                              Man of the Match
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Personal Stats Found</h3>
                  <p className="text-gray-600">
                    Start playing matches to see your personal cricket statistics here.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={currentUser.name}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={currentUser.email}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  
                  {currentUser.phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={currentUser.phone}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Account Information</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Account created: {new Date(currentUser.createdAt).toLocaleDateString()}</p>
                      <p>Last login: {new Date(currentUser.lastLoginAt).toLocaleDateString()}</p>
                      <p>Account status: {currentUser.isVerified ? 'Verified' : 'Unverified'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};