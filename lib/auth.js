"use server";

import { auth as clerkAuth } from "@clerk/nextjs/server";

export async function getAuth() {
  try {
    const { userId } = clerkAuth();
    if (!userId) {
      throw new Error("Unauthorized - No user ID found");
    }
    return { userId };
  } catch (error) {
    console.error("Authentication error:", error);
    throw new Error("Authentication failed");
  }
}
