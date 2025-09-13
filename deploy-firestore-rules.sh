#!/bin/bash

echo "🔥 Deploying Firestore Rules for FinBox..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Login to Firebase (if not already logged in)
echo "🔐 Checking Firebase authentication..."
firebase login --no-localhost

# Set the project
echo "📋 Setting Firebase project to finbox-0111..."
firebase use finbox-0111

# Deploy only Firestore rules
echo "🚀 Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo "✅ Firestore rules deployed successfully!"
echo "🧪 Test your Vercel deployment now - database should work!"
