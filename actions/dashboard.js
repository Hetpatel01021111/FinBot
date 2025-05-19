"use server";

import aj from "@/lib/arcjet";
import { db, safeDbOperation } from "@/lib/prisma";
import { request } from "@arcjet/next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };
  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
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
    
    // Find or create user in our database
    const dbUser = await safeDbOperation(async () => {
      // First try to find the user
      const existingUser = await db.user.findUnique({
        where: { clerkUserId: userId },
      });
      
      if (existingUser) {
        console.log("Found existing user:", existingUser.id);
        return existingUser;
      }
      
      // If user doesn't exist, create a new one
      console.log("User not found, creating new user");
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "user@example.com";
      const name = clerkUser?.firstName ? 
        `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : 
        "New User";
      
      const newUser = await db.user.create({
        data: {
          clerkUserId: userId,
          email,
          name,
        },
      });
      
      console.log("Successfully created new user:", newUser.id);
      return newUser;
    });
    
    if (!dbUser) {
      console.error("Failed to find or create user");
      throw new Error("User not available");
    }
    
    // Get user accounts
    const accounts = await safeDbOperation(async () => {
      console.log("Fetching accounts for user:", dbUser.id);
      return db.account.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });
    });
    
    console.log(`Found ${accounts.length} accounts for user ${dbUser.id}`);
    
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
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL
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
    
    // Find or create user in our database with multiple retries
    let dbUser = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!dbUser && retryCount < maxRetries) {
      try {
        // First try to find the user
        const existingUser = await db.user.findUnique({
          where: { clerkUserId: userId },
        });
        
        if (existingUser) {
          console.log("Found existing user for account creation:", existingUser.id);
          dbUser = existingUser;
          break;
        }
        
        // If user doesn't exist, create a new one
        console.log("User not found, creating new user for account creation");
        const clerkUser = await currentUser().catch(err => {
          console.error("Error fetching Clerk user details:", err);
          return null;
        });
        
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "user@example.com";
        const name = clerkUser?.firstName ? 
          `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : 
          "New User";
        
        dbUser = await db.user.create({
          data: {
            clerkUserId: userId,
            email,
            name,
          },
        });
        
        console.log("Successfully created new user for account creation:", dbUser.id);
      } catch (error) {
        retryCount++;
        console.error(`Error finding/creating user (attempt ${retryCount}/${maxRetries}):`, error);
        
        // Wait before retrying
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }
    
    if (!dbUser) {
      console.error("Failed to find or create user after multiple attempts");
      return { success: false, error: "Database operation failed" };
    }
    
    // Create account with retry logic
    console.log("Creating new account for user:", dbUser.id);
    let account = null;
    retryCount = 0;
    
    while (!account && retryCount < maxRetries) {
      try {
        account = await db.account.create({
          data: {
            name: data.name,
            type: data.type,
            balance: parseFloat(data.balance || "0"),
            isDefault: data.isDefault || false,
            userId: dbUser.id,
            currency: data.currency || "USD",
          },
        });
        console.log("Successfully created account:", account.id);
      } catch (error) {
        retryCount++;
        console.error(`Error creating account (attempt ${retryCount}/${maxRetries}):`, error);
        
        // Wait before retrying
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }
    
    if (!account) {
      console.error("Failed to create account after multiple attempts");
      return { success: false, error: "Failed to create account after multiple attempts" };
    }

    // If this is the default account, update all other accounts
    if (data.isDefault) {
      console.log("Setting as default account, updating other accounts");
      try {
        await db.account.updateMany({
          where: {
            userId: dbUser.id,
            id: {
              not: account.id,
            },
          },
          data: {
            isDefault: false,
          },
        });
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
      accountId: account.id,
      message: "Account created successfully"
    };
  } catch (error) {
    console.error("Error creating account:", error);
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

    // Find user
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get recent transactions
    const transactions = await db.transaction.findMany({
      where: {
        account: {
          userId: user.id,
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 5,
      include: {
        account: true,
      },
    });

    // Serialize transactions
    const serializedTransactions = transactions.map(serializeTransaction);

    return serializedTransactions;
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    return [];
  }
}
