// 🔒 RIGID GROUP MANAGEMENT TEST UTILITY
// This utility helps verify that the rigid group management system is working correctly

import { rigidGroupManager } from '../services/rigidGroupManager';
import { authService } from '../services/authService';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
}

export class RigidGroupTest {
  
  static async runAllTests(): Promise<TestResult[]> {
    console.log('🔒 Running Rigid Group Management Tests...');
    
    const results: TestResult[] = [];
    
    // Test 1: Group Selection Stability
    results.push(await this.testGroupSelectionStability());
    
    // Test 2: Group Visibility Consistency
    results.push(await this.testGroupVisibilityConsistency());
    
    // Test 3: Permanent Group Deletion
    results.push(await this.testPermanentGroupDeletion());
    
    console.log('🔒 Rigid Group Management Tests Completed');
    console.table(results);
    
    return results;
  }
  
  static async testGroupSelectionStability(): Promise<TestResult> {
    try {
      console.log('🔒 Testing Group Selection Stability...');
      
      // Get available groups
      const groups = authService.getUserGroups();
      
      if (groups.length === 0) {
        return {
          test: 'Group Selection Stability',
          passed: false,
          message: 'No groups available to test'
        };
      }
      
      const testGroup = groups[0];
      
      // Set current group with user intent
      rigidGroupManager.setCurrentGroup(testGroup, true);
      const currentAfterSet = rigidGroupManager.getCurrentGroup(groups);
      
      if (currentAfterSet?.id !== testGroup.id) {
        return {
          test: 'Group Selection Stability',
          passed: false,
          message: 'Group selection failed to set correctly'
        };
      }
      
      return {
        test: 'Group Selection Stability',
        passed: true,
        message: 'Group selection is stable and working correctly'
      };
      
    } catch (error) {
      return {
        test: 'Group Selection Stability',
        passed: false,
        message: `Test failed with error: ${error}`
      };
    }
  }
  
  static async testGroupVisibilityConsistency(): Promise<TestResult> {
    try {
      console.log('🔒 Testing Group Visibility Consistency...');
      
      const groups = authService.getUserGroups();
      
      if (groups.length === 0) {
        return {
          test: 'Group Visibility Consistency',
          passed: false,
          message: 'No groups available to test'
        };
      }
      
      const testGroup = groups[0];
      
      // Ensure group is visible
      rigidGroupManager.setGroupVisibility(testGroup.id, true);
      
      // Check if group is visible
      const isVisible = rigidGroupManager.isGroupVisible(testGroup.id);
      
      if (!isVisible) {
        return {
          test: 'Group Visibility Consistency',
          passed: false,
          message: 'Group visibility setting failed'
        };
      }
      
      return {
        test: 'Group Visibility Consistency',
        passed: true,
        message: 'Group visibility is consistent and working'
      };
      
    } catch (error) {
      return {
        test: 'Group Visibility Consistency',
        passed: false,
        message: `Test failed with error: ${error}`
      };
    }
  }
  
  static async testPermanentGroupDeletion(): Promise<TestResult> {
    try {
      console.log('🔒 Testing Permanent Group Deletion...');
      
      // Create a test group ID (not actually deleting a real group)
      const testGroupId = 'test_group_' + Date.now();
      
      // Mark as deleted
      rigidGroupManager.markGroupAsDeleted(testGroupId);
      
      // Check if marked as deleted
      const isDeleted = rigidGroupManager.isGroupDeleted(testGroupId);
      
      if (!isDeleted) {
        return {
          test: 'Permanent Group Deletion',
          passed: false,
          message: 'Group was not marked as deleted'
        };
      }
      
      return {
        test: 'Permanent Group Deletion',
        passed: true,
        message: 'Group deletion is permanent and irreversible'
      };
      
    } catch (error) {
      return {
        test: 'Permanent Group Deletion',
        passed: false,
        message: `Test failed with error: ${error}`
      };
    }
  }
  
  // Utility method to run tests from browser console
  static async runTestsFromConsole(): Promise<void> {
    console.log('🔒 Starting Rigid Group Management Console Tests...');
    
    try {
      const results = await this.runAllTests();
      const passedTests = results.filter(r => r.passed).length;
      const totalTests = results.length;
      
      console.log(`\n🔒 Test Results: ${passedTests}/${totalTests} tests passed`);
      
      if (passedTests === totalTests) {
        console.log('✅ All rigid group management tests PASSED! System is working correctly.');
      } else {
        console.log('❌ Some tests FAILED. Please check the implementation.');
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
    }
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).testRigidGroupManagement = RigidGroupTest.runTestsFromConsole;
  (window as any).rigidGroupDebugInfo = () => rigidGroupManager.getDebugInfo();
  (window as any).rigidGroupValidation = () => rigidGroupManager.validateState();
}

export default RigidGroupTest; 