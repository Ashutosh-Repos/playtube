import Redis from "ioredis";
import { config } from "../config";

// --- Redis Client Wrapper ---

// Use a singleton pattern or separate clients for Pub/Sub vs standard commands
// Standard client for caching
// Standard client for caching
export const redis = new Redis(config.redisUrl || "redis://localhost:6379");
redis.on("error", (err) => console.error("Redis Client Error:", err));

// Publisher client
// Publisher client (Reuse standard client for simple commands, BUT usually Pub/Sub needing blocking is Sub. 
// Pub can be done on standard client if we are just publishing.
// However, ioredis docs say: "When a client issues a SUBSCRIBE command, it enters the subscriber mode... and cannot issue any other commands"
// But PUBLISH is a standard command. So we can reuse 'redis' for publishing.
// We will alias it for compatibility if needed, or just export it.
export const redisPub = redis; // Reuse connection

// Subscriber client (blocking)
export const redisSub = new Redis(config.redisUrl || "redis://localhost:6379");
redisSub.on("error", (err) => console.error("Redis Sub Client Error:", err));

// --- Keys & Constants ---

export const REDIS_KEYS = {
  videoStatus: (videoId: string) => `video:${videoId}:status`,
  videoWsChannel: (videoId: string) => `video:${videoId}:ws`,
};

// --- Helper Functions ---

export interface VideoStatusCache {
  status: string;
  progress?: number;
  error?: string;
  thumbnails?: string[];
  hlsUrl?: string;
  retryable?: boolean;
}

/**
 * Cache video status for fast API retrieval
 * TTL: 24 hours (sufficient for active uploads)
 */
export async function cacheVideoStatus(
  videoId: string, 
  status: VideoStatusCache
): Promise<void> {
  const key = REDIS_KEYS.videoStatus(videoId);
  // Store as stringified JSON
  await redis.setex(key, 86400, JSON.stringify(status));
}

/**
 * Get cached status
 */
export async function getCachedVideoStatus(videoId: string): Promise<VideoStatusCache | null> {
  const key = REDIS_KEYS.videoStatus(videoId);
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as VideoStatusCache;
  } catch {
    return null;
  }
}

/**
 * Publish real-time update to WebSocket server via Redis Channel
 */
export async function publishToVideoChannel(
  videoId: string, 
  message: unknown
): Promise<void> {
  const channel = REDIS_KEYS.videoWsChannel(videoId);
  const payload = typeof message === "string" ? message : JSON.stringify(message);
  await redisPub.publish(channel, payload);
}