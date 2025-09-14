import admin from 'firebase-admin';

// Lazy, safe initialization: do not throw at import time during Next.js build
export function ensureFirebaseAdminInitialized() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    // Defer error until a consumer actually needs admin in a runtime context
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set for Firebase Admin initialization');
  }

  const serviceAccount = JSON.parse(key);
  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  }, '[SERVER]');

  // Configure Firestore defaults
  const firestore = admin.firestore();
  firestore.settings({ ignoreUndefinedProperties: true });

  return app;
}

export function getAdminAuth() {
  const app = ensureFirebaseAdminInitialized();
  return admin.auth(app);
}

export function getAdminFirestore() {
  const app = ensureFirebaseAdminInitialized();
  return admin.firestore(app);
}

export function getAdminStorage() {
  const app = ensureFirebaseAdminInitialized();
  return admin.storage(app);
}

export default admin;
