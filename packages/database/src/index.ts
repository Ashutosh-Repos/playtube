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
// export * from "@prisma/client"; 
// Best Practice: Import types directly from "@prisma/client" to avoid CommonJS/ESM interop warnings in Next.js

// Re-export generated Prisma client after running db:generate
// export * from "./generated/prisma";
