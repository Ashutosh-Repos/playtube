import { redis } from "@repo/redis";

const WINDOW_SECONDS = 60 * 15; // 15 Minutes
const MAX_ATTEMPTS = 5; // 5 Attempts per window

/**
 * Sliding Window Rate Limiter (Approximation using Redis EXPIRE).
 * @param identifier IP Address or Email
 * @param action "login", "register", etc.
 */
export async function rateLimit(identifier: string, action: string = "default") {
  const key = `ratelimit:${action}:${identifier}`;
  
  // Increment. If key doesn't exist, it sets to 1.
  const current = await redis.incr(key);
  
  // If new key (1), set expiry
  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  
  return {
    success: current <= MAX_ATTEMPTS,
    limit: MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - current),
    reset: Date.now() + WINDOW_SECONDS * 1000 // Approximate
  };
}
