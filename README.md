# ScoreWise - Cricket Scoring App

A comprehensive cricket scoring application with real-time scoring, player statistics, and group management.

## Features

- **🎯 Smart Player Recommendations**: Intelligent suggestions for batting, bowling, and fielding based on player stats and match context
- **Real-time Cricket Scoring**: Professional-grade ball-by-ball scoring
- **Phone Number Verification**: Production-ready SMS/Voice OTP via multiple providers
- **Group Management**: Create and manage cricket groups with member invitations
- **Standalone Mode**: Score matches without groups for personal tracking
- **Player Statistics**: Comprehensive batting, bowling, and fielding statistics
- **Cloud Sync**: Firebase integration for data backup and synchronization
- **Offline Support**: Works offline with automatic sync when online
- **PDF Export**: Generate and share detailed scorecards
- **📊 Advanced Analytics**: Performance tracking with recommendation system
- **Responsive Design**: Works on all devices

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd scorewise
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

### 3. SMS/OTP Service Setup

ScoreWise supports multiple SMS providers. Choose one based on your needs:

#### Option A: Development Mode (Recommended for Testing)
Remove or comment out all SMS provider environment variables in your `.env` file:
```env
# VITE_TWILIO_ACCOUNT_SID=your_account_sid_here
# VITE_TWILIO_AUTH_TOKEN=your_auth_token_here
# VITE_TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid_here
```

In development mode:
- OTP codes will be shown in browser alerts instead of SMS
- All other features work normally
- Perfect for testing without SMS costs
- Members can still be added to groups and participate in matches

#### Option B: Twilio (Premium - Paid Service)

**⚠️ Important: Twilio Trial Account Limitations**

If you're using a Twilio trial account, you can only send SMS to verified phone numbers.

1. **Create a Twilio Account**
   - Go to [Twilio Console](https://console.twilio.com/)
   - Sign up for a free account (includes $15 credit)

2. **Get Your Credentials**
   - Account SID: Found on your Twilio Console Dashboard
   - Auth Token: Found on your Twilio Console Dashboard (click to reveal)

3. **Create a Verify Service**
   - Go to [Verify Services](https://console.twilio.com/us1/develop/verify/services)
   - Click "Create new Service"
   - Give it a name (e.g., "ScoreWise Verification")
   - Copy the Service SID

4. **Configure Environment Variables**
   ```env
   VITE_TWILIO_ACCOUNT_SID=your_account_sid_here
   VITE_TWILIO_AUTH_TOKEN=your_auth_token_here
   VITE_TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid_here
   ```

#### Option C: Free SMS Alternatives

Here are some **FREE** SMS service alternatives to Twilio:

##### 1. **Firebase Phone Auth (Google) - FREE**
- **Cost**: Free for up to 10,000 verifications/month
- **Setup**: 
  ```bash
  npm install firebase
  ```
- **Pros**: Reliable, Google-backed, generous free tier
- **Cons**: Requires Firebase project setup
- **Documentation**: [Firebase Phone Auth](https://firebase.google.com/docs/auth/web/phone-auth)

##### 2. **AWS SNS (Amazon) - FREE Tier**
- **Cost**: Free for first 100 SMS/month, then $0.0075 per SMS
- **Setup**: AWS account required
- **Pros**: Part of AWS ecosystem, reliable
- **Cons**: Requires AWS setup
- **Documentation**: [AWS SNS](https://aws.amazon.com/sns/)

##### 3. **Vonage (Nexmo) - FREE Credits**
- **Cost**: €2 free credit (covers ~130 SMS)
- **Setup**: Simple API integration
- **Pros**: Easy to use, good documentation
- **Cons**: Limited free credits
- **Documentation**: [Vonage SMS API](https://developer.vonage.com/messaging/sms/overview)

##### 4. **MessageBird - FREE Credits**
- **Cost**: €20 free credit for new accounts
- **Setup**: API key based
- **Pros**: Generous free credits, reliable
- **Cons**: Credit-based system
- **Documentation**: [MessageBird SMS](https://developers.messagebird.com/api/sms-messaging/)

##### 5. **Textlocal - FREE Credits**
- **Cost**: Free credits for testing (varies by region)
- **Setup**: Regional availability
- **Pros**: Good for specific regions
- **Cons**: Limited regional coverage
- **Documentation**: [Textlocal API](https://www.textlocal.com/documentation/)

##### 6. **SMSGlobal - FREE Trial**
- **Cost**: Free trial credits
- **Setup**: API integration
- **Pros**: Global coverage
- **Cons**: Trial limitations
- **Documentation**: [SMSGlobal API](https://www.smsglobal.com/rest-api/)

##### 7. **Plivo - FREE Credits**
- **Cost**: $20 free trial credit
- **Setup**: Similar to Twilio
- **Pros**: Twilio alternative, good pricing
- **Cons**: Credit-based
- **Documentation**: [Plivo SMS](https://www.plivo.com/docs/sms/)

##### 8. **46elks - FREE Credits**
- **Cost**: $2 free credit
- **Setup**: Simple API
- **Pros**: European-based, GDPR compliant
- **Cons**: Limited free credits
- **Documentation**: [46elks SMS](https://46elks.com/docs)

##### 9. **Sinch - FREE Trial**
- **Cost**: Free trial available
- **Setup**: API integration
- **Pros**: Good for global reach
- **Cons**: Trial limitations
- **Documentation**: [Sinch SMS](https://developers.sinch.com/docs/sms/)

##### 10. **ClickSend - FREE Credits**
- **Cost**: $5 free credit for new accounts
- **Setup**: API-based
- **Pros**: Multiple communication channels
- **Cons**: Credit-based system
- **Documentation**: [ClickSend SMS](https://developers.clicksend.com/docs/rest/v3/)

#### Recommended Free Options:

1. **For Development/Testing**: Use Development Mode (no SMS service needed)
2. **For Production with Budget**: Firebase Phone Auth (10,000 free/month)
3. **For Quick Setup**: MessageBird or Plivo (generous free credits)
4. **For AWS Users**: AWS SNS (if already using AWS)

#### Implementation Notes:

To switch from Twilio to another provider, you would need to:

1. Update the `twilioService.ts` file to support the new provider's API
2. Modify the authentication flow in `authService.ts`
3. Update environment variables accordingly

The current codebase is designed with Twilio but can be easily adapted to any SMS provider by modifying the service layer.

### 4. Firebase Setup (Cloud Storage)

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project

2. **Enable Firestore**
   - Go to Firestore Database
   - Create database in production mode

3. **Get Configuration**
   - Go to Project Settings > General
   - Add a web app
   - Copy the configuration values

4. **Configure Environment Variables**
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### 5. Run the Application

```bash
npm run dev
```

## Phone Number Format Requirements

When adding members by phone number, ensure proper formatting:

- **US Numbers**: `+1234567890` or `1234567890` (will auto-format to +1)
- **International**: Include country code, e.g., `+44123456789` (UK), `+91123456789` (India)
- **Invalid Examples**: `123-456-7890`, `(123) 456-7890` (will be auto-formatted)

## Match Types

### Group Matches
- Associated with your cricket group
- Count towards group leaderboards and statistics
- Require group membership
- Full team management features

### Standalone Matches
- Personal matches not associated with any group
- Count towards personal statistics only
- Perfect for casual games or practice
- No group membership required
- Clearly marked with disclaimers

## Production Deployment

### Environment Variables for Production

Ensure all environment variables are set in your production environment:

```env
# SMS Service (Choose one - see options above)
VITE_TWILIO_ACCOUNT_SID=your_production_account_sid
VITE_TWILIO_AUTH_TOKEN=your_production_auth_token
VITE_TWILIO_VERIFY_SERVICE_SID=your_production_verify_service_sid

# Firebase (Required for cloud sync)
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_production_auth_domain
VITE_FIREBASE_PROJECT_ID=your_production_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_production_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_production_sender_id
VITE_FIREBASE_APP_ID=your_production_app_id
```

### Build for Production

```bash
npm run build
```

## Features Overview

### Phone Number Verification
- **Production**: Uses your chosen SMS provider for verification
- **Development**: Shows OTP in browser alerts for testing
- **Security**: Automatic rate limiting and attempt tracking
- **Reliability**: Fallback options available

### Cricket Scoring
- **Ball-by-ball scoring**: Complete ball tracking with commentary
- **STRICT format enforcement**: Exactly N overs, no more, no less
- **Real-time statistics**: Live batting, bowling, and fielding stats
- **Professional features**: Fall of wickets, extras, partnerships

### Group Management
- **Create Groups**: Set up cricket teams/clubs
- **Invite Members**: Email and phone-based invitations
- **Role Management**: Admin and member permissions
- **Guest Access**: Allow non-members to view statistics

### Data Management
- **Local Storage**: IndexedDB for offline functionality
- **Cloud Sync**: Firebase Firestore for backup and sync
- **Export Options**: PDF scorecards and statistics
- **Data Safety**: Automatic backups and recovery

## Troubleshooting

### SMS Service Issues

#### "Invalid parameter 'To'" or "Invalid phone number format"
- **Cause**: Phone number is not in the correct international format
- **Solution**: 
  - Use international format: `+1234567890` (US), `+44123456789` (UK)
  - Or remove SMS credentials from `.env` to use development mode
  - The app will auto-format common US numbers (10 digits → +1 prefix)

#### "The phone number is unverified" (Twilio Trial)
- **Cause**: Twilio trial accounts can only send SMS to verified phone numbers
- **Solutions**:
  1. **For Development**: Remove Twilio credentials from `.env` file to enable development mode
  2. **For Production**: 
     - Verify the phone number in [Twilio Console > Verified Caller IDs](https://console.twilio.com/us1/develop/phone-numbers/manage/verified)
     - Or upgrade to a paid Twilio account
     - Or switch to a free alternative like Firebase Phone Auth

#### "OTP could not be sent" but member was still added
- **Cause**: SMS service configuration issue, but group functionality continues to work
- **Impact**: Member can still participate in matches and appear in statistics
- **Solution**: They can sign up later with their phone number to verify their account

### Firebase Issues
- **Connection failed**: Check Firebase configuration
- **Permission denied**: Ensure Firestore rules allow read/write
- **Quota exceeded**: Monitor Firebase usage in console

### Development Mode
- **OTP not showing**: Check browser console for errors
- **Features missing**: Some features require authentication

## Development vs Production Modes

### Development Mode (No SMS Service)
- ✅ OTP codes shown in browser alerts
- ✅ All group management features work
- ✅ Members can be added and participate in matches
- ✅ No SMS costs or phone number restrictions
- ✅ Perfect for testing and development

### Production Mode (With SMS Service)
- ✅ Real SMS/Voice OTP delivery
- ⚠️ Trial accounts: Only verified numbers can receive SMS (Twilio)
- ⚠️ Costs may apply for SMS messages (varies by provider)
- ✅ Professional user experience

## Support

For issues and questions:
1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. For SMS issues, try development mode first (remove credentials from .env)
4. Ensure phone numbers are in international format (+1234567890)
5. For trial accounts, verify phone numbers in provider console

## Security Notes

- **Environment Variables**: Never commit .env files to version control
- **API Keys**: Use different keys for development and production
- **Rate Limiting**: Most SMS providers provide built-in protection against abuse
- **Data Privacy**: All user data is stored securely with proper encryption
- **Development Mode**: Safe for testing without exposing real phone numbers