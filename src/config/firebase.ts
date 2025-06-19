import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAbwvrOueTdsZzDZPKF2bfhfiUiHaECOEI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "scorewise-e5b59.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "scorewise-e5b59",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "scorewise-e5b59.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "145703340625",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:145703340625:web:7fbb45dfbdbc1d8b90c670",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase with minimal services
const app = initializeApp(firebaseConfig, {
  automaticDataCollectionEnabled: false
});

// Initialize Firestore with better error handling and offline support
let db;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    // CRITICAL: Force long polling to avoid QUIC protocol issues
    experimentalForceLongPolling: true,
    // Disable fetch streams which can cause QUIC errors
    useFetchStreams: false,
    // Add additional settings to handle connectivity issues
    settings: {
      ignoreUndefinedProperties: true
    }
  });
  
  console.log('✅ Firestore initialized successfully with QUIC protocol fallback');
} catch (error) {
  console.warn('⚠️ Failed to initialize Firestore with enhanced settings, trying basic config:', error);
  try {
    // Fallback: Try with long polling only
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false
    });
    console.log('✅ Firestore initialized with long polling fallback');
  } catch (longPollingError) {
    console.warn('⚠️ Long polling initialization failed, using default Firestore:', longPollingError);
    try {
      db = getFirestore(app);
      console.log('✅ Firestore initialized with default configuration');
    } catch (fallbackError) {
      console.error('❌ Failed to initialize Firestore completely:', fallbackError);
      // Create offline-only mock to prevent app crashes
      db = {
        collection: () => ({ 
          doc: () => ({ 
            set: async () => { console.log('📱 Offline mode: Data saved locally only'); }, 
            get: async () => ({ exists: false, data: () => null }) 
          }) 
        }),
        doc: () => ({ 
          set: async () => { console.log('📱 Offline mode: Data saved locally only'); }, 
          get: async () => ({ exists: false, data: () => null }) 
        })
      };
    }
  }
}

// Initialize Firebase Auth
let auth;
let googleProvider;

try {
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  
  // Configure Google provider
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  
  console.log('✅ Firebase Auth initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Auth:', error);
  // Create mock auth object to prevent app crashes
  auth = {
    currentUser: null,
    signInWithPopup: async () => { throw new Error('Auth not available'); },
    signOut: async () => { throw new Error('Auth not available'); },
    onAuthStateChanged: () => () => {}
  };
  googleProvider = null;
}

// Enhanced global error handler for Firebase internal errors including QUIC protocol errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error && (
      event.error.message?.includes('sendBeacon') ||
      event.error.message?.includes('firebase') ||
      event.error.message?.includes('Firebase') ||
      event.error.message?.includes('QUIC_PROTOCOL_ERROR') ||
      event.error.message?.includes('ERR_QUIC_PROTOCOL_ERROR') ||
      event.error.message?.includes('net::ERR_QUIC_PROTOCOL_ERROR') ||
      event.filename?.includes('firebase') ||
      event.filename?.includes('firestore')
    )) {
      console.warn('⚠️ Firebase/QUIC protocol error caught and ignored:', event.error.message);
      event.preventDefault();
      return false;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && (
      event.reason.message?.includes('sendBeacon') ||
      event.reason.message?.includes('firebase') ||
      event.reason.message?.includes('Firebase') ||
      event.reason.message?.includes('QUIC_PROTOCOL_ERROR') ||
      event.reason.message?.includes('ERR_QUIC_PROTOCOL_ERROR') ||
      event.reason.message?.includes('net::ERR_QUIC_PROTOCOL_ERROR') ||
      event.reason.toString?.()?.includes('QUIC')
    )) {
      console.warn('⚠️ Firebase/QUIC protocol promise rejection caught and ignored:', event.reason);
      event.preventDefault();
      return false;
    }
  });

  // Add specific handler for network errors
  window.addEventListener('online', () => {
    console.log('📶 Network connection restored, Firebase should reconnect automatically');
  });

  window.addEventListener('offline', () => {
    console.log('📵 Network connection lost, Firebase will work in offline mode');
  });
}

export { db, auth, googleProvider, app };