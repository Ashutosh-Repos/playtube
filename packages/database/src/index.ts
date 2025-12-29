/**
 * Database Utilities Package
 * 
 * This package provides Prisma client utilities.
 * Each service should use this package for database access.
 * 
 * Prisma 7 generates client to src/generated/prisma
 * Run `pnpm db:generate` after updating schema.
 */

export * from "./client";
export * from "./cleanup";

// Re-export generated Prisma client after running db:generate
// export * from "./generated/prisma";
