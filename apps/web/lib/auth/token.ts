import { SignJWT, jwtVerify, importPKCS8, importSPKI, JWTPayload } from "jose";

/**
 * Access Token Payload Interface
 */
export interface AccessTokenPayload extends JWTPayload {
  sub: string; // User ID
  email: string; // User Email
  role: string; // User Role
  status: string; // User Status (ACTIVE, BANNED, SUSPENDED, PROVISIONED)
  kid?: string; // Key ID
}

import { env } from "@repo/env";
import { ACCESS_MAX_AGE } from "./cookie";

// Load keys from Environment Variables (Base64 encoded)
const PRIVATE_KEY_B64 = env.AUTH_PRIVATE_KEY;
const PUBLIC_KEY_B64 = env.AUTH_PUBLIC_KEY;

// Cache keys in memory
let privateKey: any = null;
let publicKey: any = null;

/**
 * Imports the private key from the environment variable.
 */
async function getPrivateKey() {
  if (privateKey) return privateKey;
  if (!PRIVATE_KEY_B64) {
    throw new Error("AUTH_PRIVATE_KEY is not defined");
  }
  
  // Clean up the key string in case of formatting issues
  const keyContent = Buffer.from(PRIVATE_KEY_B64, "base64").toString("utf-8");
  privateKey = await importPKCS8(keyContent, "RS256");
  return privateKey;
}

/**
 * Imports the public key from the environment variable.
 */
async function getPublicKey() {
  if (publicKey) return publicKey;
  if (!PUBLIC_KEY_B64) {
    throw new Error("AUTH_PUBLIC_KEY is not defined");
  }

  const keyContent = Buffer.from(PUBLIC_KEY_B64, "base64").toString("utf-8");
  publicKey = await importSPKI(keyContent, "RS256");
  return publicKey;
}

/**
 * Signs a new Access Token.
 * @param payload The token payload (sub, role, etc.)
 * @returns The signed JWT string.
 */
export const signAccessToken = async (
  payload: Omit<AccessTokenPayload, "iat" | "exp" | "nbf">
): Promise<string> => {
  const priv = await getPrivateKey();
  const kid = "1"; // In a real system, rotate this.

  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_MAX_AGE}s`) // Syncs with cookie expiry
    .sign(priv);
};

/**
 * Verifies an Access Token.
 * @param token The JWT string.
 * @returns The payload if valid, null otherwise.
 */
export const verifyAccessToken = async (
  token: string
): Promise<AccessTokenPayload | null> => {
  try {
    const pub = await getPublicKey();
    const { payload } = await jwtVerify(token, pub);
    return payload as AccessTokenPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};

/**
 * Generates a random Refresh Token.
 * format: simple random string (UUID or hex)
 */
export const generateRefreshToken = (): string => {
  return crypto.randomUUID();
};
