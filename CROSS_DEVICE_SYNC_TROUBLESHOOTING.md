# Cross-Device Sync Troubleshooting Guide

## Issue
User reports that cross-device sync is not working - data is still different between laptop and mobile devices even after implementing the sync feature.

## Fixes Applied

### 1. **Phone Number Support Added**
**Problem**: Original sync only worked for users with email addresses, but some users sign up with phone numbers only.

**Solution**: Updated all sync methods to use `userIdentifier = user.email || user.phone` instead of just `user.email`.

**Files Updated**:
- `src/services/userCloudSyncService.ts` - All methods now support phone numbers
- `src/components/CloudSyncStatus.tsx` - Shows for both email and phone users

### 2. **Debug Tools Added**
**Problem**: No way to diagnose sync issues.

**Solution**: Added comprehensive debug tools:
- `src/services/debugCloudSync.ts` - Test Firebase connection, user sync, environment
- Debug button in CloudSyncStatus component
- Browser console access via `window.debugCloudSync.runAllTests()`

## Testing Steps

### Step 1: Check Current Environment
1. Open the app in browser
2. Look for "Cloud Sync" section in Dashboard
3. Click the purple "Debug" button
4. Check browser console for detailed results

### Step 2: Verify Firebase Connection
```javascript
// In browser console:
window.debugCloudSync.testFirebaseConnection()
```

### Step 3: Test User Sync
```javascript
// In browser console (after logging in):
window.debugCloudSync.testUserSync()
```

### Step 4: Run Complete Test Suite
```javascript
// In browser console:
window.debugCloudSync.runAllTests()
```

## Common Issues & Solutions

### Issue 1: "Firebase db not initialized"
**Symptoms**: Debug shows Firebase connection failed
**Causes**: 
- Missing environment variables
- Firebase configuration error
- Network connectivity

**Solutions**:
1. Check `.env` file has all Firebase variables:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_PROJECT_ID=your_project_id
   # ... etc
   ```
2. Restart development server after adding env variables
3. Check Firebase Console project is active

### Issue 2: "No user logged in"
**Symptoms**: Sync skipped, debug shows no user
**Causes**: User not properly authenticated

**Solutions**:
1. Log out and log back in
2. Check localStorage has currentUser
3. Try different authentication method (email vs phone)

### Issue 3: "Permission denied" errors
**Symptoms**: Firebase operations fail with permission errors
**Causes**: Firebase security rules too restrictive

**Solutions**:
1. Update Firestore security rules:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Allow authenticated users to read/write their own data
       match /{collection}/{document} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
2. Deploy rules to Firebase Console

### Issue 4: "User has no email or phone"
**Symptoms**: Sync shows user but no identifier
**Causes**: Guest user or incomplete user profile

**Solutions**:
1. Ensure user signs up with email or phone
2. Check user profile completeness
3. Re-authenticate if needed

### Issue 5: Data not syncing between devices
**Symptoms**: Debug passes but data still different
**Causes**: 
- Different user accounts on different devices
- Local storage conflicts
- Sync timing issues

**Solutions**:
1. **Verify same account**: Ensure exact same email/phone on both devices
2. **Force sync**: Use "Sync Now" button on both devices
3. **Clear local storage**: Clear browser storage and re-login
4. **Check user identifier**: Ensure both devices show same user email/phone

## Manual Testing Procedure

### Test Cross-Device Sync:
1. **Device A (Laptop)**:
   - Login with email: `test@example.com`
   - Create a group called "Test Group"
   - Add a player "Test Player"
   - Check debug shows sync successful
   
2. **Device B (Mobile)**:
   - Login with same email: `test@example.com`
   - Check if "Test Group" appears
   - Check if "Test Player" is visible
   - Run debug test to verify sync

3. **Reverse Test**:
   - On Device B, create new match
   - Check if it appears on Device A
   - Use "Sync Now" if needed

## Debug Information to Collect

When reporting sync issues, provide:
1. **Debug test results** from both devices
2. **Browser console logs** during sync attempts
3. **User information**: Email/phone used for login
4. **Device information**: Browser type, mobile/desktop
5. **Network status**: Online/offline, connection quality

## Environment Variables Check

Verify these are set correctly:
```bash
# Check in browser console:
console.log('Firebase Config:', {
  hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  hasProjectId: !!import.meta.env.VITE_FIREBASE_PROJECT_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  hasAuthDomain: !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
});
```

## Firebase Console Checks

1. **Authentication**: Check if users are appearing in Firebase Auth
2. **Firestore Database**: Check if documents are being created in collections:
   - `users/`
   - `user_groups/`
   - `user_matches/`
   - `user_players/`
   - `sync_metadata/`
3. **Security Rules**: Ensure rules allow authenticated access
4. **Usage**: Check quota usage isn't exceeded

## Quick Fix Commands

```javascript
// Force manual sync
userCloudSyncService.manualSync()

// Check current user
authService.getCurrentUser()

// Test Firebase directly
import { doc, setDoc } from 'firebase/firestore';
import { db } from './config/firebase';
setDoc(doc(db, 'test', 'test'), { message: 'test' })

// Clear local storage and restart
localStorage.clear();
location.reload();
```

## Development Mode Testing

If Firebase isn't working, test locally:
1. Remove all `VITE_FIREBASE_*` environment variables
2. App will fall back to local-only mode
3. Use this to test app functionality without cloud sync

## Production Deployment Notes

For production, ensure:
1. All environment variables are set in hosting platform
2. Firebase security rules are properly configured
3. Domain is added to Firebase authorized domains
4. SSL/HTTPS is enabled (required for Firebase)

## Support Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Status Page](https://status.firebase.google.com/)

---

**Next Steps**: Use the debug tools to identify the specific failure point and follow the appropriate solution above. 