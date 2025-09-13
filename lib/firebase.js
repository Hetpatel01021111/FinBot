import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';

// Client-side Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check if we're on the server or client
const isServer = typeof window === 'undefined';

// Client-side only initialization
let app;
let db;
let auth;
let storage;

if (!isServer) {
  try {
    // Initialize Firebase app if it doesn't exist
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // Initialize Firestore with settings
    db = getFirestore(app);
    
    // Initialize Auth with session persistence
    auth = getAuth(app);
    setPersistence(auth, browserSessionPersistence).catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
    
    // Initialize Storage
    storage = getStorage(app);
    
    // Connect to emulators in development
    if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === 'true') {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectAuthEmulator(auth, 'http://localhost:9099');
      connectStorageEmulator(storage, 'localhost', 9199);
      console.log('Connected to Firebase emulators');
    }
    
    console.log('Firebase client initialized successfully');
  } catch (error) {
    console.error('Firebase client initialization error:', error);
    // Don't throw in production to prevent app from breaking
    if (process.env.NODE_ENV !== 'production') {
      throw error;
    }
  }
}

// Export the client-side instances
export { db, auth, storage };

// Analytics only in the browser
export const analytics = (async () => {
  if (isServer) return null;
  try {
    const supported = await analyticsIsSupported();
    return supported ? getAnalytics(app) : null;
  } catch (e) {
    return null;
  }
})();
