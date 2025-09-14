"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { FirebaseAuthProvider } from "@/components/FirebaseAuthProvider";

export default function Providers({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // If no valid Clerk key, render app without authentication
  if (!publishableKey || publishableKey === 'pk_test_Y2xlcmstdGVzdC1rZXk' || publishableKey.includes('your_key_here')) {
    console.warn("Clerk not configured - running without authentication");
    return (
      <div>
        <FirebaseAuthProvider>
          {children}
        </FirebaseAuthProvider>
        <Toaster richColors position="top-right" />
        <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded shadow-lg">
          <p className="text-sm">⚠️ Authentication disabled - Configure Clerk keys</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      isSatellite={false}
      domain={process.env.NEXT_PUBLIC_CLERK_DOMAIN || ''}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard"
    >
      <FirebaseAuthProvider>
        {children}
      </FirebaseAuthProvider>
      <Toaster richColors position="top-right" />
    </ClerkProvider>
  );
}
