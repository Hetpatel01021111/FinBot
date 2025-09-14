import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    // Get the authenticated user from Clerk
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
    return NextResponse.json(
      { error: "Failed to generate Firebase token" },
      { status: 500 }
    );
  }
}

// Also support GET for easier integration
export async function GET(req) {
  return POST(req);
}
