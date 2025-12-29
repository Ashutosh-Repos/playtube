import { z } from "zod";

/**
 * Validates environment variables against a Zod schema
 */
export function createEnv<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return result.data;
}

/**
 * Gets an environment variable with optional default
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}
