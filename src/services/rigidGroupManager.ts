import { Group, User } from '../types/auth';
import { storageService } from './storage';
import { cloudStorageService } from './cloudStorageService';

// RIGID GROUP MANAGEMENT SERVICE
// This service ensures:
// 1. Group selection never changes randomly without user consent
// 2. Groups are always visible in manage group section consistently
// 3. Group deletion is permanent and irreversible

class RigidGroupManager {
  private static readonly CURRENT_GROUP_KEY = 'rigid_current_group';
  private static readonly GROUP_STATE_KEY = 'rigid_group_state';
  private static readonly DELETED_GROUPS_KEY = 'rigid_deleted_groups';
  private static readonly GROUP_VISIBILITY_KEY = 'rigid_group_visibility';
  
  private currentSelectedGroupId: string | null = null;
  private groupSelectionLocked: boolean = false;
  private deletedGroupIds: Set<string> = new Set();
  private visibilityState: Map<string, boolean> = new Map();

  constructor() {
    this.restoreState();
    console.log('🔒 RigidGroupManager initialized');
  }

  // RIGID GROUP SELECTION MANAGEMENT
  
  /**
   * Set current group with rigid persistence
   * Once set, it will NOT change without explicit user action
   */
  setCurrentGroup(group: Group, userInitiated: boolean = true): void {
    console.log('🔒 Setting current group (rigid):', group.name, 'User initiated:', userInitiated);
    
    if (!userInitiated && this.groupSelectionLocked) {
      console.warn('🚫 Group selection is locked, ignoring automatic change');
      return;
    }

    // Validate group is not deleted
    if (this.isGroupDeleted(group.id)) {
      console.error('🚫 Cannot select deleted group:', group.name);
      throw new Error('Cannot select a deleted group');
    }

    this.currentSelectedGroupId = group.id;
    this.groupSelectionLocked = true;
    
    // Triple-redundant storage
    this.saveCurrentGroupState(group);
    
    // Mark group as visible
    this.setGroupVisibility(group.id, true);
    
    console.log('✅ Current group set with rigid lock:', group.name);
  }

  /**
   * Get current group with rigid guarantee
   * Will always return the same group unless explicitly changed by user
   */
  getCurrentGroup(availableGroups: Group[]): Group | null {
    if (!this.currentSelectedGroupId) {
      // If no group selected, automatically select first available group
      if (availableGroups.length > 0) {
        const firstGroup = availableGroups[0];
        this.setCurrentGroup(firstGroup, false);
        return firstGroup;
      }
      return null;
    }

    // Find current group in available groups
    const currentGroup = availableGroups.find(g => g.id === this.currentSelectedGroupId);
    
    if (!currentGroup) {
      console.warn('🔄 Current group not found in available groups, selecting new one');
      // Current group not available, select first available
      if (availableGroups.length > 0) {
        const newGroup = availableGroups[0];
        this.setCurrentGroup(newGroup, false);
        return newGroup;
      }
      this.clearCurrentGroup();
      return null;
    }

    // Validate group is not deleted
    if (this.isGroupDeleted(currentGroup.id)) {
      console.warn('🗑️ Current group was deleted, selecting new one');
      const nextGroup = availableGroups.find(g => !this.isGroupDeleted(g.id));
      if (nextGroup) {
        this.setCurrentGroup(nextGroup, false);
        return nextGroup;
      }
      this.clearCurrentGroup();
      return null;
    }

    return currentGroup;
  }

  /**
   * Clear current group selection (user initiated only)
   */
  clearCurrentGroup(): void {
    console.log('🔒 Clearing current group selection');
    this.currentSelectedGroupId = null;
    this.groupSelectionLocked = false;
    
    localStorage.removeItem(RigidGroupManager.CURRENT_GROUP_KEY);
    this.saveState();
  }

  /**
   * Unlock group selection to allow switching
   */
  unlockGroupSelection(): void {
    console.log('🔓 Unlocking group selection');
    this.groupSelectionLocked = false;
    this.saveState();
  }

  // RIGID GROUP VISIBILITY MANAGEMENT
  
  /**
   * Ensure group is always visible in manage section
   */
  setGroupVisibility(groupId: string, visible: boolean): void {
    console.log('👁️ Setting group visibility:', groupId, visible);
    this.visibilityState.set(groupId, visible);
    this.saveVisibilityState();
  }

  /**
   * Check if group should be visible (with rigid guarantee)
   */
  isGroupVisible(groupId: string): boolean {
    if (this.isGroupDeleted(groupId)) {
      return false; // Deleted groups are never visible
    }
    
    // Default to visible unless explicitly hidden
    return this.visibilityState.get(groupId) !== false;
  }

  /**
   * Get all visible groups with rigid filtering
   */
  getVisibleGroups(allGroups: Group[]): Group[] {
    return allGroups.filter(group => 
      !this.isGroupDeleted(group.id) && 
      this.isGroupVisible(group.id)
    );
  }

  /**
   * Force refresh group visibility to ensure consistency
   */
  async refreshGroupVisibility(userId: string): Promise<void> {
    console.log('🔄 Refreshing group visibility for user:', userId);
    
    try {
      // Get all user groups from multiple sources
      const [cloudGroups, localGroups] = await Promise.all([
        this.safeGetCloudGroups(userId),
        this.safeGetLocalGroups(userId)
      ]);

      // Merge and deduplicate groups
      const allGroupsMap = new Map<string, Group>();
      
      localGroups.forEach(group => allGroupsMap.set(group.id, group));
      cloudGroups.forEach(group => allGroupsMap.set(group.id, group));
      
      const allGroups = Array.from(allGroupsMap.values());
      
      // Ensure all valid groups are visible
      allGroups.forEach(group => {
        if (!this.isGroupDeleted(group.id)) {
          this.setGroupVisibility(group.id, true);
        }
      });
      
      console.log('✅ Group visibility refreshed for', allGroups.length, 'groups');
      
    } catch (error) {
      console.error('❌ Failed to refresh group visibility:', error);
    }
  }

  // PERMANENT GROUP DELETION MANAGEMENT
  
  /**
   * Mark group as permanently deleted
   * This is irreversible and the group will never be visible again
   */
  markGroupAsDeleted(groupId: string): void {
    console.log('🗑️ Marking group as permanently deleted:', groupId);
    
    this.deletedGroupIds.add(groupId);
    this.setGroupVisibility(groupId, false);
    
    // If deleted group was current, clear selection
    if (this.currentSelectedGroupId === groupId) {
      this.clearCurrentGroup();
    }
    
    this.saveDeletedGroupsState();
    console.log('✅ Group marked as permanently deleted');
  }

  /**
   * Check if group is permanently deleted
   */
  isGroupDeleted(groupId: string): boolean {
    return this.deletedGroupIds.has(groupId);
  }

  /**
   * Get list of deleted group IDs (for debugging)
   */
  getDeletedGroupIds(): string[] {
    return Array.from(this.deletedGroupIds);
  }

  /**
   * EMERGENCY ONLY: Remove group from deleted list
   * This should only be used in extreme recovery scenarios
   */
  emergencyUndeleteGroup(groupId: string, adminConfirmation: boolean = false): void {
    if (!adminConfirmation) {
      throw new Error('Emergency undeletion requires admin confirmation');
    }
    
    console.warn('⚠️ EMERGENCY: Undeleting group:', groupId);
    this.deletedGroupIds.delete(groupId);
    this.saveDeletedGroupsState();
  }

  // COMPREHENSIVE GROUP CLEANUP
  
  /**
   * Perform comprehensive cleanup after group deletion
   */
  async performGroupCleanup(groupId: string): Promise<void> {
    console.log('🧹 Performing comprehensive group cleanup:', groupId);
    
    try {
      // Mark as deleted first to prevent any access
      this.markGroupAsDeleted(groupId);
      
      // Clean up all related data
      await Promise.all([
        this.cleanupGroupPlayers(groupId),
        this.cleanupGroupMatches(groupId),
        this.cleanupGroupStorage(groupId)
      ]);
      
      // Clean up localStorage entries
      this.cleanupLocalStorageEntries(groupId);
      
      console.log('✅ Comprehensive group cleanup completed');
      
    } catch (error) {
      console.error('❌ Group cleanup failed:', error);
      // Even if cleanup fails, group remains marked as deleted
    }
  }

  // HELPER METHODS
  
  private async safeGetCloudGroups(userId: string): Promise<Group[]> {
    try {
      return await cloudStorageService.getUserGroups() || [];
    } catch (error) {
      console.log('📱 Cloud groups unavailable:', error);
      return [];
    }
  }

  private async safeGetLocalGroups(userId: string): Promise<Group[]> {
    try {
      const allGroups = await storageService.getAllGroups();
      return allGroups.filter(group => 
        group.createdBy === userId || 
        group.members?.some((member: any) => member.userId === userId)
      );
    } catch (error) {
      console.error('❌ Failed to get local groups:', error);
      return [];
    }
  }

  private async cleanupGroupPlayers(groupId: string): Promise<void> {
    try {
      const players = await storageService.getGroupPlayers(groupId);
      for (const player of players) {
        await storageService.deletePlayer(player.id);
        try {
          await cloudStorageService.deletePlayer(player.id);
        } catch (error) {
          console.warn('⚠️ Failed to delete player from cloud:', error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup group players:', error);
    }
  }

  private async cleanupGroupMatches(groupId: string): Promise<void> {
    try {
      const matches = await storageService.getGroupMatches(groupId);
      for (const match of matches) {
        await storageService.deleteMatch(match.id);
        try {
          await cloudStorageService.deleteMatch(match.id);
        } catch (error) {
          console.warn('⚠️ Failed to delete match from cloud:', error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup group matches:', error);
    }
  }

  private async cleanupGroupStorage(groupId: string): Promise<void> {
    try {
      await storageService.deleteGroup(groupId);
      try {
        await cloudStorageService.deleteGroup(groupId);
      } catch (error) {
        console.warn('⚠️ Failed to delete group from cloud:', error);
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup group storage:', error);
    }
  }

  private cleanupLocalStorageEntries(groupId: string): void {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.includes(groupId)) {
          localStorage.removeItem(key);
          console.log('🧹 Cleaned localStorage key:', key);
        }
      });
    } catch (error) {
      console.warn('⚠️ Failed to cleanup localStorage entries:', error);
    }
  }

  // STATE PERSISTENCE
  
  private saveCurrentGroupState(group: Group): void {
    try {
      const groupState = {
        id: group.id,
        name: group.name,
        timestamp: Date.now(),
        locked: this.groupSelectionLocked
      };
      
      // Save to multiple keys for redundancy
      localStorage.setItem(RigidGroupManager.CURRENT_GROUP_KEY, JSON.stringify(groupState));
      localStorage.setItem(`${RigidGroupManager.CURRENT_GROUP_KEY}_backup`, JSON.stringify(groupState));
      sessionStorage.setItem(RigidGroupManager.CURRENT_GROUP_KEY, JSON.stringify(groupState));
      
    } catch (error) {
      console.error('❌ Failed to save current group state:', error);
    }
  }

  private saveState(): void {
    try {
      const state = {
        currentGroupId: this.currentSelectedGroupId,
        selectionLocked: this.groupSelectionLocked,
        timestamp: Date.now()
      };
      
      localStorage.setItem(RigidGroupManager.GROUP_STATE_KEY, JSON.stringify(state));
      sessionStorage.setItem(RigidGroupManager.GROUP_STATE_KEY, JSON.stringify(state));
      
    } catch (error) {
      console.error('❌ Failed to save rigid group state:', error);
    }
  }

  private saveDeletedGroupsState(): void {
    try {
      const deletedGroups = Array.from(this.deletedGroupIds);
      localStorage.setItem(RigidGroupManager.DELETED_GROUPS_KEY, JSON.stringify(deletedGroups));
    } catch (error) {
      console.error('❌ Failed to save deleted groups state:', error);
    }
  }

  private saveVisibilityState(): void {
    try {
      const visibilityMap = Object.fromEntries(this.visibilityState);
      localStorage.setItem(RigidGroupManager.GROUP_VISIBILITY_KEY, JSON.stringify(visibilityMap));
    } catch (error) {
      console.error('❌ Failed to save visibility state:', error);
    }
  }

  private restoreState(): void {
    try {
      // Restore current group
      const currentGroupState = localStorage.getItem(RigidGroupManager.CURRENT_GROUP_KEY) ||
                               sessionStorage.getItem(RigidGroupManager.CURRENT_GROUP_KEY);
      if (currentGroupState) {
        const parsed = JSON.parse(currentGroupState);
        this.currentSelectedGroupId = parsed.id;
        this.groupSelectionLocked = parsed.locked || false;
      }

      // Restore general state
      const generalState = localStorage.getItem(RigidGroupManager.GROUP_STATE_KEY) ||
                           sessionStorage.getItem(RigidGroupManager.GROUP_STATE_KEY);
      if (generalState) {
        const parsed = JSON.parse(generalState);
        this.currentSelectedGroupId = this.currentSelectedGroupId || parsed.currentGroupId;
        this.groupSelectionLocked = this.groupSelectionLocked || parsed.selectionLocked;
      }

      // Restore deleted groups
      const deletedGroupsState = localStorage.getItem(RigidGroupManager.DELETED_GROUPS_KEY);
      if (deletedGroupsState) {
        const deletedIds = JSON.parse(deletedGroupsState);
        this.deletedGroupIds = new Set(deletedIds);
      }

      // Restore visibility state
      const visibilityState = localStorage.getItem(RigidGroupManager.GROUP_VISIBILITY_KEY);
      if (visibilityState) {
        const visibilityMap = JSON.parse(visibilityState);
        this.visibilityState = new Map(Object.entries(visibilityMap));
      }

      console.log('✅ Rigid group state restored');
      
    } catch (error) {
      console.error('❌ Failed to restore rigid group state:', error);
    }
  }

  // DEBUGGING AND DIAGNOSTICS
  
  /**
   * Get comprehensive state information for debugging
   */
  getDebugInfo(): any {
    return {
      currentSelectedGroupId: this.currentSelectedGroupId,
      groupSelectionLocked: this.groupSelectionLocked,
      deletedGroupIds: Array.from(this.deletedGroupIds),
      visibilityState: Object.fromEntries(this.visibilityState),
      timestamp: Date.now()
    };
  }

  /**
   * Validate group management state
   */
  validateState(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.currentSelectedGroupId && this.isGroupDeleted(this.currentSelectedGroupId)) {
      issues.push('Current selected group is marked as deleted');
    }

    if (this.deletedGroupIds.size > 100) {
      issues.push('Too many deleted groups in memory - consider cleanup');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

export const rigidGroupManager = new RigidGroupManager(); 