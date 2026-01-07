/**
 * Database Utilities Package
 *
 * This package provides Prisma client utilities.
 * Each service should use this package for database access.
 *
 * Prisma 7 generates client to src/generated/prisma
 * Run `pnpm db:generate` after updating schema.
 */
export type { Prisma, PrismaClient } from "@prisma/client";
export * from "./client";
export * from "./cleanup";
export * from "./selects";
//# sourceMappingURL=index.d.ts.map