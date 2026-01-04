
import dotenv from "dotenv";
dotenv.config();

// Patch BigInt for JSON serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import express from "express";
import http from "http";
import cors from "cors";
import { config } from "./config";
import rateLimit from "express-rate-limit";
import { setupWebSocket } from "./ws/server";
import uploadRoutes from "./routes/upload";
import videoRoutes from "./routes/video";
import s3EventRoutes from "./routes/s3-events";
import playlistRoutes from "./routes/playlist";
import channelRoutes from "./routes/channel";

// Import consumer to start listening (side-effect import or explicit start)
// Based on analysis, consumer has extensive logic but might not export a 'start' function directly 
// unless I define one. The view showed 'async function startConsumer'.
// I should likely check 'consumer/consumer.ts' exports again to be safe.
import { startConsumer } from "./consumer/consumer"; 


const app = express();
const server = http.createServer(app);

// Trust Proxy (required for correct protocol detection behind LB/Nginx)
app.set("trust proxy", 1);

// Middleware
app.use(cors({
  origin: config.allowedOrigins || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());



// Health Check
app.get("/health", async (req, res) => {
  try {
    const { prisma } = await import("@repo/database");
    const { redis } = await import("./lib/redis");
    
    // Deep check
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    
    res.status(200).json({ 
      status: "ok", 
      service: "video-service",
      checks: {
        database: "connected",
        redis: "connected"
      }
    });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ 
      status: "error", 
      service: "video-service",
      error: err instanceof Error ? err.message : "Unknown error" 
    });
  }
});

// WebSocket Server
const wsServer = setupWebSocket(server);

// Start Server
// Rate Limiting
// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
import { validateConfig } from "./config";

// Validate Environment
try {
  validateConfig();
} catch (err) {
  console.error("❌ Invalid Configuration:", err);
  process.exit(1);
}

import categoriesRoutes from "./routes/categories";

app.use("/videos/upload", limiter as any, uploadRoutes); // Public/Protected API + Rate Limit
app.use("/videos", limiter as any, videoRoutes); // General Video Management
app.use("/playlists", limiter as any, playlistRoutes); // Playlist Management
app.use("/channels", limiter as any, channelRoutes); // Channel Management
app.use("/categories", limiter as any, categoriesRoutes); // [NEW] Categories
app.use("/internal/s3-events", s3EventRoutes); // Internal Webhook - NO Rate Limit

// Global Error Handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("🔥 Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An internal server error occurred",
    },
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Unhandled Rejection at:", promise, "reason:", reason);
  // Optional: process.exit(1) if critical
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  // Critical error, should restart
  process.exit(1);
});

// Start Server
const PORT = config.port;
server.listen(PORT, async () => {
  console.log(`🚀 Video Service running on port ${PORT}`);
  console.log(`ws://localhost:${PORT}/ws/videos`);
  
  // Initialize Storage (MinIO Bucket)
  const { initStorage } = await import("./lib/storage");
  await initStorage();

  // Start Jobs
  const { startBackgroundJobs } = await import("./jobs/background");
  startBackgroundJobs();

  // Start Consumer
  startConsumer();
});

// Graceful Shutdown
const shutdown = async () => {
  console.log("🛑 SIGTERM received. Shutting down gracefully...");
  
  const { stopBackgroundJobs } = await import("./jobs/background");
  stopBackgroundJobs();
  
  server.close(async () => {
    console.log("HTTP Server closed.");
    // Close WebSocket Server
    try {
        await wsServer.shutdown();
    } catch (err) {
        console.error("Error shutting down WebSocket server:", err);
    }
  });

  try {
    const { prisma } = await import("@repo/database");
    await prisma.$disconnect();
    
    const { redis, redisSub } = await import("./lib/redis");
    await redis.quit();
    // await redisPub.quit(); // Reuse redis client
    await redisSub.quit();
    
    console.log("Database and Redis connections closed.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
