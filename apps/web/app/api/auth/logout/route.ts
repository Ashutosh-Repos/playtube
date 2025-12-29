import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSession } from "@/lib/auth/session";
import crypto from "crypto";
import { AUTH_TOKEN, REFRESH_TOKEN } from "@/lib/auth/cookie";



export async function POST(request: Request) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN)?.value;

  if (refreshToken) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await revokeSession(tokenHash);
  }

  cookieStore.delete(REFRESH_TOKEN);
  cookieStore.delete(AUTH_TOKEN);

  return NextResponse.json({ message: "Logged out successfully" });
}
