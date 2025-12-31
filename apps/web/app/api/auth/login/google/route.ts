import { google } from "@/lib/auth/google";
import { generateState, generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";



export async function GET(request: Request) {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = await google.createAuthorizationURL(state, codeVerifier, ["profile", "email"]);

  const cookieStore = await cookies();

  // Redirect Parameter Logic
  const requestUrl = new URL(request.url);
  let redirectPath = requestUrl.searchParams.get("redirect") || "/";
  if (!redirectPath.startsWith("/")) redirectPath = "/";

  // Store state and codeVerifier in secure cookies
  cookieStore.set("google_oauth_state", state, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  cookieStore.set("google_code_verifier", codeVerifier, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  cookieStore.set("google_oauth_redirect", redirectPath, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  // Store redirect path (sanitize default to /)
  // We can't use "next/navigation" in API routes effectively for params if we use 'generateState' etc.
  // Actually, we need to read 'request.url'.
  // The 'GET' function provided has no arguments in the current code?
  // Wait, I need to check if 'GET' accepts 'request'. It should.
  // The original code was: `export async function GET() {`
  // I need (request: Request)


  return NextResponse.redirect(url);
}
