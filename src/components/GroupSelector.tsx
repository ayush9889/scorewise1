import React, { useState, useEffect } from 'react';
import { Users, Plus, ChevronDown, Crown, Settings, UserPlus, LogOut } from 'lucide-react';
import { Group, User } from '../types/auth';
import { authService } from '../services/authService';

interface GroupSelectorProps {
  currentGroup: Group | null;
  onGroupSelect: (group: Group) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onManageGroup: () => void;
  showManagement?: boolean;
}

export const GroupSelector: React.FC<GroupSelectorProps> = ({
  currentGroup,
  onGroupSelect,
  onCreateGroup,
  onJoinGroup,
  onManageGroup,
  showManagement = true
}) => {
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadUserGroups();
  }, []);

  const loadUserGroups = async () => {
    try {
      const user = authService.getCurrentUser();
      setCurrentUser(user);
      
      if (user) {
        await authService.loadUserGroups();
        const groups = authService.getUserGroups();
        setUserGroups(groups);
      }
    } catch (error) {
      console.error('Failed to load user groups:', error);
    }
  };

  const handleGroupSelect = (group: Group) => {
    onGroupSelect(group);
    setIsDropdownOpen(false);
  };

  const getUserRole = (group: Group): string => {
    if (!currentUser) return 'member';
    const member = group.members.find(m => m.userId === currentUser.id);
    return member?.role || 'member';
  };

  const getMemberCount = (group: Group): number => {
    return group.members.length;
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="relative">
      {/* Current Group Display / Selector */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center justify-between w-full bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-left">
            {currentGroup ? (
              <>
                <div className="font-semibold text-gray-900">{currentGroup.name}</div>
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                  <span>{getMemberCount(currentGroup)} members</span>
                  {getUserRole(currentGroup) === 'admin' && (
                    <Crown className="w-3 h-3 text-yellow-500" />
                  )}
                  <span className="capitalize">({getUserRole(currentGroup)})</span>
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-gray-900">Select Group</div>
                <div className="text-sm text-gray-500">Choose or create a group</div>
              </>
            )}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* User's Groups */}
          {userGroups.length > 0 && (
            <div>
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Your Groups ({userGroups.length})
                </div>
              </div>
              {userGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  className={`w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors ${
                    currentGroup?.id === group.id ? 'bg-green-50 border-r-2 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      currentGroup?.id === group.id ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Users className={`w-4 h-4 ${
                        currentGroup?.id === group.id ? 'text-green-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{group.name}</div>
                      <div className="text-sm text-gray-500 flex items-center space-x-2">
                        <span>{getMemberCount(group)} members</span>
                        {getUserRole(group) === 'admin' && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  </div>
                  {currentGroup?.id === group.id && (
                    <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      Active
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => {
                onCreateGroup();
                setIsDropdownOpen(false);
              }}
              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Create New Group</div>
                <div className="text-sm text-gray-500">Start a new cricket group</div>
              </div>
            </button>

            <button
              onClick={() => {
                onJoinGroup();
                setIsDropdownOpen(false);
              }}
              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Join Group</div>
                <div className="text-sm text-gray-500">Join with invite code</div>
              </div>
            </button>

            {showManagement && currentGroup && getUserRole(currentGroup) === 'admin' && (
              <button
                onClick={() => {
                  onManageGroup();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Settings className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Manage Group</div>
                  <div className="text-sm text-gray-500">Settings & member management</div>
                </div>
              </button>
            )}
          </div>

          {/* No Groups State */}
          {userGroups.length === 0 && (
            <div className="p-6 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <div className="font-medium text-gray-900 mb-1">No Groups Yet</div>
              <div className="text-sm text-gray-500">Create or join a group to get started</div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}; 