"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export default function Providers({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    console.error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    return <div>Missing Clerk configuration</div>;
  }

  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      isSatellite={false}
      domain={process.env.NEXT_PUBLIC_CLERK_DOMAIN || ''}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
      appearance={{
        elements: {
          formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          footerActionLink: 'text-primary hover:text-primary/80',
        },
      }}
    >
      {children}
      <Toaster richColors position="top-right" />
    </ClerkProvider>
  );
}
