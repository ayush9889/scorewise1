# 🔧 Cross-Device Sync Troubleshooting Guide

## Quick Fix Steps

### Step 1: Open Your App
Your app should be running at: **http://localhost:5174**

### Step 2: Sign In (Not Guest Mode)
- Use an email account (not phone, not guest)
- Make sure you're using the SAME email on all devices

### Step 3: Run Diagnostic Tests
1. Go to the Dashboard
2. Look for the **Cloud Sync Status** component
3. Click the eye icon to expand details
4. Click **"🔍 Deep Diagnostic Test"**
5. Check the results

## Expected Test Results

### ✅ All Tests Should Pass
If you see **"5/5 tests passed"**, sync should work perfectly.

### ❌ If Tests Fail

#### Test 1: Firebase Configuration Failed
**Problem**: `.env` file or Firebase config issue
**Solution**: 
```bash
# Check if .env file exists
ls -la .env
# Should show Firebase config variables
```

#### Test 2: Firebase Write Failed
**Problem**: Firebase security rules blocking writes
**Solution**: You need to update Firebase security rules
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `scorewise-e5b59`
3. Go to Firestore Database → Rules
4. Update rules to allow authenticated users:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users
    match /{document=**} {
      allow read, write: if true; // Temporary - replace with proper auth rules
    }
  }
}
```

#### Test 3: Firebase Read Failed
**Problem**: Data was written but can't be read back
**Solution**: Same as Test 2 - update security rules

#### Test 4: User Data Sync Failed
**Problem**: User-specific data sync not working
**Solutions**:
1. Make sure user has email (not just phone)
2. Check Firebase rules allow user-specific collections
3. Try signing out and back in

#### Test 5: Collection Query Failed
**Problem**: Can't query Firebase collections
**Solution**: Update Firebase rules and check network

## Manual Testing Steps

### Test Real-Time Sync
1. Click **"🔄 Test Real-Time Sync"** button
2. Check console for success message
3. Open app on another device with same email
4. Look for the test data to appear

### Browser Console Testing
1. Press F12 to open browser console
2. Type: `syncBootstrap.forceReinitialize()`
3. Watch for sync initialization messages
4. Type: `SyncTest.runComprehensiveTest()` for detailed testing

## Common Issues & Solutions

### Issue: "Firebase connection failed"
**Cause**: Network or Firebase config problem
**Solution**: 
1. Check internet connection
2. Verify `.env` file has correct Firebase config
3. Restart development server: `npm run dev`

### Issue: "User has no email or phone"
**Cause**: Guest mode or incomplete user profile
**Solution**:
1. Sign out of guest mode
2. Sign in with email account
3. Ensure user profile has email field

### Issue: "Permission denied" errors
**Cause**: Firebase security rules too restrictive
**Solution**: Update Firestore security rules (see above)

### Issue: Data appears on one device but not another
**Cause**: Sync not initializing properly
**Solutions**:
1. Use same email on both devices
2. Force refresh both devices
3. Run `syncBootstrap.forceReinitialize()` in console
4. Check that both devices are online

## Firebase Security Rules (Temporary Fix)

For testing, use these permissive rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Warning**: These rules allow anyone to read/write your database. Use only for testing!

## Advanced Debugging

### Check Sync Status
```javascript
// In browser console
userCloudSyncService.getSyncStatus().then(console.log)
```

### Force Full Sync
```javascript
// In browser console
userCloudSyncService.performFullSync().then(() => console.log('Sync completed'))
```

### Check User Data
```javascript
// In browser console
console.log('Current user:', authService.getCurrentUser())
console.log('Local storage user:', localStorage.getItem('currentUser'))
```

## Still Not Working?

If sync still doesn't work after following this guide:

1. **Check Firebase Project**: Ensure you're using the correct Firebase project (`scorewise-e5b59`)
2. **Clear Browser Data**: Clear localStorage and cookies, then sign in again
3. **Try Different Browser**: Test on a different browser or incognito mode
4. **Check Network**: Ensure both devices have stable internet
5. **Console Errors**: Look for any red error messages in browser console (F12)

## Success Indicators

✅ **Sync is working when**:
- All diagnostic tests pass (5/5)
- Same data appears on all devices with same email
- Real-time sync test succeeds
- Console shows "Sync bootstrap completed successfully"
- CloudSyncStatus shows "Synced" with recent sync time

Remember: Both devices must:
1. Use the same email account
2. Be online
3. Have the app fully loaded
4. Not be in guest mode 