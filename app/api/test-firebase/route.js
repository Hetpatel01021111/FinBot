import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check environment variables
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const hasClerkKeys = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
    
    let serviceAccountValid = false;
    let serviceAccountError = null;
    
    if (hasServiceAccount) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        serviceAccountValid = !!(parsed.project_id && parsed.client_email && parsed.private_key);
      } catch (e) {
        serviceAccountError = e.message;
      }
    }

    return NextResponse.json({
      environment: process.env.NODE_ENV,
      hasServiceAccount,
      serviceAccountValid,
      serviceAccountError,
      hasClerkKeys,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
