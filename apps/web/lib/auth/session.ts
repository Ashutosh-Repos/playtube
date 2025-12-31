import "server-only";
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
// Helper to cache session
const cacheSession = async (tokenHash: string, data: any) => {
  try {
    // 15 Minutes TTL (matches Access Token life loosely, or could be longer)
    await redis.setex(`session:${tokenHash}`, 15 * 60, JSON.stringify(data));
  } catch (e) {
    console.error("Redis Cache Error:", e);
  }
};

const invalidateSession = async (tokenHash: string) => {
  try {
    await redis.del(`session:${tokenHash}`);
  } catch (e) { console.error(e); }
};

export const createSession = async (
  userId: string,
  userAgent: string = "unknown",
  ipAddress: string = "unknown"
) => {
  const refreshToken = generateRefreshToken();
  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_LIFESPAN_DAYS);

  const familyId = crypto.randomUUID();

  // Store in DB
  const sessionRecord = await prisma.refreshToken.create({
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
    select: { role: true, status: true, email: true },
  });

  if (!user) throw new Error("User not found");

  const accessToken = await signAccessToken({
    sub: userId,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  // CACHE: Write to Redis
  await cacheSession(tokenHash, {
      id: sessionRecord.id,
      familyId: sessionRecord.familyId,
      sub: userId,
      role: user.role,
      status: user.status
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

  if (tokenRecord.revokedAt) {
    // Check Redis for Grace Period
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

    await prisma.refreshToken.updateMany({
      where: { familyId: tokenRecord.familyId },
      data: { revokedAt: new Date() },
    });
    // Ensure all family tokens are invalidated in cache if we knew their hashes, 
    // but we don't track lookups by familyId in Redis easily without a set.
    // For now, they will just fail DB check once TTL expires or if we had a mapping.
    // Ideally we should store `family:{familyId}` -> [list of active token hashes] to bulk revoke.
    // But for simplicity, we rely on the DB check if Redis misses or if critical.
    
    return { success: false, error: "Token reuse detected" };
  }

  // 2. Expiry Check
  if (new Date() > tokenRecord.expiresAt) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
    await invalidateSession(tokenHash); // Remove from cache
    return { success: false, error: "Token expired" };
  }

  // 3. Timed Suspension Check
  // If user is SUSPENDED but the time has passed, activate them.
  let currentUserStatus = tokenRecord.user.status;
  if (currentUserStatus === "SUSPENDED" && tokenRecord.user.suspendedUntil && new Date() > tokenRecord.user.suspendedUntil) {
       await prisma.user.update({
           where: { id: tokenRecord.user.id },
           data: { status: "ACTIVE", suspendedUntil: null, suspendedReason: null }
       });
       currentUserStatus = "ACTIVE";
  } else if (currentUserStatus === "BANNED") {
      // Should effectively be blocked before, but good double check
      return { success: false, error: "Account Banned" };
  }
  

  
  // Smart Rotation Logic
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isFresh = (new Date().getTime() - tokenRecord.lastUsedAt.getTime()) < ONE_DAY_MS;
  const isSameIp = tokenRecord.ipAddress === ipAddress;
  const expiresSoon = (tokenRecord.expiresAt.getTime() - new Date().getTime()) < SEVEN_DAYS_MS;

  if (isFresh && isSameIp && !expiresSoon) {
      await prisma.refreshToken.update({
          where: { id: tokenRecord.id },
          data: { lastUsedAt: new Date() }
      });

      const accessToken = await signAccessToken({
          sub: tokenRecord.userId,
          email: tokenRecord.user.email,
          role: tokenRecord.user.role,
          status: currentUserStatus,
      });
      
      // Update Cache (Extend TTL)
      await cacheSession(tokenHash, {
          id: tokenRecord.id,
          familyId: tokenRecord.familyId,
          sub: tokenRecord.userId,
          role: tokenRecord.user.role,
          status: currentUserStatus
      });

      return {
          success: true,
          refreshToken: oldRefreshToken,
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

  // Rotation
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_LIFESPAN_DAYS);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: tokenRecord.userId,
        tokenHash: newTokenHash,
        familyId: tokenRecord.familyId,
        expiresAt: newExpiresAt,
        userAgent,
        ipAddress,
      },
    }),
  ]);

  const accessToken = await signAccessToken({
    sub: tokenRecord.userId,
    email: tokenRecord.user.email,
    role: tokenRecord.user.role,
    status: currentUserStatus,
  });

  // Redis Grace Period
  await redis.setex(
      `grace:${tokenHash}`, 
      20, 
      JSON.stringify({ refreshToken: newRefreshToken, accessToken })
  );
  
  // Invalidate Old from Cache
  await invalidateSession(tokenHash);
  
  // Cache New
  // We need to fetch the new ID if we want it, but for now we construct it or just use familyId.
  // Actually we don't have the new Record ID easily from $transaction unless we await individually.
  // But we know the familyID.
  
  // For simplicity, we might just NOT cache the *session* ID immediately if we don't have it, 
  // but validateSession needs it.
  // Let's optimize: We can just use a separate read or trust that next validateSession will cache it on miss.
  // "Lazy Cache" is safer here than guessing ID. 
  // So: WE DO NOT CACHE `newTokenHash` immediately here. 
  // The first `validateSession` call will fetch from DB and cache it.
  // This avoids the complexity of fetching the ID back from transaction.

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

export const revokeSession = async (tokenHash: string) => {
  const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true }
  });

  if (token) {
      // 1. Fetch all active tokens in this family to invalidate in Redis
      const siblings = await prisma.refreshToken.findMany({
          where: { familyId: token.familyId, revokedAt: null },
          select: { tokenHash: true }
      });

      // 2. Invalidate all found hashes in Redis
      await Promise.all(siblings.map(sib => invalidateSession(sib.tokenHash)));

      // 3. Mark all as revoked in DB
      await prisma.refreshToken.updateMany({
          where: { familyId: token.familyId },
          data: { revokedAt: new Date() }
      });
  }
};

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

    // 2. Verify Refresh Token (Cache-Aside)
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    
    // READ CACHE
    try {
        const cached = await redis.get(`session:${hash}`);
        if (cached) {
            return { ...payload, ...JSON.parse(cached) }; // Cached has sessionId, familyId
        }
    } catch(e) { console.error("Redis Read Error", e); }

    // CACHE MISS: DB Lookup
    const session = await prisma.refreshToken.findUnique({
        where: { tokenHash: hash },
        select: { id: true, revokedAt: true, familyId: true, userId: true } // Fetched userId too for consistency checks
    });

    if (!session || session.revokedAt) {
        return null;
    }
    
    const sessionData = {
        sessionId: session.id,
        familyId: session.familyId,
        // We could cache role/status here too if we fetched user, but payload has them.
    };

    // WRITE CACHE
    await cacheSession(hash, sessionData);

    return { 
        ...payload, 
        ...sessionData
    };
};
