import "server-only";
import { hash, compare } from "bcryptjs";

/**
 * Hashes a plain text password using bcrypt.
 * @param plain The plain text password.
 * @returns The hashed password.
 */
export const hashPassword = async (plain: string): Promise<string> => {
  // Salt rounds: 12 (Good balance of security and performance)
  return await hash(plain, 12);
};

/**
 * Verifies a plain text password against a hash.
 * @param plain The plain text password.
 * @param hash The hashed password.
 * @returns True if the password matches, false otherwise.
 */
export const verifyPassword = async (
  plain: string,
  hash: string
): Promise<boolean> => {
  return await compare(plain, hash);
};
