import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFRESH_TOKEN, AUTH_TOKEN, getCookieOptions } from "@/lib/auth/cookie";
import { refreshSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") || "/";

  try {
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get(REFRESH_TOKEN)?.value;

      // If no refresh token, we can't refresh. Redirect to login.
      if (!refreshToken) {
          return NextResponse.redirect(new URL("/login", request.url));
      }

      // Extract client info for session tracking
      const ip = request.headers.get("x-forwarded-for") || "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";

      const result = await refreshSession(refreshToken, ip, userAgent);

      if (!result.success) {
          // Refresh failed (expired/revoked). Redirect to login.
          return NextResponse.redirect(new URL("/login", request.url));
      }

      // Success! Redirect back to the original destination.
      const res = NextResponse.redirect(new URL(redirectTo, request.url));
      
      // Set the new/rotated cookies on the RESPONSE object directly
      // This ensures they are sent to the browser during the redirect.
      res.cookies.set(AUTH_TOKEN, result.accessToken!, getCookieOptions("access"));
      
      if (result.refreshToken) {
          res.cookies.set(REFRESH_TOKEN, result.refreshToken, getCookieOptions("refresh"));
      }

      return res;

  } catch (error) {
      console.error("Auto Refresh Error:", error);
      return NextResponse.redirect(new URL("/login", request.url));
  }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
