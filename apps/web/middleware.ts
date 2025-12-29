import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "./lib/auth/token";

// Paths that do not require authentication
const PUBLIC_PATHS = [
  "/login", 
  "/register", 
  "/api/auth/login", 
  "/api/auth/register", 
  "/api/auth/refresh"
];

// Asset paths to ignore
const IGNORED_PATHS = [
  "/_next", 
  "/favicon.ico", 
  "/public"
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip ignored paths
  if (IGNORED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 2. Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 3. Auth Check
  // We verify the 'auth_token' (Access Token) cookie.
  // If it's missing, the client might try to refresh via proper flows, 
  // but for protected API routes or Pages, we block.
  
  const accessToken = request.cookies.get("auth_token")?.value;

  if (!accessToken) {
    // If it's an API request, return 401
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Otherwise redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 4. Verify Token (Stateless)
  const payload = await verifyAccessToken(accessToken);

  if (!payload) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Enforce Status (Block BANNED)
  // We allow SUSPENDED users to login but they might have read-only access (enforced in UI/API).
  // BANNED users are blocked entirely.
  if (payload.status === "BANNED") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Account Banned" }, { status: 403 });
    }
    return NextResponse.json({ error: "Account Banned" }, { status: 403 });
  }

  if (payload.status === "SUSPENDED") {
      if (pathname.startsWith("/api")) {
          return NextResponse.json({ error: "Account Suspended" }, { status: 403 });
      }
      return NextResponse.json({ error: "Account Suspended" }, { status: 403 });
  }

  if (payload.status === "PROVISIONED") {
      if (pathname.startsWith("/api")) {
          return NextResponse.json({ error: "Email Verification Required" }, { status: 403 });
      }
      return NextResponse.json({ error: "Email Verification Required" }, { status: 403 });
  }

  // 6. Enforce RBAC (Admin Routes)
  if (pathname.startsWith("/api/admin")) {
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // 7. Success - Forward User Info
  // If we are proxying to microservices (future), we would add headers here.
  // For now, next-intl or other middleware might chain.
  const response = NextResponse.next();
  response.headers.set("x-user-id", payload.sub as string);
  response.headers.set("x-user-role", payload.role as string);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (handled by public paths logic, but let's include to be safe)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
