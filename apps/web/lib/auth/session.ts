import { prisma } from "@repo/database";
import { redis } from "@repo/redis";
import { generateRefreshToken, signAccessToken } from "./token";
import crypto from "crypto";

const REFRESH_TOKEN_LIFESPAN_DAYS = 30;

/**
 * Creates a new session (Refresh Token + Access Token).
 * @param userId The User ID.
 * @param userAgent Device info.
 * @param ipAddress IP address.
 */
export const createSession = async (
  userId: string,
  userAgent: string = "unknown",
  ipAddress: string = "unknown"
) => {
  const refreshToken = generateRefreshToken();
  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_LIFESPAN_DAYS);

  // Family ID: Groups all rotated tokens for this device login
  // For a fresh login, we generate a new family ID.
  // Note: We don't rely on 'default(cuid())' because we want to return it if needed, or track it explicitly.
  const familyId = crypto.randomUUID(); // Using UUID for family ID to distinguish from token IDs

  // Store in DB
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      familyId,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  // Generate Access Token
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user) throw new Error("User not found");

  const accessToken = await signAccessToken({
    sub: userId,
    role: user.role,
    status: user.status,
  });

  return { refreshToken, accessToken };
};

/**
 * Validation Result Type
 */
type RefreshResult = 
  | { 
      success: true; 
      refreshToken: string; 
      accessToken: string; 
      user: { id: string; email: string; name?: string; role: string; status: string }
    }
  | { success: false; error: string };

/**
 * Validates and Rotates a Refresh Token (With Grace Period).
 * @param oldRefreshToken The plain refresh token string.
 */
export const refreshSession = async (
  oldRefreshToken: string,
  ipAddress: string = "unknown",
  userAgent: string = "unknown"
): Promise<RefreshResult> => {
  const tokenHash = crypto.createHash("sha256").update(oldRefreshToken).digest("hex");

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!tokenRecord) {
    return { success: false, error: "Invalid token" };
  }

  // 1. Reuse Detection (Security Breach) & Grace Period
  if (tokenRecord.revokedAt) {
    // Check Redis for Grace Period (Old Token Hash -> New Tokens)
    const cached = await redis.get(`grace:${tokenHash}`);
    if (cached) {
        const { refreshToken: cachedRT, accessToken: cachedAT } = JSON.parse(cached);
        return {
            success: true,
            refreshToken: cachedRT,
            accessToken: cachedAT,
            user: {
                id: tokenRecord.user.id,
                email: tokenRecord.user.email,
                name: tokenRecord.user.name || undefined,
                role: tokenRecord.user.role,
                status: tokenRecord.user.status,
            }
        };
    }

    // Reuse detected outside grace period -> Revoke Family
    // Reuse detected outside grace period -> Revoke Family
    await prisma.refreshToken.updateMany({
      where: { familyId: tokenRecord.familyId }, // Scope to compromised device only
      data: { revokedAt: new Date() },
    });
    return { success: false, error: "Token reuse detected" };
  }

  // 2. Expiry Check
  if (new Date() > tokenRecord.expiresAt) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
    return { success: false, error: "Token expired" };
  }

  // 3. Timed Suspension Check
  // If user is SUSPENDED but the time has passed, activate them.
  let currentUserStatus = tokenRecord.user.status;
  if (currentUserStatus === "SUSPENDED" && tokenRecord.user.suspendedUntil && new Date() > tokenRecord.user.suspendedUntil) {
      await prisma.user.update({
          where: { id: tokenRecord.user.id },
          data: { 
              status: "ACTIVE",
              suspendedUntil: null,
              suspendedReason: null 
          }
      });
      currentUserStatus = "ACTIVE";
  } else if (currentUserStatus === "BANNED") {
      // Should effectively be blocked before, but good double check
      return { success: false, error: "Account Banned" };
  }

  // 4. Smart Rotation Logic
  // Strategy:
  // - If token is "Fresh" (< 24 hours old) AND IP matches: DO NOT ROTATE. Just update lastUsedAt.
  // - If token is "Old" (> 24 hours) OR IP changed: ROTATE (New Token, same Family ID).
  // - EXCEPTION: If token expires soon (< 7 days), FORCE ROTATE to extend life.
  
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  
  const isFresh = (new Date().getTime() - tokenRecord.lastUsedAt.getTime()) < ONE_DAY_MS;
  const isSameIp = tokenRecord.ipAddress === ipAddress;
  const expiresSoon = (tokenRecord.expiresAt.getTime() - new Date().getTime()) < SEVEN_DAYS_MS;

  if (isFresh && isSameIp && !expiresSoon) {
      // SMART MODE: Stable Session
      // Just update timestamp and return SAME token.
      await prisma.refreshToken.update({
          where: { id: tokenRecord.id },
          data: { lastUsedAt: new Date() }
      });

      const accessToken = await signAccessToken({
          sub: tokenRecord.userId,
          role: tokenRecord.user.role,
          status: currentUserStatus,
      });

      return {
          success: true,
          refreshToken: oldRefreshToken, // RETURN SAME TOKEN
          accessToken,
          user: {
              id: tokenRecord.user.id,
              email: tokenRecord.user.email,
              name: tokenRecord.user.name || undefined,
              role: tokenRecord.user.role,
              status: currentUserStatus,
          }
      };
  }

  // ROTATION MODE: Create new token, link to Family
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_LIFESPAN_DAYS);

  // Transaction: Revoke Old -> Create New (Same Family)
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date(),
        // replacedBy: newTokenHash, // DEPRECATED: We use familyId now
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: tokenRecord.userId,
        tokenHash: newTokenHash,
        familyId: tokenRecord.familyId, // INHERIT FAMILY ID
        expiresAt: newExpiresAt,
        userAgent,
        ipAddress,
      },
    }),
  ]);

  const accessToken = await signAccessToken({
    sub: tokenRecord.userId,
    role: tokenRecord.user.role,
    status: currentUserStatus,
  });

  // STORE IN REDIS FOR GRACE PERIOD (20 seconds)
  // Key: grace:oldTokenHash, Value: { refreshToken, accessToken }
  await redis.setex(
      `grace:${tokenHash}`, 
      20, 
      JSON.stringify({ refreshToken: newRefreshToken, accessToken })
  );

  return { 
    success: true, 
    refreshToken: newRefreshToken, 
    accessToken,
    user: {
      id: tokenRecord.user.id,
      email: tokenRecord.user.email,
      name: tokenRecord.user.name || undefined,
      role: tokenRecord.user.role,
      status: currentUserStatus,
    }
  };
};

/**
 * Revokes a specific session.
 */
export const revokeSession = async (tokenHash: string) => {
  const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true }
  });

  if (token) {
      await prisma.refreshToken.updateMany({
          where: { familyId: token.familyId }, // Revoke WHOLE FAMILY
          data: { revokedAt: new Date() }
      });
  }
};

/**
 * Validates the current session from cookies.
 * Performs a DB check to ensure the session is active (not revoked).
 * Use this for CRITICAL WRITE operations (Password Change, Payments, etc).
 */
export const validateSession = async () => {
    const { cookies } = await import("next/headers");
    const { AUTH_TOKEN, REFRESH_TOKEN } = await import("./cookie");
    const { verifyAccessToken } = await import("./token");
    
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_TOKEN)?.value;
    const refreshToken = cookieStore.get(REFRESH_TOKEN)?.value;

    if (!token || !refreshToken) return null;

    // 1. Verify Access Token (Stateless)
    const payload = await verifyAccessToken(token);
    if (!payload) return null;

    // 2. Verify Refresh Token (Stateful DB Check)
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    
    const session = await prisma.refreshToken.findUnique({
        where: { tokenHash: hash },
        select: { id: true, revokedAt: true, familyId: true }
    });

    if (!session || session.revokedAt) {
        return null;
    }

    return { 
        ...payload, 
        sessionId: session.id, // Useful for logging or specific revocation
        familyId: session.familyId 
    };
};
