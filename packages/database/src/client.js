import { PrismaClient } from "@prisma/client";
// export * from "@prisma/client"; // Moved to index.ts to reduce chaining warnings
// export * from "./generated/prisma/models"; // Try without first, seemingly small file
const globalForPrisma = globalThis;
export let prisma;
try {
    prisma = globalForPrisma.prisma || new PrismaClient({});
}
catch (e) {
    console.error("❌ CRITICAL: Failed to initialize Prisma Client:", e);
    // @ts-ignore
    prisma = {};
}
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
//# sourceMappingURL=client.js.map