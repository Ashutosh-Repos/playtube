import { Google } from "arctic";
import { env } from "@repo/env";

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.warn("⚠️ Google Auth Credentials missing. Google Login will fail.");
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const google = new Google(
  env.GOOGLE_CLIENT_ID ?? "MISSING_ID",
  env.GOOGLE_CLIENT_SECRET ?? "MISSING_SECRET",
  `${APP_URL}/api/auth/login/google/callback`
);
