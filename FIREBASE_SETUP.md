# Firebase Setup Guide

This application has been migrated from Twilio to Firebase for phone number verification and authentication. Follow this guide to set up Firebase Phone Authentication and other Firebase services.

## Prerequisites

- A Google account
- A phone number that can receive SMS messages
- Node.js and npm installed

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "ScoreWise Cricket Scorer")
4. Enable Google Analytics (optional but recommended)
5. Choose or create a Google Analytics account
6. Click "Create project"

## 2. Enable Authentication

1. In your Firebase project console, click on "Authentication" in the left sidebar
2. Click on the "Get started" button
3. Go to the "Sign-in method" tab
4. Enable the following sign-in providers:

### Phone Authentication
1. Click on "Phone" in the sign-in providers list
2. Toggle the "Enable" switch
3. Click "Save"

### Google Authentication (Optional)
1. Click on "Google" in the sign-in providers list
2. Toggle the "Enable" switch
3. Enter your project's public-facing name
4. Enter your support email
5. Click "Save"

## 3. Configure Authorized Domains

1. In Authentication > Sign-in method, scroll down to "Authorized domains"
2. Add your domains:
   - For development: `localhost` (should already be there)
   - For production: your actual domain (e.g., `yourapp.com`)

## 4. Enable Firestore Database

1. Click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in production mode" (recommended)
4. Select a location for your database (choose closest to your users)
5. Click "Done"

## 5. Get Firebase Configuration

1. Click on the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. In the "General" tab, scroll down to "Your apps" section
4. If you haven't added a web app yet:
   - Click the "</>" (web) icon
   - Enter an app nickname (e.g., "ScoreWise Web")
   - Check "Also set up Firebase Hosting" (optional)
   - Click "Register app"
5. Copy the Firebase configuration object

## 6. Environment Variables Setup

Create a `.env` file in your project root with the following variables:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Where to find these values:

From the Firebase config object you copied, map the values:

```javascript
const firebaseConfig = {
  apiKey: "xxx",           → VITE_FIREBASE_API_KEY
  authDomain: "xxx",       → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "xxx",        → VITE_FIREBASE_PROJECT_ID
  storageBucket: "xxx",    → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "xxx", → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "xxx",            → VITE_FIREBASE_APP_ID
  measurementId: "xxx"     → VITE_FIREBASE_MEASUREMENT_ID
};
```

## 7. Firebase Security Rules

Set up security rules for Firestore to protect your data:

1. Go to Firestore Database > Rules
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow users to read/write groups they belong to
    match /groups/{groupId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.memberIds;
    }
    
    // Allow users to read/write matches they're involved in
    match /matches/{matchId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow users to read/write players they create
    match /players/{playerId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

## 8. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the application in your browser
3. Try to sign up with a phone number
4. You should see:
   - "Firebase SMS Verification Active" indicator
   - reCAPTCHA verification (invisible)
   - SMS with verification code sent to your phone

## 9. Troubleshooting

### Common Issues:

#### "Firebase Phone Auth service not configured"
- Ensure all environment variables are set correctly
- Restart your development server after adding env variables

#### "reCAPTCHA verification failed"
- Make sure your domain is in the authorized domains list
- Clear browser cache and cookies
- Try in an incognito/private window

#### "Invalid phone number format"
- Use international format: +1234567890
- Include country code
- Remove spaces, dashes, or parentheses

#### "SMS quota exceeded"
- Firebase has daily/monthly SMS limits
- Check your Firebase Console > Usage tab
- Consider upgrading to a paid plan if needed

#### "Auth domain not authorized"
- Add your domain to Authentication > Settings > Authorized domains
- For localhost, make sure localhost is in the list

### Development Mode

If you want to test without SMS:
1. Remove all Firebase environment variables
2. The app will fall back to development mode
3. OTP codes will be shown in browser alerts

## 10. Production Deployment

For production deployment:

1. **Set up Firebase Hosting** (optional):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   npm run build
   firebase deploy
   ```

2. **Environment Variables**: 
   - Set all Firebase environment variables in your hosting platform
   - Never commit `.env` files to version control

3. **Domain Configuration**:
   - Add your production domain to Firebase authorized domains
   - Update CORS settings if needed

## 11. Cost Information

### Firebase Pricing:
- **Authentication**: Free up to 10,000 phone verifications/month
- **Firestore**: Free tier includes 50K reads, 20K writes, 20K deletes per day
- **Hosting**: 10GB free storage, 360MB/day transfer

### After Free Tier:
- Phone auth: ~$0.006 per verification
- Firestore: Pay-as-you-go pricing
- Very cost-effective for most applications

## 12. Support and Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Phone Auth Guide](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase Status Page](https://status.firebase.google.com/)

## Migration from Twilio

This application has been fully migrated from Twilio to Firebase. Key changes:

- ✅ Phone verification via Firebase instead of Twilio
- ✅ No more Twilio API keys needed
- ✅ Integrated with existing Firebase setup
- ✅ reCAPTCHA protection included
- ✅ SMS-only (voice calls not supported)
- ✅ Better integration with Google services

The migration is complete and no Twilio setup is required anymore. 