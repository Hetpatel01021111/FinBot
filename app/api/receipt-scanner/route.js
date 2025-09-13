import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
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
    
    // The payload now contains clerkUserId, which is sufficient for validation.
    if (!payload.clerkUserId) {
      return { valid: false, error: "Invalid token payload" };
    }

    // Pass the clerkUserId along in case it's needed.
    return { valid: true, userId: payload.clerkUserId };
  } catch (error) {
    console.error("Token verification error:", error);
    return { valid: false, error: error.message };
  }
}

export async function POST(req) {
  try {
    // Verify the token
    const { valid, userId, error } = await verifyToken(req);
    if (!valid || !userId) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: 401 }
      );
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
      const { userId } = await verifyToken(req);
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
export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    timestamp: new Date().toISOString() 
  });
}
