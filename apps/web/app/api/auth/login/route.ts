
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { cookies } from "next/headers";



const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

import { checkOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { AUTH_TOKEN, REFRESH_TOKEN, getCookieOptions } from "@/lib/auth/cookie";

export async function POST(request: Request) {
  // 1. CSRF Check
  if (!(await checkOrigin(request))) {
    return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
  }

  // 2. Body Parsing (Early)
  let body;
  try {
      body = await request.json();
  } catch(e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Rate Limiting (IP based)
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { success, remaining } = await rateLimit(ip, "login");
  
  if (!success) {
      return NextResponse.json(
          { error: "Too many login attempts. Try again later." }, 
          { status: 429 }
      );
  }

  try {
    const { email, password } = loginSchema.parse(body);


    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.status === "BANNED") {
      return NextResponse.json(
        { error: "Account Banned" },
        { status: 403 }
      );
    }

    if (user.status === "SUSPENDED") {
        // CASE 1: Indefinite Suspension (No date set)
        if (!user.suspendedUntil) {
             return NextResponse.json(
                { error: "Account Suspended", reason: user.suspendedReason },
                { status: 403 }
            );
        }

        // CASE 2: Timed Suspension
        // Check if suspension time has passed
        if (new Date() > user.suspendedUntil) {
           // Auto-activate
           await prisma.user.update({
               where: { id: user.id },
               data: { status: "ACTIVE", suspendedUntil: null, suspendedReason: null }
           });
           user.status = "ACTIVE"; // Update local var for session creation
        } else {
           // Still suspended
           return NextResponse.json(
               { error: "Account Suspended", reason: user.suspendedReason },
               { status: 403 }
           );
        }
    }

    if (user.status === "PROVISIONED") {
      return NextResponse.json(
        { 
            error: "Email not verified. Redirecting...",
            redirect: `/verify-email?email=${encodeURIComponent(user.email)}`
        },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Update Last Login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    const { refreshToken, accessToken } = await createSession(user.id, userAgent, ip);

    // Set HttpOnly Cookie
    const cookieStore = await cookies();
    cookieStore.set(REFRESH_TOKEN, refreshToken, getCookieOptions("refresh"));
    cookieStore.set(AUTH_TOKEN, accessToken, getCookieOptions("access"));

    return NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
