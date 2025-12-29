import { z } from "zod";

export const userEmailVerificationTokenCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export const userPasswordResetTokenCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  token: z.string(),
  expiresAt: z.string().datetime(),
});
