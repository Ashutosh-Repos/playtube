import { PrismaClient } from "@prisma/client";

// export * from "@prisma/client"; // Moved to index.ts to reduce chaining warnings
// export * from "./generated/prisma/models"; // Try without first, seemingly small file

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export let prisma: PrismaClient;

try {
  prisma = globalForPrisma.prisma || new PrismaClient({});
} catch (e) {
  console.error("❌ CRITICAL: Failed to initialize Prisma Client:", e);
  // @ts-ignore
  prisma = {} as PrismaClient;
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
