import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    // Get the authenticated user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if Firebase Admin is properly configured
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Firebase Admin not configured" },
        { status: 500 }
      );
    }

    // Create a custom Firebase token for the user
    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken(userId);

    return NextResponse.json({
      success: true,
      token: customToken,
    });
  } catch (error) {
    console.error("Firebase token generation error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    });
    return NextResponse.json(
      { error: "Failed to generate Firebase token", details: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for easier integration
export async function GET(req) {
  return POST(req);
}
