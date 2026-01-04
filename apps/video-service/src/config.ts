/* eslint-disable turbo/no-undeclared-env-vars */
import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

export const config = {
  port: process.env.PORT || 4003,
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Redis
  redisUrl: process.env.REDIS_URL,
  
  // RabbitMQ
  rabbitmqUrl: process.env.RABBITMQ_URL,
  
  // MinIO
  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: process.env.MINIO_PORT,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
    useSSL: process.env.MINIO_USE_SSL,
    webhookSecret: process.env.S3_WEBHOOK_SECRET, // Used for validating S3 events
  },
  
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  
  // CORS
  allowedOrigins:   process.env.ALLOWED_ORIGINS?.split(',') || null,
  
  // WebSocket Public URL (for clients)
  publicWsUrl: process.env.PUBLIC_WS_URL || null,
  
  // Upload settings
  upload: {
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    presignedUrlExpiry: 60 * 60, // 1 hour
    staleUploadThreshold: 2 * 60 * 60 * 1000, // 2 hours in ms
  },
};

export function validateConfig() {
  const missing: string[] = [];
  
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!config.redisUrl) missing.push("REDIS_URL");
  if (!config.rabbitmqUrl) missing.push("RABBITMQ_URL");
  if (!config.minio.endpoint) missing.push("MINIO_ENDPOINT");
  if (!config.minio.accessKey) missing.push("MINIO_ACCESS_KEY");
  if (!config.minio.secretKey) missing.push("MINIO_SECRET_KEY");
  if (!config.minio.webhookSecret) missing.push("S3_WEBHOOK_SECRET");
  
  // Auth Verification (Shared library uses process.env.AUTH_PUBLIC_KEY)
  if (!process.env.AUTH_PUBLIC_KEY) missing.push("AUTH_PUBLIC_KEY");

  // Require Public WS URL in production
  if (process.env.NODE_ENV === "production" && !config.publicWsUrl) {
      missing.push("PUBLIC_WS_URL");
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}