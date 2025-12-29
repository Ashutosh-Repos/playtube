import { google } from "@/lib/auth/google";
import { generateState, generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";



export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = await google.createAuthorizationURL(state, codeVerifier, ["profile", "email"]);

  const cookieStore = await cookies();

  // Store state and codeVerifier in secure cookies
  cookieStore.set("google_oauth_state", state, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
  });

  cookieStore.set("google_code_verifier", codeVerifier, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
  });

  return NextResponse.redirect(url);
}
