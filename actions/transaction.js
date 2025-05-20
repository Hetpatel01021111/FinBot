"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

// Dynamically import OpenAI to handle potential issues
let OpenAI;
let perplexity;

try {
  // Using dynamic import to handle potential module resolution issues
  OpenAI = require('openai').default;
  
  // Initialize OpenAI client with Perplexity API
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityApiKey) {
    console.error("Missing PERPLEXITY_API_KEY environment variable");
  }

  perplexity = new OpenAI({
    apiKey: perplexityApiKey || "dummy-key", // Provide a fallback to prevent initialization errors
    baseURL: "https://api.perplexity.ai"
  });
  
  console.log("Successfully initialized Perplexity API client");
} catch (error) {
  console.error("Error initializing OpenAI/Perplexity client:", error);
  // Create a mock client that logs errors instead of failing
  perplexity = {
    chat: {
      completions: {
        create: async () => {
          console.error("Perplexity API client not available");
          throw new Error("AI service unavailable. Please try again later.");
        }
      }
    }
  };
}

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
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    // Calculate balance changes
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;

    const netBalanceChange = newBalanceChange - oldBalanceChange;

    // Update transaction and account balance in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id,
          userId: user.id,
        },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      // Update account balance
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: netBalanceChange,
          },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
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
      keyLength: process.env.PERPLEXITY_API_KEY ? process.env.PERPLEXITY_API_KEY.length : 0,
      nodeEnv: process.env.NODE_ENV
    });
    
    // Default/fallback values in case of failure
    const fallbackResponse = {
      amount: 0,
      date: new Date(),
      description: "Receipt scan (manual entry required)",
      category: "other-expense",
      merchantName: "Unknown",
    };
    
    // Check if OpenAI/Perplexity client is available
    if (!perplexity || !perplexity.chat || !perplexity.chat.completions) {
      console.error("Perplexity API client not properly initialized");
      return fallbackResponse;
    }
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    console.log("Converted image to base64", { base64Length: base64String.length });
    
    // Fallback approach - if the image is too large or complex, return default values
    if (file.size > 5000000) { // 5MB limit
      console.log("File too large, using fallback approach");
      return fallbackResponse;
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
    
    // Call Perplexity API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log("Perplexity API call timed out");
    }, 30000); // 30 second timeout
    
    try {
      const result = await perplexity.chat.completions.create({
        model: "sonar-pro",
        messages: messages,
        temperature: 0.1, // Lower temperature for more deterministic results
        max_tokens: 500,  // Limit response size
      }, { signal: controller.signal }).catch(error => {
        console.error("Error calling Perplexity API:", error);
        return null;
      });
      
      clearTimeout(timeoutId);
      
      // Check if result is null (API call failed)
      if (!result) {
        console.log("API call failed, using fallback response");
        return fallbackResponse;
      }
      
      console.log("Received response from Perplexity API");
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error("Invalid response structure from API", result);
        return fallbackResponse;
      }
      
      const responseText = result.choices[0].message.content;
      console.log("Raw API response:", responseText);
      
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/); // Match anything between { and }
      if (!jsonMatch) {
        console.error("No JSON found in response");
        return fallbackResponse;
      }
      
      const jsonString = jsonMatch[0];
      const parsedData = JSON.parse(jsonString);
      console.log("Successfully parsed JSON response", parsedData);
      
      // Validate and format the data
      return {
        amount: typeof parsedData.amount === 'number' ? parsedData.amount : 0,
        date: parsedData.date ? new Date(parsedData.date) : new Date(),
        description: parsedData.description || "Unknown purchase",
        merchantName: parsedData.merchantName || "Unknown",
        category: parsedData.category || "other-expense",
      };
    } catch (apiError) {
      clearTimeout(timeoutId);
      console.error("Error processing receipt with API:", apiError);
      return fallbackResponse;
    }
  } catch (error) {
    console.error("Error scanning receipt:", error);
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