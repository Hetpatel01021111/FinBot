import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { jwtVerify } from "jose";
import OpenAI from "openai";

// Initialize OpenAI client with Perplexity API directly in this file
// Use a dummy key during build time to prevent build errors
const perplexityApiKey = process.env.PERPLEXITY_API_KEY || "dummy-key-for-build-only";

// Log API key info for debugging (without revealing the actual key)
console.log("[Receipt Scanner] Perplexity API key validation:", {
  exists: !!process.env.PERPLEXITY_API_KEY,
  length: process.env.PERPLEXITY_API_KEY?.length || 0,
  startsWithPplx: process.env.PERPLEXITY_API_KEY?.startsWith('pplx-') || false,
  usingDummyKey: !process.env.PERPLEXITY_API_KEY
});

// Always create the OpenAI client to prevent build errors
const perplexity = new OpenAI({
  apiKey: perplexityApiKey,
  baseURL: "https://api.perplexity.ai",
  defaultHeaders: {
    "Content-Type": "application/json"
  }
});

// Flag to check if we have a real API key at runtime
const hasRealApiKey = !!process.env.PERPLEXITY_API_KEY;

// Secret key for verifying tokens - must match the one used for generation
const SECRET_KEY = new TextEncoder().encode(process.env.TOKEN_SECRET || "finbox-receipt-scanner-secret-key");

// Verify the JWT token from the Authorization header
async function verifyToken(req) {
  try {
    // Check for Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { valid: false, error: "Missing or invalid Authorization header" };
    }

    // Extract the token
    const token = authHeader.split(" ")[1];
    if (!token) {
      return { valid: false, error: "No token provided" };
    }

    // Verify the token
    const { payload } = await jwtVerify(token, SECRET_KEY);
    
    // Get the user from the database
    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return { valid: false, error: "User not found" };
    }

    return { valid: true, user };
  } catch (error) {
    console.error("Token verification error:", error);
    return { valid: false, error: error.message };
  }
}

// Local implementation of receipt scanning
async function scanReceiptLocal(file) {
  try {
    console.log("Starting receipt scan process", { fileType: file.type, fileSize: file.size });
    
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
      
      // Make sure we're using the real API key at runtime
      const result = await perplexity.chat.completions.create({
        model: "sonar-pro-preview",
        messages: messages,
        temperature: 0.1, // Lower temperature for more deterministic results
        max_tokens: 500,  // Limit response size
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
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
      
      const responseText = result.choices[0].message.content;
      console.log("Raw API response:", responseText);
      
      // Clean up the response text to ensure it's valid JSON
      let cleanedText = responseText.trim();
      // Remove markdown code blocks if present
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/```json\n|```/g, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/```\n|```/g, "");
      }
      
      // Parse the JSON response
      try {
        const data = JSON.parse(cleanedText);
        console.log("Successfully parsed JSON response", data);
        
        // Return the extracted data
        return {
          amount: data.amount,
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
      console.error("Perplexity API error:", apiError);
      // Return default values for API errors
      return {
        amount: 0,
        date: new Date(),
        description: "Receipt scan failed (API error)",
        category: "other-expense",
        merchantName: "Error: " + (apiError.message || "Unknown API error"),
      };
    }
  } catch (error) {
    console.error("Error in scanReceiptLocal:", error);
    return {
      amount: 0,
      date: new Date(),
      description: "Receipt scan failed",
      category: "other-expense",
      merchantName: "Unknown",
    };
  }
}

export async function POST(req) {
  try {
    // Verify the token
    const { valid, user, error } = await verifyToken(req);
    if (!valid) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the form data
    const formData = await req.formData();
    const file = formData.get("receipt");
    
    if (!file) {
      return NextResponse.json(
        { error: "No receipt file provided" },
        { status: 400 }
      );
    }

    // Check if we have a real API key at runtime
    if (!hasRealApiKey) {
      console.error("Cannot scan receipt: Perplexity API key is missing at runtime");
      return NextResponse.json({
        success: false,
        error: "Receipt scanning is currently unavailable. Please enter transaction details manually.",
        data: {
          amount: 0,
          date: new Date(),
          description: "API configuration error",
          category: "other-expense",
          merchantName: "Error: API key missing",
        }
      }, { status: 503 }); // Service Unavailable
    }
    
    // Scan the receipt with local implementation
    const result = await scanReceiptLocal(file);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Receipt scanner API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scan receipt" },
      { status: 500 }
    );
  }
}

// Special endpoint for token validation - just returns success if token is valid
export async function GET(req) {
  try {
    const { valid, error } = await verifyToken(req);
    
    if (!valid) {
      return NextResponse.json(
        { error: error || "Invalid token" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Token is valid"
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}
