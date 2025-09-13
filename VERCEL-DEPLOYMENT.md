# Vercel Deployment Guide for FinBox

This guide provides step-by-step instructions for deploying the FinBox application to Vercel with Firebase integration.

## Prerequisites

- Vercel account
- Firebase project
- Clerk authentication setup

## 1. Environment Variables

Add the following environment variables to your Vercel project:

### Firebase Configuration
```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Firebase Admin SDK

1. Generate a new private key from Firebase Console:
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Copy the contents of the JSON file

2. Add the service account key as a Vercel environment variable:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
   ```
   
   **Important:** The entire JSON must be on a single line with escaped quotes.

### Clerk Configuration
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## 2. Vercel Project Settings

1. **Framework Preset**: Next.js
2. **Build Command**: `npm run build`
3. **Output Directory**: `.next`
4. **Install Command**: `npm install`
5. **Node.js Version**: 18.x

## 3. Deployment Configuration

The project includes a `vercel.json` file with optimized settings for Firebase and Next.js. No additional configuration should be needed.

## 4. Important Notes

1. **Firebase Admin**: The service account key is required for server-side operations. Ensure it's properly formatted in Vercel environment variables.

2. **CORS**: CORS is configured in `middleware.js` to allow requests from your Vercel domain.

3. **Environment Variables**: All environment variables must be prefixed with `NEXT_PUBLIC_` to be available in the browser.

## 5. Troubleshooting

### Common Issues

1. **Firebase Initialization Errors**:
   - Verify all Firebase environment variables are set
   - Check the service account key format in Vercel
   - Ensure the service account has the correct permissions in Firebase

2. **CORS Issues**:
   - Check the `Access-Control-Allow-Origin` header in the response
   - Verify the middleware is properly configured

3. **Authentication Issues**:
   - Verify Clerk credentials
   - Check Firebase Authentication rules
   - Ensure the Firebase project has the correct authentication providers enabled

## 6. Support

For additional help, please contact the development team or refer to the project documentation.
