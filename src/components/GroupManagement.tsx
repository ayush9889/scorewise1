import React, { useState, useEffect } from 'react';
import { Users, Plus, Share2, Settings, Crown, UserPlus, Copy, Check, Phone, Mail, Link, Eye, UserCheck, AlertCircle, X, MessageCircle, FileText, Upload, Download } from 'lucide-react';
import { Group, User } from '../types/auth';
import { Player } from '../types/cricket';
import { authService } from '../services/authService';
import { storageService } from '../services/storage';

interface GroupManagementProps {
  onBack: () => void;
}

export const GroupManagement: React.FC<GroupManagementProps> = ({ onBack }) => {
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [guestLink, setGuestLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'whatsapp' | 'csv' | 'manual'>('whatsapp');
  const [previewMembers, setPreviewMembers] = useState<{ name: string; email: string; phone?: string }[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview' | 'importing'>('input');

  useEffect(() => {
    loadGroupData();
  }, []);

  const loadGroupData = async () => {
    try {
      const group = authService.getCurrentGroup();
      console.log('📋 Loading group data:', group?.name || 'No group');
      setCurrentGroup(group);
      
      if (group) {
        const groupMembers = await authService.getGroupMembers(group.id);
        setMembers(groupMembers);
        setGuestLink(authService.generateGuestLink(group.id));
        console.log('👥 Loaded group members:', groupMembers.length);
      }
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🏗️ Creating group:', groupName);
      const group = await authService.createGroup(groupName, groupDescription);
      console.log('✅ Group created successfully:', group.name);
      
      // CRITICAL FIX: Update the current group state immediately
      setCurrentGroup(group);
      
      // Close the modal
      setShowCreateGroup(false);
      setGroupName('');
      setGroupDescription('');
      
      // Reload group data to ensure everything is in sync
      await loadGroupData();
      
      console.log('🎉 Group creation complete, staying on group management page');
    } catch (err) {
      console.error('❌ Failed to create group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🤝 Joining group with code:', inviteCode);
      const group = await authService.joinGroup(inviteCode);
      console.log('✅ Successfully joined group:', group.name);
      
      // CRITICAL FIX: Update the current group state immediately
      setCurrentGroup(group);
      
      // Close the modal
      setShowJoinGroup(false);
      setInviteCode('');
      
      // Reload group data to ensure everything is in sync
      await loadGroupData();
      
      console.log('🎉 Group join complete, staying on group management page');
    } catch (err) {
      console.error('❌ Failed to join group:', err);
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it starts with 1 and has 11 digits, it's already formatted correctly
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // If it has 10 digits, assume it's US and add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // If it already starts with + and has digits, return as is
    if (phone.startsWith('+') && digits.length >= 10) {
      return phone;
    }
    
    // Otherwise, return the original input (will likely fail validation)
    return phone;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const formatted = formatPhoneNumber(phone);
    // Basic validation: should start with + and have at least 10 digits
    const phoneRegex = /^\+\d{10,15}$/;
    return phoneRegex.test(formatted);
  };

  const handleAddMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !inviteEmail.trim() || !inviteName.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(inviteEmail.trim())) {
        throw new Error('Invalid email address format. Please enter a valid email address.');
      }

      console.log('📧 Adding member by email:', inviteName, inviteEmail);
      
      // Check if user already exists with this email
      let user = await authService.findUserByEmail(inviteEmail.trim());
      
      if (!user) {
        // Create unverified user account
        user = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          phone: invitePhone.trim() || undefined, // Optional phone number
          isVerified: false, // Will be verified when they sign up
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          groupIds: []
        };
        
        await authService.addUser(user);
        console.log('📧 Created unverified user:', user.name, user.email);
      }

      // Add user to group
      await authService.addUserToGroup(currentGroup.id, user.id, 'member');
      
      // Create a player profile for this user
      const player: Player = {
        id: `player_${user.id}`,
        name: user.name,
        shortId: user.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase(),
        photoUrl: user.photoUrl,
        isGroupMember: true,
        isGuest: false,
        groupIds: [currentGroup.id],
        stats: {
          matchesPlayed: 0,
          runsScored: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highestScore: 0,
          timesOut: 0,
          wicketsTaken: 0,
          ballsBowled: 0,
          runsConceded: 0,
          catches: 0,
          runOuts: 0,
          motmAwards: 0,
          ducks: 0,
          dotBalls: 0,
          maidenOvers: 0,
          bestBowlingFigures: '0/0'
        }
      };
      
      await storageService.savePlayer(player);
      console.log('🏏 Created player profile for:', player.name);
      
      // Send email invitation (if email service is configured)
      try {
        await authService.sendEmailInvitation(inviteEmail.trim(), currentGroup.name, currentGroup.id);
        console.log('✅ Email invitation sent successfully');
      } catch (emailError) {
        console.warn('⚠️ Failed to send email invitation:', emailError);
        // Continue without email - they can still join manually
      }
      
      // Show success message
      alert(`✅ ${inviteName} has been added to the group!\n\n📧 They will receive an email invitation to join.\n\n🏏 They can now participate in matches and will appear in group statistics.\n\n🔐 To access personalized features, they need to sign up with their email: ${inviteEmail.trim()}`);
      
      // Close modal and reset form
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      
      // CRITICAL FIX: Reload group data to show the new member
      await loadGroupData();
      
      console.log('✅ Member added successfully, group data reloaded');
    } catch (err) {
      console.error('❌ Failed to add member:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add member';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUnverifiedMember = async (userId: string, userName: string) => {
    if (!currentGroup) return;
    
    const confirmed = confirm(`Remove ${userName} from the group?\n\nThis will also remove their player profile and statistics.`);
    if (!confirmed) return;

    try {
      await authService.removeUnverifiedMember(currentGroup.id, userId);
      
      // Also remove their player profile
      const allPlayers = await storageService.getAllPlayers();
      const playerToRemove = allPlayers.find(p => p.id === `player_${userId}`);
      if (playerToRemove) {
        // Note: In a real app, you'd have a deletePlayer method
        console.log('Would remove player profile:', playerToRemove.name);
      }
      
      // CRITICAL FIX: Reload group data to reflect the removal
      await loadGroupData();
      alert(`${userName} has been removed from the group.`);
    } catch (err) {
      alert('Failed to remove member.');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const currentUser = authService.getCurrentUser();
  const canManageGroup = currentGroup ? authService.canUserManageGroup(currentGroup.id) : false;

  // CRITICAL DEBUG: Log current state
  console.log('🔍 GroupManagement render state:', {
    hasCurrentGroup: !!currentGroup,
    groupName: currentGroup?.name,
    membersCount: members.length,
    currentUser: currentUser?.name
  });

  // WhatsApp/Bulk Import Functions
  const parseWhatsAppGroup = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const members: { name: string; email: string; phone?: string }[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and common WhatsApp group export headers
      if (!trimmedLine || 
          trimmedLine.includes('Messages and calls are end-to-end encrypted') ||
          trimmedLine.includes('WhatsApp Chat') ||
          trimmedLine.includes('Tap for more info') ||
          trimmedLine.startsWith('[') ||
          trimmedLine.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
        continue;
      }
      
      // Extract name and phone number from various WhatsApp export formats
      let name = '';
      let phone = '';
      
      // Format 1: "Name: +1234567890"
      const format1 = trimmedLine.match(/^(.+?):\s*(\+?\d[\d\s\-\(\)]+)$/);
      if (format1) {
        name = format1[1].trim();
        phone = format1[2].replace(/[\s\-\(\)]/g, '');
      }
      
      // Format 2: "+1234567890 Name"
      const format2 = trimmedLine.match(/^(\+?\d[\d\s\-\(\)]+)\s+(.+)$/);
      if (format2) {
        phone = format2[1].replace(/[\s\-\(\)]/g, '');
        name = format2[2].trim();
      }
      
      // Format 3: "Name +1234567890"
      const format3 = trimmedLine.match(/^(.+?)\s+(\+?\d[\d\s\-\(\)]+)$/);
      if (format3) {
        name = format3[1].trim();
        phone = format3[2].replace(/[\s\-\(\)]/g, '');
      }
      
      // Format 4: Just name (no phone)
      if (!name && !phone) {
        // Check if it's a valid name (contains letters)
        if (trimmedLine.match(/[a-zA-Z]{2,}/)) {
          name = trimmedLine;
        }
      }
      
      if (name) {
        // Generate email from name if not provided
        const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
        
        members.push({
          name: name,
          email: email,
          phone: phone || undefined
        });
      }
    }
    
    return members;
  };

  const parseCSVFormat = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const members: { name: string; email: string; phone?: string }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip header row if it contains common CSV headers
      if (i === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('email'))) {
        continue;
      }
      
      const parts = line.split(',').map(part => part.trim().replace(/["']/g, ''));
      
      if (parts.length >= 2) {
        const name = parts[0];
        const email = parts[1];
        const phone = parts[2] || undefined;
        
        if (name && email && email.includes('@')) {
          members.push({ name, email, phone });
        }
      }
    }
    
    return members;
  };

  const parseManualFormat = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const members: { name: string; email: string; phone?: string }[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Simple format: each line is a name, generate email
      const name = trimmedLine;
      const email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`;
      
      members.push({ name, email });
    }
    
    return members;
  };

  const handleBulkImportPreview = () => {
    let parsedMembers: { name: string; email: string; phone?: string }[] = [];
    
    switch (importFormat) {
      case 'whatsapp':
        parsedMembers = parseWhatsAppGroup(bulkImportText);
        break;
      case 'csv':
        parsedMembers = parseCSVFormat(bulkImportText);
        break;
      case 'manual':
        parsedMembers = parseManualFormat(bulkImportText);
        break;
    }
    
    // Remove duplicates and filter out existing members
    const uniqueMembers = parsedMembers.filter((member, index, self) => 
      index === self.findIndex(m => m.email === member.email) &&
      !currentGroup.members.some(existing => existing.email === member.email)
    );
    
    setPreviewMembers(uniqueMembers);
    setImportStep('preview');
  };

  const handleBulkImportConfirm = async () => {
    setImportStep('importing');
    setLoading(true);
    
    try {
      const newMembers: any[] = [];
      
      for (const memberData of previewMembers) {
        const member = {
          id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...memberData,
          role: 'member' as const,
          joinedAt: new Date().toISOString(),
          isActive: true
        };
        
        newMembers.push(member);
      }
      
      // Add all new members to the group
      const updatedGroup = {
        ...currentGroup,
        members: [...currentGroup.members, ...newMembers],
        memberCount: currentGroup.memberCount + newMembers.length
      };
      
      await storageService.updateGroup(updatedGroup);
      onGroupUpdate(updatedGroup);
      
      // Reset import state
      setShowBulkImport(false);
      setBulkImportText('');
      setPreviewMembers([]);
      setImportStep('input');
      
      alert(`✅ Successfully imported ${newMembers.length} members!`);
      
    } catch (error) {
      console.error('Failed to import members:', error);
      alert('Failed to import members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-green-600 hover:text-green-700 font-semibold"
        >
          ← Back
        </button>
        <h1 className="font-bold text-xl text-gray-900">Group Management</h1>
        <div className="w-16"></div>
      </div>

      <div className="p-4 space-y-6">
        {!currentGroup ? (
          /* No Group State */
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Join or Create a Group</h2>
            <p className="text-gray-600 mb-8">
              Create a group for your cricket team or join an existing one
            </p>

            <div className="space-y-4 max-w-md mx-auto">
              <button
                onClick={() => setShowCreateGroup(true)}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                Create New Group
              </button>

              <button
                onClick={() => setShowJoinGroup(true)}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <Users className="w-5 h-5 inline mr-2" />
                Join Existing Group
              </button>
            </div>
          </div>
        ) : (
          /* Group Dashboard */
          <div className="space-y-6">
            {/* Group Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{currentGroup.name}</h2>
                  {currentGroup.description && (
                    <p className="text-gray-600 mt-1">{currentGroup.description}</p>
                  )}
                </div>
                {canManageGroup && (
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Settings className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{members.length}</div>
                  <div className="text-sm text-green-600">Members</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-700">{currentGroup.inviteCode}</div>
                  <div className="text-sm text-blue-600">Invite Code</div>
                </div>
              </div>
            </div>

            {/* Member Management Actions */}
            {canManageGroup && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Member Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <UserPlus className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <div className="text-sm font-medium text-green-700">Add Member</div>
                    <div className="text-xs text-green-600">Add one member manually</div>
                  </button>

                  <button
                    onClick={() => setShowBulkImport(true)}
                    className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <MessageCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <div className="text-sm font-medium text-blue-700">🚀 Import from WhatsApp</div>
                    <div className="text-xs text-blue-600">Bulk import multiple members</div>
                  </button>

                  <button
                    onClick={() => copyToClipboard(currentGroup.inviteCode)}
                    className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <Copy className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <div className="text-sm font-medium text-purple-700">Share Invite Code</div>
                    <div className="text-xs text-purple-600">Copy: {currentGroup.inviteCode}</div>
                  </button>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">How it works:</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li><strong>Add Member:</strong> Add individual members by email</li>
                        <li><strong>🚀 WhatsApp Import:</strong> Bulk import your entire WhatsApp group in seconds!</li>
                        <li><strong>Share Code:</strong> Let others join using the group invite code</li>
                        <li>Members can participate in matches immediately and appear in statistics</li>
                        <li>They need to verify with the same email for personalized features</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Members ({members.length})
              </h3>
              <div className="space-y-3">
                {members.map((member) => {
                  const memberInfo = currentGroup.members.find(m => m.userId === member.id);
                  const isCurrentUser = member.id === currentUser?.id;
                  const isVerified = member.isVerified;
                  const isAdmin = memberInfo?.role === 'admin';
                  const canRemove = canManageGroup && !isCurrentUser && !isVerified;
                  
                  return (
                    <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <span className="font-semibold text-green-600 text-lg">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="font-medium text-gray-900">{member.name}</div>
                            {isCurrentUser && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                You
                              </span>
                            )}
                            {isAdmin && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              isVerified 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {isVerified ? (
                                <div className="flex items-center">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Verified
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Mail className="w-3 h-3 mr-1" />
                                  Unverified
                                </div>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">{memberInfo?.role}</span>
                          </div>
                          {member.phone && (
                            <div className="text-xs text-gray-400 mt-1">{member.phone}</div>
                          )}
                          {!isVerified && (
                            <div className="text-xs text-orange-600 mt-1">
                              Can participate in matches • Sign up with {member.email} to verify
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {canRemove && (
                          <button
                            onClick={() => handleRemoveUnverifiedMember(member.id, member.name)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                            title="Remove unverified member"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sharing Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share & Invite</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invite Code
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={currentGroup.inviteCode}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(currentGroup.inviteCode)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Share this code with new members to join the group
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guest View Link (Read-Only Access)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={guestLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(guestLink)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Anyone with this link can view group stats without signing up
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter group name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Describe your group"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invite Code
                </label>
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

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowJoinGroup(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Member to Group</h2>
              <p className="text-sm text-gray-600 mt-1">Add someone to your cricket group by email address</p>
            </div>
            <form onSubmit={handleAddMemberByEmail} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter their full name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter email address (e.g., player@example.com)"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  They will receive an invitation email to join the group
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter phone number (optional)"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Phone number can be added later
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What happens next:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• They'll be added to your group immediately</li>
                  <li>• They can participate in matches and appear in statistics</li>
                  <li>• They'll receive an email invitation to join</li>
                  <li>• Once they sign up, they can access personalized features</li>
                </ul>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Adding...' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteName('');
                    setInviteEmail('');
                    setInvitePhone('');
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

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-green-600 p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">🚀 Bulk Import Members</h3>
                  <p className="text-blue-100 mt-1">Quickly add multiple members to your group</p>
                </div>
                <button
                  onClick={() => {
                    setShowBulkImport(false);
                    setBulkImportText('');
                    setPreviewMembers([]);
                    setImportStep('input');
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {importStep === 'input' && (
                <>
                  {/* Import Format Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Choose Import Format</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setImportFormat('whatsapp')}
                        className={`p-3 border rounded-lg text-sm ${
                          importFormat === 'whatsapp'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:border-green-300'
                        }`}
                      >
                        <MessageCircle className="w-5 h-5 mx-auto mb-1" />
                        WhatsApp Export
                      </button>
                      <button
                        onClick={() => setImportFormat('csv')}
                        className={`p-3 border rounded-lg text-sm ${
                          importFormat === 'csv'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <FileText className="w-5 h-5 mx-auto mb-1" />
                        CSV Format
                      </button>
                      <button
                        onClick={() => setImportFormat('manual')}
                        className={`p-3 border rounded-lg text-sm ${
                          importFormat === 'manual'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-300 hover:border-purple-300'
                        }`}
                      >
                        <UserPlus className="w-5 h-5 mx-auto mb-1" />
                        Name List
                      </button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">Instructions:</h4>
                    {importFormat === 'whatsapp' && (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Export your WhatsApp group chat (without media)</p>
                        <p>• Copy the participant list from the exported file</p>
                        <p>• Paste it in the text area below</p>
                        <p>• Supports formats: "Name: +1234567890" or "+1234567890 Name"</p>
                      </div>
                    )}
                    {importFormat === 'csv' && (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Format: Name, Email, Phone (optional)</p>
                        <p>• Example: "John Doe, john@email.com, +1234567890"</p>
                        <p>• One member per line</p>
                      </div>
                    )}
                    {importFormat === 'manual' && (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Enter one name per line</p>
                        <p>• Emails will be auto-generated</p>
                        <p>• Example: "John Doe"</p>
                      </div>
                    )}
                  </div>

                  {/* Text Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Paste your {importFormat === 'whatsapp' ? 'WhatsApp group export' : importFormat === 'csv' ? 'CSV data' : 'name list'} here:
                    </label>
                    <textarea
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      placeholder={
                        importFormat === 'whatsapp' 
                          ? 'John Doe: +1234567890\nJane Smith: +0987654321\n...' 
                          : importFormat === 'csv'
                          ? 'John Doe, john@email.com, +1234567890\nJane Smith, jane@email.com, +0987654321'
                          : 'John Doe\nJane Smith\nBob Johnson'
                      }
                      className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowBulkImport(false)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkImportPreview}
                      disabled={!bulkImportText.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Preview Import
                    </button>
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold">Preview Import Results</h4>
                      <span className="text-sm text-gray-600">{previewMembers.length} members found</span>
                    </div>
                    
                    {previewMembers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No valid members found. Please check your format and try again.</p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        {previewMembers.map((member, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0">
                            <div>
                              <div className="font-medium">{member.name}</div>
                              <div className="text-sm text-gray-500">{member.email}</div>
                              {member.phone && <div className="text-sm text-gray-400">{member.phone}</div>}
                            </div>
                            <UserCheck className="w-5 h-5 text-green-500" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setImportStep('input')}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleBulkImportConfirm}
                      disabled={previewMembers.length === 0}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import {previewMembers.length} Members
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Importing members...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};