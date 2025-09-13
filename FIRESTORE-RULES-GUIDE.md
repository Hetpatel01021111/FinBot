# Firestore Security Rules Setup for FinBox

## 🔥 Current Issue
Your Firestore rules are too restrictive and only allow access to `/users/{userId}` collections. FinBox needs access to multiple collections like `transactions`, `budgets`, etc.

## 📋 Updated Rules
I've created a new `firestore.rules` file with proper rules for your FinBox application. Here's what it allows:

### ✅ Allowed Operations:
- **Users**: Read/write own user document
- **Transactions**: Manage personal transactions
- **Budgets**: Manage personal budgets  
- **Accounts**: Manage personal accounts
- **Categories**: Manage personal categories
- **Server Operations**: Firebase Admin SDK access for API routes
- **Test Collection**: For development testing

## 🚀 How to Apply These Rules

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your `finbox-0111` project
3. Navigate to **Firestore Database** → **Rules**
4. Replace the current rules with the content from `firestore.rules`
5. Click **Publish**

### Option 2: Firebase CLI
```bash
# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init firestore

# Deploy the rules
firebase deploy --only firestore:rules
```

## 🔧 For Development Testing
If you need to test without authentication temporarily, uncomment this line in the rules:
```javascript
match /{document=**} { allow read, write: if true; }
```
**⚠️ IMPORTANT: Remove this before production deployment!**

## 🔐 Security Features
- Users can only access their own data
- Server-side operations (API routes) have full access via Firebase Admin
- All operations require authentication except for temporary testing

## 🧪 Test After Deployment
After updating the rules, test your Vercel deployment:
- Visit your deployed app
- Try creating transactions, budgets, etc.
- Check the `/api/test-db` endpoint

Your database should now work properly on Vercel!
