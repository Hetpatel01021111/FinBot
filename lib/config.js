// Environment variable validation
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
];

// Check for missing environment variables in development
if (process.env.NODE_ENV !== 'production') {
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] && !process.env[`NEXT_PUBLIC_${varName}`]
  );

  if (missingVars.length > 0) {
    console.warn('Missing required environment variables:', missingVars.join(', '));
    console.warn('Please check your .env.local file or Vercel environment variables');
  }
}

// Export environment variables with fallbacks
export const env = {
  // Firebase
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
      : null,
  },
  
  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // API
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  
  // Feature flags
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableEmulator: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === 'true',
};

// Validate service account in production
if (env.isProduction && !env.firebase.serviceAccount) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY is required in production');
  // Don't throw here to allow the app to run in development without service account
  if (env.isProduction) {
    throw new Error('Missing Firebase service account configuration');
  }
}

export default env;
