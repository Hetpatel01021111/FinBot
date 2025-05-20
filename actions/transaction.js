"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
// Using OpenAI compatible client for Perplexity API
import OpenAI from "openai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

// Initialize OpenAI client with Perplexity API
// Explicitly check for API key to avoid the OPENAI_API_KEY environment variable error
const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
if (!perplexityApiKey) {
  console.error("Missing PERPLEXITY_API_KEY environment variable");
}

const perplexity = new OpenAI({
  apiKey: perplexityApiKey || "dummy-key", // Provide a fallback to prevent initialization errors
  baseURL: "https://api.perplexity.ai"
});

const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

// Create Transaction
export async function createTransaction(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await aj.protect(req, {
      userId,
      requested: 1, // Specify how many tokens to consume
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Calculate new balance
    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = account.balance.toNumber() + balanceChange;

    // Create transaction and update account balance
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });

      return newTransaction;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  try {
    console.log("Updating transaction with ID:", id, "and data:", { ...data, amount: data.amount ? 'REDACTED' : undefined });
    
    const { userId } = await auth();
    if (!userId) {
      console.error("Unauthorized attempt to update transaction");
      return { success: false, error: "Unauthorized" };
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      console.error("User not found during transaction update");
      return { success: false, error: "User not found" };
    }

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) {
      console.error("Transaction not found with ID:", id);
      return { success: false, error: "Transaction not found" };
    }

    console.log("Found original transaction:", { 
      id: originalTransaction.id, 
      type: originalTransaction.type,
      accountId: originalTransaction.accountId
    });

    // Parse amount to ensure it's a number
    const parsedAmount = parseFloat(data.amount);
    if (isNaN(parsedAmount)) {
      console.error("Invalid amount provided for transaction update");
      return { success: false, error: "Invalid amount" };
    }

    // Calculate balance changes
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE" ? -parsedAmount : parsedAmount;

    const netBalanceChange = newBalanceChange - oldBalanceChange;
    console.log("Balance change calculation:", { oldBalanceChange, newBalanceChange, netBalanceChange });

    // Prepare update data
    const updateData = {
      type: data.type,
      amount: parsedAmount,
      description: data.description,
      date: new Date(data.date),
      category: data.category,
      isRecurring: data.isRecurring || false,
      accountId: data.accountId,
    };

    // Add recurring interval if present
    if (data.isRecurring && data.recurringInterval) {
      updateData.recurringInterval = data.recurringInterval;
      updateData.nextRecurringDate = calculateNextRecurringDate(new Date(data.date), data.recurringInterval);
    }

    console.log("Prepared update data:", { ...updateData, amount: 'REDACTED' });

    // Update transaction and account balance in a transaction
    try {
      const transaction = await db.$transaction(async (tx) => {
        // Update transaction
        const updated = await tx.transaction.update({
          where: {
            id,
          },
          data: updateData,
        });

        // Update account balance if account ID changed or amount changed
        if (originalTransaction.accountId !== data.accountId) {
          // If account changed, update both old and new account balances
          await tx.account.update({
            where: { id: originalTransaction.accountId },
            data: {
              balance: {
                decrement: oldBalanceChange,
              },
            },
          });

          await tx.account.update({
            where: { id: data.accountId },
            data: {
              balance: {
                increment: newBalanceChange,
              },
            },
          });
        } else {
          // Same account, just update the net difference
          await tx.account.update({
            where: { id: data.accountId },
            data: {
              balance: {
                increment: netBalanceChange,
              },
            },
          });
        }

        return updated;
      });

      console.log("Transaction updated successfully:", transaction.id);

      // Revalidate paths
      revalidatePath("/dashboard");
      revalidatePath(`/account/${data.accountId}`);
      if (originalTransaction.accountId !== data.accountId) {
        revalidatePath(`/account/${originalTransaction.accountId}`);
      }

      return { success: true, data: serializeAmount(transaction) };
    } catch (txError) {
      console.error("Error in transaction update:", txError);
      return { success: false, error: txError.message || "Failed to update transaction" };
    }
  } catch (error) {
    console.error("Unexpected error in updateTransaction:", error);
    return { success: false, error: error.message || "An unexpected error occurred" };
  }
}

// Get User Transactions
export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        ...query,
      },
      include: {
        account: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return { success: true, data: transactions };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Scan Receipt
export async function scanReceipt(file) {
  try {
    console.log("Starting receipt scan process", { fileType: file.type, fileSize: file.size });
    
    // For debugging purposes, log the environment variables (without revealing the actual key)
    console.log("Environment check:", { 
      hasPerplexityKey: !!process.env.PERPLEXITY_API_KEY,
      keyLength: process.env.PERPLEXITY_API_KEY ? process.env.PERPLEXITY_API_KEY.length : 0
    });
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    console.log("Converted image to base64", { base64Length: base64String.length });
    
    // Fallback approach - if the image is too large or complex, return default values
    if (file.size > 5000000) { // 5MB limit
      console.log("File too large, using fallback approach");
      return {
        amount: 0,
        date: new Date(),
        description: "Receipt scan (manual entry required)",
        category: "other-expense",
        merchantName: "Unknown",
      };
    }
    
    // System prompt for receipt analysis - simplified for better reliability
    const systemPrompt = `You are a receipt analysis assistant. Extract information from receipt images and return ONLY valid JSON.`;
    
    const userPrompt = `
      Analyze this receipt image and extract:
      - Total amount (number)
      - Date (ISO format)
      - Brief description of purchase
      - Merchant/store name
      - Category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense)
      
      Return ONLY valid JSON in this format:
      {"amount": number, "date": "ISO string", "description": "string", "merchantName": "string", "category": "string"}
      
      If you can't identify the receipt clearly, return: {"amount": 0, "date": "2025-05-19T00:00:00.000Z", "description": "Unknown receipt", "merchantName": "Unknown", "category": "other-expense"}
    `;

    // Create messages for Perplexity API
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${file.type};base64,${base64String}`
            }
          }
        ]
      }
    ];

    console.log("Calling Perplexity API...");
    
    try {
      // Call Perplexity API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const result = await perplexity.chat.completions.create({
        model: "sonar-pro",
        messages: messages,
        temperature: 0.1, // Lower temperature for more deterministic results
        max_tokens: 500,  // Limit response size
      }, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      console.log("Received response from Perplexity API");
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error("Invalid response structure from API", result);
        return {
          amount: 0,
          date: new Date(),
          description: "Receipt scan failed (invalid response)",
          category: "other-expense",
          merchantName: "Unknown",
        };
      }
      
      const text = result.choices[0].message.content;
      console.log("Raw API response:", text.substring(0, 100) + "...");
      
      // More robust JSON extraction
      let jsonMatch = text.match(/\{[\s\S]*\}/); // Match anything that looks like JSON
      const cleanedText = jsonMatch ? jsonMatch[0] : text.replace(/```(?:json)?\n?/g, "").trim();
      
      try {
        const data = JSON.parse(cleanedText);
        console.log("Successfully parsed JSON response", data);
        
        // Validate the parsed data
        if (!data.amount && data.amount !== 0) data.amount = 0;
        if (!data.date) data.date = new Date().toISOString();
        if (!data.description) data.description = "Unknown purchase";
        if (!data.merchantName) data.merchantName = "Unknown";
        if (!data.category) data.category = "other-expense";
        
        return {
          amount: parseFloat(data.amount),
          date: new Date(data.date),
          description: data.description,
          category: data.category,
          merchantName: data.merchantName,
        };
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError, "\nText was:", cleanedText);
        // Return default values instead of throwing
        return {
          amount: 0,
          date: new Date(),
          description: "Receipt scan failed (parsing error)",
          category: "other-expense",
          merchantName: "Unknown",
        };
      }
    } catch (apiError) {
      console.error("API call error:", apiError);
      // Return default values instead of throwing
      return {
        amount: 0,
        date: new Date(),
        description: "Receipt scan failed (API error)",
        category: "other-expense",
        merchantName: "Unknown",
      };
    }
  } catch (error) {
    console.error("Error scanning receipt:", error);
    // Return default values instead of throwing
    return {
      amount: 0,
      date: new Date(),
      description: "Receipt scan failed",
      category: "other-expense",
      merchantName: "Unknown",
    };
  }
}

// Helper function to calculate next recurring date
function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}