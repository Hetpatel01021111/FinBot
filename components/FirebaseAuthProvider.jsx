"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const FirebaseAuthContext = createContext({});

export function useFirebaseAuth() {
  return useContext(FirebaseAuthContext);
}

export function FirebaseAuthProvider({ children }) {
  const { userId, getToken, isLoaded } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};

    const signIntoFirebase = async () => {
      if (!isLoaded) return;
      
      try {
        setLoading(true);
        setError(null);

        if (userId) {
          // Get Firebase custom token from our API
          const response = await fetch('/api/auth/generate-token', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to get Firebase token');
          }

          const { token } = await response.json();
          
          // Sign in to Firebase with the custom token
          const userCredential = await signInWithCustomToken(auth, token);
          setFirebaseUser(userCredential.user);
        } else {
          // Sign out from Firebase if no Clerk user
          await signOut(auth);
          setFirebaseUser(null);
        }
      } catch (error) {
        console.error('Firebase auth error:', error);
        setError(error.message);
        setFirebaseUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Set up Firebase auth state listener
    if (auth) {
      unsubscribe = auth.onAuthStateChanged((user) => {
        setFirebaseUser(user);
        if (!userId && user) {
          // If Clerk user is signed out but Firebase user exists, sign out from Firebase
          signOut(auth);
        }
      });
    }

    signIntoFirebase();

    return () => unsubscribe();
  }, [userId, isLoaded]);

  const value = {
    firebaseUser,
    loading,
    error,
    isAuthenticated: !!firebaseUser,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}
