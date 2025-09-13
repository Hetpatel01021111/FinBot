import admin from 'firebase-admin';

// This prevents multiple initializations in development
const getFirebaseAdmin = () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  if (admin.apps.length > 0) {
    return {
      auth: admin.auth,
      firestore: admin.firestore,
      storage: admin.storage,
      app: admin.app(),
    };
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      storageBucket: `${serviceAccount.project_id}.appspot.com`
    }, '[SERVER]');

    // Configure Firestore
    const firestore = admin.firestore();
    firestore.settings({
      ignoreUndefinedProperties: true,
    });

    console.log('Firebase Admin initialized successfully');
    
    return {
      auth: admin.auth,
      firestore,
      storage: admin.storage(),
      app,
    };
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
};

// Export a singleton instance
export const firebaseAdmin = getFirebaseAdmin();

export default firebaseAdmin;
