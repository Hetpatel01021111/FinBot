"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export default function Providers({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    // Soft warning in client; real enforcement happens server-side
    console.warn("Clerk publishable key is missing. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
      <Toaster richColors />
    </ClerkProvider>
  );
}
