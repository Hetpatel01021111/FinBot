import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';
import admin from 'firebase-admin';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Helper to check if we are on the server
const isServer = typeof window === 'undefined';

// Initialize Firebase Admin SDK on the server
if (isServer && admin.apps.length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Initialize Firebase Client SDK on the client
let app = null;
if (!isServer) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

// Export Firestore instance based on environment
export const db = isServer ? admin.firestore() : getFirestore(app);

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
