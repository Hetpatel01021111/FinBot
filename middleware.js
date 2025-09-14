import { NextResponse } from "next/server";
import aj from "./lib/arcjet";

// Protected routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/account",
  "/transaction",
  "/settings"
];

// Auth routes that should redirect if already authenticated
const authRoutes = [
  "/sign-in",
  "/sign-up",
  "/forgot-password"
];

export default async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Apply Arcjet protection
  try {
    const decision = await aj.protect(req);
    if (decision.isDenied()) {
      return new Response("Forbidden", { status: 403 });
    }
  } catch (error) {
    console.warn("Arcjet protection failed:", error.message);
    // Continue without Arcjet if it fails
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Check if route is auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  );

  // For protected routes, we'll let the client-side handle auth checks
  // since Firebase Auth state is managed on the client
  if (isProtectedRoute) {
    // Let the request through - Firebase auth will be checked client-side
    return NextResponse.next();
  }

  // For auth routes, also let through - client will handle redirects
  if (isAuthRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
  // Don't run middleware on static files
  unstable_allowDynamic: [
    '/node_modules/@clerk/nextjs/dist/esm/index.js',
    '/node_modules/@clerk/nextjs/dist/esm/server/index.js',
  ]
};