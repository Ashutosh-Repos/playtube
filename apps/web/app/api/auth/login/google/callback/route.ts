import { google } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@repo/database";
import { OAuth2RequestError } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_TOKEN, REFRESH_TOKEN, getCookieOptions } from "@/lib/auth/cookie";




export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value ?? null;
  const codeVerifier = cookieStore.get("google_code_verifier")?.value ?? null;

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
    });
    const googleUser: GoogleUser = await response.json();

    // 1. Check if Account exists
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleUser.sub,
        },
      },
      include: { user: true },
    });

    let userId: string;

    if (existingAccount) {
      // Login existing user
      if (existingAccount.user.status === "BANNED") {
          return NextResponse.json({ error: "Account Banned" }, { status: 403 });
      }
      userId = existingAccount.userId;
    } else {
      // 2. Check if User exists with same email (Account Linking)
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (existingUser) {
        if (existingUser.status === "BANNED") {
            return NextResponse.json({ error: "Account Banned" }, { status: 403 });
        }
        // Link Account
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: googleUser.sub,
            access_token: tokens.accessToken(),
            // refresh_token: tokens.refreshToken(), // Google often defaults to no RT unless specified
            token_type: "Bearer",
            scope: "openid profile email",
            id_token: tokens.idToken(),
          },
        });
        userId = existingUser.id;
      } else {
        // 3. Register New User
        // Transaction: User + Account
        const newUser = await prisma.user.create({
          data: {
            email: googleUser.email,
            emailVerified: new Date(), // Trusted provider
            name: googleUser.name,
            image: googleUser.picture,
            status: "ACTIVE", // Or PROVISIONED if we want them to set a username/handle
            role: "USER",
            accounts: {
              create: {
                type: "oauth",
                provider: "google",
                providerAccountId: googleUser.sub,
                access_token: tokens.accessToken(),
                token_type: "Bearer",
                scope: "openid profile email",
                id_token: tokens.idToken(),
              },
            },
          },
        });
        userId = newUser.id;
      }
    }

    // 4. Create Session
    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { accessToken, refreshToken } = await createSession(userId, userAgent, ip);

    // 5. Set Cookies
    cookieStore.set(REFRESH_TOKEN, refreshToken, getCookieOptions("refresh"));
    cookieStore.set(AUTH_TOKEN, accessToken, getCookieOptions("access"));
    
    // Clean up OAuth cookies
    cookieStore.delete("google_oauth_state");
    cookieStore.delete("google_code_verifier");

    return NextResponse.redirect(new URL("/", request.url));
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      // Invalid code
      return new NextResponse(null, { status: 400 });
    }
    console.error(e);
    return new NextResponse(null, { status: 500 });
  }
}

interface GoogleUser {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale: string;
}
