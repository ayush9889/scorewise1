import React, { useState, useEffect } from 'react';
import { Users, Plus, Share2, Settings, Crown, UserPlus, Copy, Check, Phone, Mail, Link, Eye, UserCheck, AlertCircle, X, MessageCircle, FileText, Upload, Download, Edit, Trash2, Star, ExternalLink, CheckCircle, Globe, RefreshCw, Shield, Activity } from 'lucide-react';
import { Group, User } from '../types/auth';
import { Player } from '../types/cricket';
import { authService } from '../services/authService';
import { storageService } from '../services/storage';
import { AddPlayerModal } from './AddPlayerModal';
import { cloudStorageService } from '../services/cloudStorageService';
import { SimpleGroupShareModal } from './SimpleGroupShareModal';

interface GroupManagementProps {
  onBack: () => void;
}

export const GroupManagement: React.FC<GroupManagementProps> = ({ onBack }) => {
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<'players'>('players');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
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
  const [previewPlayers, setPreviewPlayers] = useState<{ name: string; email: string; phone?: string }[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview' | 'importing'>('input');
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    loadGroupData();
  }, []);

  const loadGroupData = async () => {
    try {
      const group = authService.getCurrentGroup();
      console.log('📋 Loading group data:', group?.name || 'No group');
      setCurrentGroup(group);
      
      if (group) {
        setGuestLink(authService.generateGuestLink(group.id));
        console.log('👥 Loading group players for:', group.name);
        
        // Load group players from cloud first, then fallback to local
        try {
          const cloudPlayers = await cloudStorageService.getGroupPlayers(group.id);
          setPlayers(cloudPlayers);
          console.log('🏏 Loaded group players from cloud:', cloudPlayers.length);
        } catch (error) {
          console.log('📱 Loading players from local storage');
          const groupPlayers = await storageService.getGroupPlayers(group.id);
          setPlayers(groupPlayers);
          console.log('🏏 Loaded group players from local storage:', groupPlayers.length);
        }
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
      console.log('🤝 Joining group with code:', inviteCode.trim().toUpperCase());
      const group = await authService.joinGroup(inviteCode.trim());
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

  const handleAddPlayerByEmail = async (e: React.FormEvent) => {
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

      console.log('📧 Adding player by email:', inviteName, inviteEmail);
      
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

      // Add user to group as member first (for backward compatibility)
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
      alert(`✅ ${inviteName} has been added as a player to the group!\n\n📧 They will receive an email invitation to join.\n\n🏏 They can now participate in matches and their stats will be tracked.\n\n🔐 To access their full player profile, they need to sign up with their email: ${inviteEmail.trim()}`);
      
      // Close modal and reset form
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      
      // CRITICAL FIX: Reload group data to show the new player
      await loadGroupData();
      
      console.log('✅ Player added successfully, group data reloaded');
    } catch (err) {
      console.error('❌ Failed to add player:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add player';
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
    groupId: currentGroup?.id,
    playersCount: players.length,
    currentUser: currentUser?.name,
    currentUserId: currentUser?.id,
    canManageGroup: canManageGroup,
    groupCreatedBy: currentGroup?.createdBy,
    groupAdmins: currentGroup?.admins
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
    
    setPreviewPlayers(uniqueMembers);
    setImportStep('preview');
  };

  const handlePlayerAdded = async (player: Player) => {
    console.log('🏏 Player added:', player.name);
    // Refresh players list from cloud first, then fallback to local
    if (currentGroup) {
      try {
        const cloudPlayers = await cloudStorageService.getGroupPlayers(currentGroup.id);
        setPlayers(cloudPlayers);
        console.log('✅ Players loaded from cloud:', cloudPlayers.length);
      } catch (error) {
        console.log('📱 Loading players from local storage');
        const groupPlayers = await storageService.getGroupPlayers(currentGroup.id);
        setPlayers(groupPlayers);
      }
    }
  };

  const handleDeletePlayer = async (playerId: string, playerName: string) => {
    if (!currentGroup) return;
    
    const confirmed = window.confirm(`Are you sure you want to remove ${playerName} from the group? This will delete all their stats and match history.`);
    if (!confirmed) return;

    try {
      // Remove from cloud first, then local
      try {
        await cloudStorageService.removePlayerFromGroup(playerId, currentGroup.id);
        console.log('☁️ Player removed from cloud:', playerName);
      } catch (error) {
        console.log('📱 Cloud removal failed, removing locally');
      }
      
      await storageService.removePlayerFromGroup(playerId, currentGroup.id);
      console.log('🗑️ Player removed:', playerName);
      
      // Refresh players list from cloud first, then local
      try {
        const cloudPlayers = await cloudStorageService.getGroupPlayers(currentGroup.id);
        setPlayers(cloudPlayers);
      } catch (error) {
        const groupPlayers = await storageService.getGroupPlayers(currentGroup.id);
        setPlayers(groupPlayers);
      }
    } catch (error) {
      console.error('Failed to remove player:', error);
    }
  };

  const getPlayerMatchStats = (player: Player) => {
    const stats = player.stats || {};
    return {
      matches: stats.matchesPlayed || 0,
      runs: stats.runsScored || 0,
      wickets: stats.wicketsTaken || 0,
      average: stats.matchesPlayed > 0 ? (stats.runsScored / Math.max(stats.timesOut || 1, 1)).toFixed(1) : '0.0',
      strikeRate: stats.ballsFaced > 0 ? ((stats.runsScored / stats.ballsFaced) * 100).toFixed(1) : '0.0'
    };
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    
    if (deleteConfirmText !== currentGroup.name) {
      setError('Please type the group name exactly to confirm deletion');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🗑️ Deleting group:', currentGroup.name);
      
      // Call the delete group service
      await authService.deleteGroup(currentGroup.id);
      
      console.log('✅ Group deleted successfully');
      
      // Close modal and navigate back
      setShowDeleteGroupModal(false);
      setDeleteConfirmText('');
      onBack(); // Navigate back to main dashboard
      
    } catch (err) {
      console.error('❌ Failed to delete group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImportConfirm = async () => {
    if (!currentGroup || previewPlayers.length === 0) return;

    setImportStep('importing');
    setLoading(true);
    
    try {
      console.log('🚀 Starting bulk import of', previewPlayers.length, 'players');
      
      const newPlayers: any[] = [];
      
      for (const playerData of previewPlayers) {
        // Create user account first
        const user = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          email: playerData.email,
          name: playerData.name,
          phone: playerData.phone,
          isVerified: false,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          groupIds: [currentGroup.id]
        };
        
        await authService.addUser(user);
        await authService.addUserToGroup(currentGroup.id, user.id, 'member');
        
        // Create player profile for each imported user
        const player: Player = {
          id: `player_${user.id}`,
          name: user.name,
          shortId: user.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase(),
          photoUrl: undefined,
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
        newPlayers.push(player);
        
        console.log('✅ Created player profile for:', player.name);
      }
      
      // Reset import state
      setShowBulkImport(false);
      setBulkImportText('');
      setPreviewPlayers([]);
      setImportStep('input');
      
      // Reload group data to show new players
      await loadGroupData();
      
      alert(`🎉 Successfully imported ${newPlayers.length} players!\n\n🏏 All players can now participate in matches and their stats will be tracked.`);
      
      console.log('✅ Bulk import completed successfully');
    } catch (error) {
      console.error('❌ Bulk import failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to import players');
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
                  <div className="text-2xl font-bold text-green-700">{currentGroup.members.length}</div>
                  <div className="text-sm text-green-600">Members</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-700">{currentGroup.inviteCode}</div>
                  <div className="text-sm text-blue-600">Invite Code</div>
                </div>
              </div>
            </div>

            {/* Member Management Actions */}
            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-lg">
              <div className="border-b border-gray-200">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab('players')}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'players'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>Players ({players.length})</span>
                    </div>
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'players' && (
                  <div className="space-y-6">
                    {canManageGroup && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Player Management</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <button
                            onClick={() => setShowInviteModal(true)}
                            className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                          >
                            <UserPlus className="w-6 h-6 text-green-600 mx-auto mb-2" />
                            <div className="text-sm font-medium text-green-700">Add Player</div>
                            <div className="text-xs text-green-600">Add one player manually</div>
                          </button>

                          <button
                            onClick={() => setShowBulkImport(true)}
                            className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <MessageCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <div className="text-sm font-medium text-blue-700">🚀 Import from WhatsApp</div>
                            <div className="text-xs text-blue-600">Bulk import multiple players</div>
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
                              <p className="font-medium mb-1">How player management works:</p>
                              <ul className="text-xs space-y-1 list-disc list-inside">
                                <li><strong>Add Player:</strong> Add individual players by email - they become players immediately</li>
                                <li><strong>🚀 WhatsApp Import:</strong> Bulk import your entire WhatsApp group in seconds!</li>
                                <li><strong>Share Code:</strong> Let others join using the group invite code - they become players instantly</li>
                                <li><strong>Match Ready:</strong> All players can participate in matches immediately and their stats will be tracked</li>
                                <li><strong>Full Access:</strong> Players need to verify with the same email for complete profile access</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Players</h3>
                      <div className="space-y-3">
                        {players.map((player) => {
                          const canRemove = canManageGroup && !player.isGroupMember;
                          const hasStats = player.stats && player.stats.matchesPlayed > 0;
                          
                          return (
                            <div key={player.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                                  {player.photoUrl ? (
                                    <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    <span className="font-semibold text-green-600 text-lg">
                                      {player.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <div className="font-medium text-gray-900">{player.name}</div>
                                    {player.isGroupMember && (
                                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center">
                                        <Crown className="w-3 h-3 mr-1" />
                                        Member
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                      Player
                                    </span>
                                    {hasStats && (
                                      <span className="text-xs text-gray-500">
                                        {player.stats.matchesPlayed} matches played
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-green-600 mt-1">
                                    ✅ Can participate in matches • Stats are tracked
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {hasStats && (
                                  <div className="text-right text-xs text-gray-500">
                                    <div>Runs: {player.stats.runsScored}</div>
                                    <div>Avg: {player.stats.ballsFaced > 0 ? (player.stats.runsScored / player.stats.ballsFaced * 100).toFixed(1) : '0.0'}</div>
                                  </div>
                                )}
                                {canRemove && (
                                  <button
                                    onClick={() => handleDeletePlayer(player.id, player.name)}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                                    title="Remove player"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {players.length === 0 && (
                          <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 mb-2">No players in this group yet</p>
                            <p className="text-sm text-gray-400">Add players using the buttons above</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modern Sharing Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share & Invite</h3>
              
              <div className="space-y-4">
                {/* Modern Link & QR Sharing */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">🚀 New & Improved Sharing</h4>
                      <p className="text-sm text-gray-600">Share join links and QR codes - much easier than typing codes!</p>
                    </div>
                    <ExternalLink className="w-8 h-8 text-green-600" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                      <ExternalLink className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-sm font-medium text-green-800">One-Click Links</div>
                      <div className="text-xs text-green-600">Click to join instantly</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-purple-200 text-center">
                      <Globe className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <div className="text-sm font-medium text-purple-800">QR Codes</div>
                      <div className="text-xs text-purple-600">Scan with phone camera</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-blue-200 text-center">
                      <Shield className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <div className="text-sm font-medium text-blue-800">Secure</div>
                      <div className="text-xs text-blue-600">Auto-expire in 24h</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-6 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-300 font-medium flex items-center justify-center space-x-2"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>Share Group - Links & QR Codes</span>
                  </button>
                </div>

                {/* Fallback: Traditional Invite Code */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">🔢 Traditional Method</h4>
                      <p className="text-xs text-gray-600">Backup option - if links don't work</p>
                    </div>
                    <Copy className="w-5 h-5 text-gray-500" />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={currentGroup.inviteCode}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white font-mono text-center text-lg font-bold tracking-wider"
                    />
                    <button
                      onClick={() => copyToClipboard(currentGroup.inviteCode)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      title="Copy invite code"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    6-character code for manual entry in "Join Group"
                  </p>
                </div>

                {/* Guest View Link */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-blue-800">👁️ Guest View</h4>
                      <p className="text-xs text-blue-600">Read-only access to group stats</p>
                    </div>
                    <Eye className="w-5 h-5 text-blue-500" />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={guestLink}
                      readOnly
                      className="flex-1 px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(guestLink)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="Copy guest link"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Anyone can view stats without signing up or joining
                  </p>
                </div>
              </div>
            </div>

            {/* Debug Information */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">🔍 Debug Information</h3>
              <div className="text-xs text-yellow-800 space-y-1">
                <p><strong>Current User:</strong> {currentUser?.name} (ID: {currentUser?.id})</p>
                <p><strong>Current Group:</strong> {currentGroup?.name} (ID: {currentGroup?.id})</p>
                <p><strong>Group Created By:</strong> {currentGroup?.createdBy}</p>
                <p><strong>Can Manage Group:</strong> {canManageGroup ? '✅ YES' : '❌ NO'}</p>
                <p><strong>Group Admins:</strong> {currentGroup?.admins?.join(', ') || 'None'}</p>
                {!canManageGroup && (
                  <p className="mt-2 text-yellow-700 font-medium">
                    ⚠️ You don't have management permissions. Only group creators and admins can delete groups.
                  </p>
                )}
              </div>
            </div>

            {/* Dangerous Actions - Group Deletion */}
            {canManageGroup ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Dangerous Zone
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-red-200">
                    <h4 className="font-medium text-red-900 mb-2">Delete Group</h4>
                    <p className="text-sm text-red-700 mb-4">
                      Permanently delete this group and all associated data. This action cannot be undone.
                      This will remove:
                    </p>
                    <ul className="text-xs text-red-600 list-disc list-inside mb-4 space-y-1">
                      <li>All group members and their associations</li>
                      <li>All players in this group</li>
                      <li>All matches played by this group</li>
                      <li>All statistics and scorecard data</li>
                      <li>The group invite code will become invalid</li>
                    </ul>
                    <button
                      onClick={() => setShowDeleteGroupModal(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Group</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Group Deletion (No Permission)
                </h3>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-700 mb-2">Delete Group</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Only group creators and administrators can delete groups. Contact your group admin to delete this group.
                  </p>
                  <button
                    disabled
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Group (Not Authorized)</span>
                  </button>
                </div>
              </div>
            )}
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
              <h2 className="text-xl font-bold text-gray-900">Add Player to Group</h2>
              <p className="text-sm text-gray-600 mt-1">Add someone to your cricket group as a player</p>
            </div>
            <form onSubmit={handleAddPlayerByEmail} className="p-6 space-y-4">
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
                  <li>• They'll be added as a player to your group immediately</li>
                  <li>• They can participate in matches and their stats will be tracked</li>
                  <li>• They'll receive an email invitation to join</li>
                  <li>• Once they sign up, they can access their full player profile</li>
                </ul>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Adding...' : 'Add Player'}
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
                  <h3 className="text-xl font-bold">🚀 Bulk Import Players</h3>
                  <p className="text-blue-100 mt-1">Quickly add multiple players to your group</p>
                </div>
                <button
                  onClick={() => {
                    setShowBulkImport(false);
                    setBulkImportText('');
                    setPreviewPlayers([]);
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
                        <p>• One player per line</p>
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
                      <span className="text-sm text-gray-600">{previewPlayers.length} players found</span>
                    </div>
                    
                    {previewPlayers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No valid players found. Please check your format and try again.</p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border rounded-lg">
                        {previewPlayers.map((member, index) => (
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
                      disabled={previewPlayers.length === 0}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import {previewPlayers.length} Players
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Importing players...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      <AddPlayerModal
        isOpen={showAddPlayerModal}
        onClose={() => setShowAddPlayerModal(false)}
        onPlayerAdded={handlePlayerAdded}
        groupId={currentGroup?.id}
      />

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                <h2 className="text-xl font-bold text-red-900">Delete Group</h2>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-red-800 text-sm mb-3 font-medium">
                  ⚠️ This action will permanently delete the group "{currentGroup?.name}" and ALL associated data:
                </p>
                <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                  <li>{currentGroup?.members.length} group members will lose access</li>
                  <li>{players.length} players will be removed</li>
                  <li>All match history and statistics will be deleted</li>
                  <li>The invite code "{currentGroup?.inviteCode}" will become invalid</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type the group name <span className="font-mono text-red-600">"{currentGroup?.name}"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={`Type "${currentGroup?.name}" here`}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteGroupModal(false);
                  setDeleteConfirmText('');
                  setError('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={loading || deleteConfirmText !== currentGroup?.name}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Group Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Share Modal */}
      {showShareModal && currentGroup && (
        <SimpleGroupShareModal
          group={currentGroup}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};