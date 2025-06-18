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
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
  
  console.log('✅ Firestore initialized successfully with persistent cache');
} catch (error) {
  console.warn('⚠️ Failed to initialize Firestore with persistent cache, falling back to default:', error);
  try {
    db = getFirestore(app);
    console.log('✅ Firestore initialized with default configuration');
  } catch (fallbackError) {
    console.error('❌ Failed to initialize Firestore completely:', fallbackError);
    db = {
      collection: () => ({ doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => null }) }) }),
      doc: () => ({ set: async () => {}, get: async () => ({ exists: false, data: () => null }) })
    };
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

// Add global error handler for Firebase internal errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error && (
      event.error.message?.includes('sendBeacon') ||
      event.error.message?.includes('firebase') ||
      event.error.message?.includes('Firebase') ||
      event.filename?.includes('firebase')
    )) {
      console.warn('⚠️ Firebase internal error caught and ignored:', event.error);
      event.preventDefault();
      return false;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && (
      event.reason.message?.includes('sendBeacon') ||
      event.reason.message?.includes('firebase') ||
      event.reason.message?.includes('Firebase')
    )) {
      console.warn('⚠️ Firebase promise rejection caught and ignored:', event.reason);
      event.preventDefault();
      return false;
    }
  });
}

export { db, auth, googleProvider, app };