
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { signAccessToken, verifyAccessToken, generateRefreshToken } from "../lib/auth/token";

async function main() {
  console.log("--- Starting Auth Utility Tests ---");

  // 1. Password Test
  const rawApiPassword = "superSecretPassword123";
  console.log(`\n1. Testing Password Hashing for: "${rawApiPassword}"`);
  const hash = await hashPassword(rawApiPassword);
  console.log(`   Generated Hash: ${hash.substring(0, 20)}...`);
  
  const isValid = await verifyPassword(rawApiPassword, hash);
  console.log(`   Verification (Correct Password): ${isValid ? "PASS" : "FAIL"}`);

  const isInvalid = await verifyPassword("wrongPassword", hash);
  console.log(`   Verification (Wrong Password): ${!isInvalid ? "PASS" : "FAIL"}`);

  if (!isValid || isInvalid) throw new Error("Password tests failed");

  // 2. Token Test
  console.log("\n2. Testing JWT Signing & Verification");
  const payload = { sub: "user_123", role: "USER" };
  try {
    const token = await signAccessToken(payload);
    console.log(`   Signed Token: ${token.substring(0, 20)}...`);

    const decoded = await verifyAccessToken(token);
    console.log(`   Decoded Payload:`, decoded);

    if (decoded?.sub === payload.sub && decoded?.role === payload.role) {
      console.log("   Verification: PASS");
    } else {
      console.error("   Verification: FAIL (Payload mismatch)");
      throw new Error("Token payload mismatch");
    }
  } catch (e: any) {
    console.error("   Token Test Failed:", e.message);
    throw e;
  }

  console.log("\n--- All Tests Passed ---");
}

main().catch(console.error);
