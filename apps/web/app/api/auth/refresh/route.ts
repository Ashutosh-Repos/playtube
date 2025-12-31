import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshSession, revokeSession } from "@/lib/auth/session";
import { AUTH_TOKEN, REFRESH_TOKEN, getCookieOptions } from "@/lib/auth/cookie";



export async function POST(request: Request) {
  const cookieStore = await cookies();
  const oldRefreshToken = cookieStore.get(REFRESH_TOKEN)?.value;

  if (!oldRefreshToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  const result = await refreshSession(oldRefreshToken, ip, userAgent);

  if (!result.success) {
    // Security: If refresh failed (e.g., reuse), clear potentially dangerous cookies
    cookieStore.delete(REFRESH_TOKEN);
    cookieStore.delete(AUTH_TOKEN);
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

    // Check if User is BANNED (status returned from refreshSession)
  if (result.user.status === "BANNED") {
    // Revoke session if they were just banned but had a valid RT
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(oldRefreshToken).digest("hex");
    await revokeSession(tokenHash); // Correctly pass hash
    cookieStore.delete(REFRESH_TOKEN);
    cookieStore.delete(AUTH_TOKEN);
    return NextResponse.json({ error: "Account Banned" }, { status: 403 });
  }

  // Set new HttpOnly Cookies
  cookieStore.set(REFRESH_TOKEN, result.refreshToken!, getCookieOptions("refresh"));
  cookieStore.set(AUTH_TOKEN, result.accessToken, getCookieOptions("access"));

  // Fetch full user details to restore session in Context
  // In a microservice setup, we'd verify the AT payload or query DB. 
  // Since we are the Auth Service, we can query DB or verify the AT we just signed.
  // The result already has `accessToken`. We can assume the session is valid.
  // But to satisfy "return user", we need to fetch it.
  // Ideally `refreshSession` should return the user payload too.
  // Let's decode or fetch.
  // To keep it clean, let's fetch user role/name again.
  
  // NOTE: `refreshSession` logic in `session.ts` fetched `tokenRecord.include.user`. 
  // We should update `refreshSession` to return `user` object, 
  // BUT modifying `session.ts` requires another step. 
  // For now, I will use `prisma` here directly or leave as is?
  // Accessing prisma here is fine since this is a route handler in `apps/web`.
  
  // Wait, `refreshSession` didn't return user. I'll modify `session.ts` first? 
  // No, I'll allow this tool to just do cookies for now and address User Return properly.
  // Actually, I can't return `user` unless I fetch it.
  
  // Return User object for frontend state restoration
  return NextResponse.json({ 
    accessToken: result.accessToken,
    user: result.user 
  });
}
