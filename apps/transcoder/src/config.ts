/* eslint-disable turbo/no-undeclared-env-vars */
import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  // Transcoder checks
  redisUrl: process.env.REDIS_URL,
  rabbitmqUrl: process.env.RABBITMQ_URL,

  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT || "9000"),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET || "play-videos",
    useSSL: process.env.MINIO_USE_SSL === "true",
    region: process.env.MINIO_REGION || "us-east-1",
  },
};

// Helper: Parse Redis URL safely
export function getRedisConnection() {
  const urlStr = config.redisUrl || "redis://localhost:6379";
  
  // If it doesn't start with redis://, assume host:port or just host
  if (!urlStr.startsWith("redis://") && !urlStr.startsWith("rediss://")) {
    const [host, port] = urlStr.split(":");
    return {
      host: host || "localhost",
      port: parseInt(port || "6379"),
    };
  }

  try {
    const url = new URL(urlStr);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      username: url.username,
      password: url.password,
    };
  } catch(e) {
    console.warn("Invalid Redis URL, falling back to localhost", e);
    return { host: "localhost", port: 6379 };
  }
}

export function validateConfig() {
  const missing: string[] = [];
  if (!config.redisUrl) missing.push("REDIS_URL");
  if (!config.rabbitmqUrl) missing.push("RABBITMQ_URL");
  if (!config.minio.endpoint) missing.push("MINIO_ENDPOINT");
  if (!config.minio.accessKey) missing.push("MINIO_ACCESS_KEY");
  if (!config.minio.secretKey) missing.push("MINIO_SECRET_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
