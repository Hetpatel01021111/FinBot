import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";

// Don't initialize Firestore at the module level to avoid initialization issues during build
let db;

// Lazy initialization function for Firestore
function getDb() {
  if (!db) {
    db = getAdminFirestore();
  }
  return db;
}

// Middleware to verify authentication
async function authenticateRequest(req) {
  try {
    // Get the auth token from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { success: false, error: "Missing or invalid Authorization header" };
    }

    // Extract the token
    const token = authHeader.split(" ")[1];
    if (!token) {
      return { success: false, error: "No token provided" };
    }

    // Verify the token using our auth utility
    try {
      const { userId } = await getAuth(token);
      if (!userId) {
        return { success: false, error: "Invalid token" };
      }
      return { success: true, userId };
    } catch (error) {
      console.error("Authentication error:", error);
      return { success: false, error: "Authentication failed" };
    }
  } catch (error) {
    console.error("Error in authentication middleware:", error);
    return { success: false, error: "Authentication error" };
  }
}

export async function POST(req) {
  try {
    // Authenticate the request
    const { success, error, userId } = await authenticateRequest(req);
    if (!success) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    }

    // Get the form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Dynamically import the scanReceipt function to avoid Firebase initialization issues
    const { scanReceipt } = await import('@/actions/transaction');
    
    // Process the receipt
    const result = await scanReceipt(file);
    
    // Log the scan result for debugging
    const db = getDb();
    await db.collection("receiptScans").add({
      userId,
      result,
      timestamp: new Date(),
      status: "completed"
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing receipt:", error);
    
    // Log the error to Firestore for debugging
    try {
      const { userId } = await authenticateRequest(req);
      if (userId) {
        const db = getDb();
        await db.collection("receiptScanErrors").add({
          userId,
          error: error.message,
          timestamp: new Date(),
          status: "error"
        });
      }
    } catch (e) {
      console.error("Failed to log error:", e);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to process receipt",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Special endpoint for token validation - just returns success if token is valid
export async function GET(req) {
  try {
    // Authenticate the request
    const { success, error } = await authenticateRequest(req);
    if (!success) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    }
    // Return success if token is valid
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error in token validation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
