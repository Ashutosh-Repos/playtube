import { validateConfig } from "./config";
import { rabbit } from "@repo/events";
import { startEventConsumer } from "./events/consumer";
import { startWorker } from "./queue/worker";

async function main() {
  console.log("🚀 Starting Transcoder Service...");
  
  // 0. Startup Cleanup - Prevent Disk Fill
  const TEMP_DIR = "/tmp/transcoder";
  try {
      if (require("fs").existsSync(TEMP_DIR)) {
          console.log(`🧹 Cleaning up old temp files in ${TEMP_DIR}...`);
          require("fs").rmSync(TEMP_DIR, { recursive: true, force: true });
      }
      require("fs").mkdirSync(TEMP_DIR, { recursive: true });
  } catch (e) {
      console.warn("⚠️ Failed to clean temp dir on startup:", e);
  }

  // 1. Validate Config
  try {
    validateConfig();
  } catch (error) {
    console.error("❌ Config validation failed:", error);
    process.exit(1);
  }

  // 2. Connect to RabbitMQ
  try {
    await rabbit.connect();
    console.log("✅ Connected to RabbitMQ");
  } catch(err) {
    console.error("❌ Failed to connect to RabbitMQ:", err);
    process.exit(1);
  }

  // 3. Start RabbitMQ Consumer
  await startEventConsumer();

  // 4. Start Worker
  startWorker();
  console.log("👷 BullMQ Worker initialized");

  console.log("🎥 Transcoder Service is running");
  
  // Graceful Shutdown
  const shutdown = async () => {
    console.log("🛑 Shutting down...");
    
    // Close RabbitMQ
    await rabbit.close();
    
    // Close BullMQ components
    // We import them here to assume they are already initialized modules
    const { worker } = await import("./queue/worker");
    const { transcodeQueue } = await import("./events/consumer");
    const { flowProducer } = await import("./queue/flow");
    
    await worker.close();
    await transcodeQueue.close();
    await flowProducer.close();
    
    console.log("✅ Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(console.error);
