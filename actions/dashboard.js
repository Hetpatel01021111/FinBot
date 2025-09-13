"use server";

import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db as firestore } from "@/lib/firebase";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };
  
  // Convert Firestore Timestamps to ISO strings
  if (serialized.date && typeof serialized.date.toDate === 'function') {
    serialized.date = serialized.date.toDate().toISOString();
  } else if (serialized.date instanceof Date) {
    serialized.date = serialized.date.toISOString();
  }
  
  if (serialized.createdAt && typeof serialized.createdAt.toDate === 'function') {
    serialized.createdAt = serialized.createdAt.toDate().toISOString();
  } else if (serialized.createdAt instanceof Date) {
    serialized.createdAt = serialized.createdAt.toISOString();
  }
  
  if (serialized.nextRecurringDate && typeof serialized.nextRecurringDate.toDate === 'function') {
    serialized.nextRecurringDate = serialized.nextRecurringDate.toDate().toISOString();
  } else if (serialized.nextRecurringDate instanceof Date) {
    serialized.nextRecurringDate = serialized.nextRecurringDate.toISOString();
  }
  
  return serialized;
};

export async function getUserAccounts() {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      console.error("No authenticated user found");
      throw new Error("Unauthorized");
    }
    
    console.log("Authenticated userId:", userId);
    
    // Try to get additional user details from Clerk
    const clerkUser = await currentUser();
    console.log("Clerk user details:", clerkUser ? 
      { id: clerkUser.id, email: clerkUser.emailAddresses?.[0]?.emailAddress } : 
      "No clerk user details");
    
    // Get user accounts from Firestore
    const accountsSnap = await firestore.collection("users").doc(userId).collection("accounts").get();
    const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log(`Found ${accounts.length} accounts for user ${userId}`);
    
    // Serialize accounts before sending to client
    const serializedAccounts = accounts.map(serializeTransaction);
    return serializedAccounts;
  } catch (error) {
    console.error("Error in getUserAccounts:", error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
  }
}

export async function createAccount(data) {
  try {
    console.log("Starting account creation with data:", { ...data, balance: data.balance ? 'REDACTED' : undefined });
    console.log("Environment check:", { 
      environment: process.env.NODE_ENV,
      hasFirebase: true,
    });
    
    // Validate input data
    if (!data || !data.name || !data.type) {
      console.error("Invalid account data provided:", { ...data, balance: data.balance ? 'REDACTED' : undefined });
      return { success: false, error: "Missing required account information" };
    }
    
    // Get authenticated user ID from Clerk
    const authResult = await auth().catch(err => {
      console.error("Auth error during account creation:", err);
      return { userId: null, error: err };
    });
    
    const userId = authResult.userId;
    if (!userId) {
      console.error("No authenticated user found during account creation");
      return { success: false, error: "Authentication required" };
    }
    
    console.log("Authenticated userId for account creation:", userId);

    // **DEBUGGING**: Log the data payload before writing to Firestore
    const accountPayload = {
      name: data.name,
      type: data.type,
      balance: Number(data.balance || 0),
      isDefault: !!data.isDefault,
      createdAt: new Date().toISOString(),
    };
    console.log("Attempting to write to Firestore with payload:", accountPayload);
    
    // Create account doc in Firestore
    const accountsRef = firestore.collection("users").doc(userId).collection("accounts");
    const newAccountRef = accountsRef.doc();
    await newAccountRef.set(accountPayload);
    console.log(`Successfully wrote to Firestore for document ID: ${newAccountRef.id}`);

    // If this is the default account, update all other accounts
    if (data.isDefault) {
      console.log("Setting as default account, updating other accounts");
      try {
        const accountsSnap = await accountsRef.get();
        const batch = firestore.batch();
        accountsSnap.forEach(doc => {
          if (doc.id !== newAccountRef.id && doc.data().isDefault) {
            batch.update(doc.ref, { isDefault: false });
          }
        });
        await batch.commit();
      } catch (updateError) {
        // Non-critical error, just log it
        console.error("Error updating other accounts:", updateError);
        // Continue execution, this shouldn't prevent account creation
      }
    }

    console.log("Account creation completed successfully");
    
    // Revalidate paths
    try {
      revalidatePath("/dashboard");
      revalidatePath("/account");
    } catch (revalidateError) {
      console.error("Error revalidating paths:", revalidateError);
      // Non-critical error, continue
    }
    
    return { 
      success: true, 
      accountId: newAccountRef.id,
      message: "Account created successfully"
    };
  } catch (error) {
    console.error("Error creating account in catch block:", error);
    // Return a more user-friendly error message with detailed logging
    return { 
      success: false, 
      error: error.message || "Failed to create account. Please try again.",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
}

export async function getDashboardData() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get recent transactions
    const accountsSnap = await firestore.collection("users").doc(userId).collection("accounts").get();
    const all = [];
    for (const acc of accountsSnap.docs) {
      const txSnap = await acc.ref.collection("transactions").get();
      txSnap.forEach((d) => all.push({ id: d.id, ...d.data(), account: { id: acc.id, ...acc.data() } }));
    }
    const transactions = all.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    // Serialize transactions
    const serializedTransactions = transactions.map(serializeTransaction);

    return serializedTransactions;
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    return [];
  }
}
