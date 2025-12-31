import { z } from "zod";

export const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Auth Keys (RSA)
  AUTH_PRIVATE_KEY: z.string().optional(),
  AUTH_PUBLIC_KEY: z.string().optional(),
  
  // OAuth (Google)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // General
  APP_URL: z.string().url().optional().default("http://localhost:3000"), // Used for email links

  // Database
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional().default("redis://localhost:6379"),
  RABBITMQ_URL: z.string().url().optional().default("amqp://localhost:5672"),
  
  // Notification Service (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  
  // Security
  ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list
});

export type ServerEnv = z.infer<typeof serverSchema>;
