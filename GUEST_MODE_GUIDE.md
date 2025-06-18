# Guest Mode Feature Guide

## Overview
ScoreWise now includes a **Guest Mode** that allows users to explore and use all cricket scoring features without creating an account. This is perfect for:
- First-time users who want to try the app
- Casual players who don't need cloud sync
- Quick matches without authentication hassles
- Demonstrations and testing

## How Guest Mode Works

### Access Guest Mode
1. Open the ScoreWise app
2. On the authentication modal, click **"Continue as Guest"**
3. You'll be signed in as a temporary guest user
4. All features become available immediately

### Guest User Features
- ✅ **Full Cricket Scoring**: Complete match scoring with all cricket rules
- ✅ **Local Data Storage**: All matches and player data saved on your device
- ✅ **Dashboard Access**: View stats, leaderboards, and match history
- ✅ **Match Setup**: Create teams and start matches instantly
- ✅ **Player Management**: Add and manage players locally
- ✅ **Match Resume**: Resume incomplete matches
- ✅ **PDF Export**: Generate and download scorecards
- ✅ **Live Scoring**: Real-time scoring with full cricket engine

### Limitations in Guest Mode
- ❌ **No Cloud Sync**: Data stays only on your current device
- ❌ **No Group Sharing**: Can't join or create shared groups
- ❌ **No Cross-Device Access**: Data won't sync to other devices
- ❌ **Temporary Session**: Data may be lost if browser data is cleared

## Guest Mode UI Indicators

### Home Screen Banner
When in guest mode, you'll see a blue banner at the top:
```
🧑 Guest Mode: Explore all features. Your data is saved locally on this device. [Sign Up]
```

### Dashboard Banner
The dashboard shows a guest mode indicator:
```
🧑 Guest Mode Active
Your data is saved locally on this device. Create an account to sync across devices. [Sign Up]
```

### User Profile Display
- Guest users show as "Guest User" in the header
- Special guest icon (👤) instead of profile photo
- No cloud sync indicators

## Technical Implementation

### Guest User Creation
```typescript
const guestUser: User = {
  id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  email: '',
  name: 'Guest User',
  phone: '',
  isVerified: false,
  isGuest: true,  // Special flag
  createdAt: Date.now(),
  lastLoginAt: Date.now(),
  groupIds: []
};
```

### Temporary Group Creation
When guest users start a match, a temporary group is automatically created:
```typescript
const tempGroup = {
  id: `guest_group_${Date.now()}`,
  name: 'Guest Group',
  description: 'Temporary group for guest user',
  // ... full group structure
};
```

### Data Storage
- All guest data is stored in localStorage
- Uses the same storage system as authenticated users
- Data persists between browser sessions (until manually cleared)

## Upgrading from Guest Mode

### Sign Up Process
1. Click any "Sign Up" button while in guest mode
2. Complete the authentication process
3. Guest data can be manually exported/imported if needed
4. New account starts fresh (guest data doesn't auto-migrate)

### Data Migration
Currently, guest data doesn't automatically transfer to new accounts. Users can:
1. Export match PDFs before signing up
2. Manually recreate important data
3. Continue using both modes as needed

## Development Notes

### Code Changes Made
1. **AuthModal.tsx**: Added guest mode button and handler
2. **authService.ts**: Added `signInAsGuest()` method
3. **types/auth.ts**: Added `isGuest?: boolean` to User interface
4. **App.tsx**: Added guest mode banners and handling
5. **Dashboard.tsx**: Added guest mode indicators

### Guest Mode Detection
```typescript
const isGuest = authService.getCurrentUser()?.isGuest;
if (isGuest) {
  // Show guest-specific UI/behavior
}
```

### Storage Behavior
- Guest data uses same localStorage keys as regular users
- No cloud sync attempts are made for guest users
- Local data persists normally

## Best Practices

### For Users
1. **Export Important Matches**: Download PDFs of important matches
2. **Understand Limitations**: Remember data stays local only
3. **Sign Up When Ready**: Create account when you need cloud features
4. **Browser Care**: Don't clear browser data if you want to keep matches

### For Developers
1. **Always Check Guest Status**: Use `user?.isGuest` checks
2. **No Cloud Operations**: Skip cloud sync for guest users
3. **Clear Upgrade Path**: Make sign-up process visible but not intrusive
4. **Data Privacy**: Guest data should remain local only

## Future Enhancements

### Potential Improvements
1. **Guest Data Migration**: Auto-transfer guest data on sign-up
2. **Extended Session**: Longer guest session duration
3. **Guest Groups**: Allow multiple guests in same group
4. **Export Tools**: Better data export options for guests
5. **Guest Analytics**: Track guest usage patterns (anonymously)

### Migration Strategy
When implementing data migration:
```typescript
const migrateGuestData = async (newUser: User, guestUser: User) => {
  const guestMatches = await storageService.getAllMatches();
  const guestPlayers = await storageService.getAllPlayers();
  
  // Update ownership and group associations
  // Save to new user's cloud storage
};
```

## Testing Guest Mode

### Test Scenarios
1. **Fresh Guest**: New user clicks "Continue as Guest"
2. **Feature Access**: Test all features work without authentication
3. **Data Persistence**: Close/reopen browser, verify data remains
4. **Upgrade Flow**: Convert guest to authenticated user
5. **Mixed Usage**: Use both guest and authenticated accounts

### Validation Points
- ✅ Guest user can create matches
- ✅ Dashboard shows guest data
- ✅ No cloud sync attempts
- ✅ Upgrade prompts appear appropriately
- ✅ Data stays local only
- ✅ All cricket features work normally

## Conclusion

Guest Mode provides a fantastic onboarding experience for new users while maintaining the full power of ScoreWise's cricket scoring engine. It removes barriers to entry while clearly showing the benefits of creating a full account.

The implementation preserves all existing functionality while adding this new access path, making ScoreWise more accessible to casual users and first-time visitors. 