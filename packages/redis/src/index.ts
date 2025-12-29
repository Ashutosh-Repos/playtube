import Redis from "ioredis";
import { env } from "@repo/env";

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
  });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
