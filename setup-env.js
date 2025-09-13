#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up FinBox environment variables...\n');

// Read the Firebase Admin SDK file
const firebaseAdminPath = path.join(__dirname, '../../../Downloads/FinBox Firebase Admin SDK.json');
let firebaseServiceAccount = '';

try {
  if (fs.existsSync(firebaseAdminPath)) {
    const adminSdk = JSON.parse(fs.readFileSync(firebaseAdminPath, 'utf8'));
    firebaseServiceAccount = JSON.stringify(adminSdk).replace(/\n/g, '\\n');
    console.log('✅ Found Firebase Admin SDK file');
  } else {
    console.log('⚠️  Firebase Admin SDK file not found at:', firebaseAdminPath);
  }
} catch (error) {
  console.log('⚠️  Could not read Firebase Admin SDK file:', error.message);
}

// Create .env.local with proper values
const envContent = `# Clerk Credentials - You need to get these from your Clerk Dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Firebase Credentials (from .env.example)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDea3WcN1NUhOUBuCrEUnUGguYssHzp5j8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=finbox-0111.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=finbox-0111
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=finbox-0111.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=400474650153
NEXT_PUBLIC_FIREBASE_APP_ID=1:400474650153:web:40fc5acc59f8b2b4bbce38
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-6H1NF8173Q

# Firebase Admin SDK Service Account Key
FIREBASE_SERVICE_ACCOUNT_KEY=${firebaseServiceAccount}

# Optional - For receipt scanning feature
GEMINI_API_KEY=

# Inngest Configuration (Optional - for background jobs)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Resend Email Configuration (Optional - for email notifications)
RESEND_API_KEY=

# Arcjet Security Configuration (Optional - for rate limiting)
ARCJET_KEY=

# Development settings
NODE_ENV=development
`;

// Write the .env.local file
fs.writeFileSync('.env.local', envContent);
console.log('✅ Created .env.local file with Firebase configuration');

if (!firebaseServiceAccount) {
  console.log('\n⚠️  IMPORTANT: Firebase Admin SDK key is missing!');
  console.log('   Please add your Firebase Admin SDK JSON to FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
}

console.log('\n🚨 NEXT STEPS:');
console.log('1. Get your Clerk keys from https://dashboard.clerk.com/');
console.log('2. Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local');
console.log('3. Restart your dev server: npm run dev');
console.log('\n🎉 Your app should now work properly!');
