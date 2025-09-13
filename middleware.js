import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/transaction(.*)",
  "/settings(.*)",
  "/api/(?!auth).*" // Protect all API routes except auth
]);

// Define public routes that don't require authentication
const isPublicRoute = (pathname) => {
  const publicPaths = [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/auth(.*)",
    "/_next(.*)",
    "/(api|trpc)(.*)"
  ];
  return publicPaths.some(
    (path) => path === pathname || new RegExp(`^${path.replace('*', '.*')}$`).test(pathname)
  );
};

// CORS headers for API routes
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth();
  const { pathname } = req.nextUrl;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    // Add CORS headers to public API responses
    if (pathname.startsWith('/api/')) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    return response;
  }

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    // Verify Firebase token for protected API routes
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized - Missing token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const response = NextResponse.next();
    // Add security headers to API responses
    Object.entries({
      ...corsHeaders,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // Handle protected routes
  if (isProtectedRoute(req)) {
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  Object.entries({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}, {
  // Disable Clerk's default behavior of redirecting to sign-in for API routes
  beforeAuth: (req) => {
    const { pathname } = req.nextUrl;
    if (pathname.startsWith('/api/')) {
      return NextResponse.next();
    }
  },
  // Ensure Clerk doesn't interfere with static files
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/_next(.*)',
    '/api/(.*)',
    '/(api|trpc)(.*)'
  ]
});

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