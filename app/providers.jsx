"use client";

import { Toaster } from "sonner";
import { FirebaseAuthProvider } from "@/components/FirebaseAuthProvider";

export default function Providers({ children }) {
  return (
    <FirebaseAuthProvider>
      {children}
      <Toaster richColors position="top-right" />
    </FirebaseAuthProvider>
  );
}
