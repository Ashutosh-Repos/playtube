// Background jobs for video-service
import { prisma } from "@repo/database";
import { deleteObjectsWithPrefix } from "../lib/storage";
import { publishMessage, EVENTS, EXCHANGES } from "@repo/events";
import { config } from "../config";

// ==================== Stale Upload Cleanup ====================

/**
 * Clean up uploads that never completed
 * Runs every hour, marks uploads older than threshold as FAILED
 */
export async function cleanupStaleUploads(): Promise<number> {
  const threshold = new Date(Date.now() - config.upload.staleUploadThreshold);
  
  // Find stale uploads
  const staleUploads = await prisma.video.findMany({
    where: {
      processingStatus: "UPLOADING",
      createdAt: { lt: threshold },
      deletedAt: null,
    },
    select: { id: true },
  });
  
  if (staleUploads.length === 0) {
    return 0;
  }
  
  console.log(`🧹 Found ${staleUploads.length} stale uploads`);
  
  // Mark as FAILED
  await prisma.video.updateMany({
    where: {
      id: { in: staleUploads.map((v) => v.id) },
      processingStatus: "UPLOADING",
    },
    data: {
      processingStatus: "FAILED",
      processingError: "Upload timed out",
    },
  });
  
  // Clean up MinIO objects
  for (const video of staleUploads) {
    try {
      await deleteObjectsWithPrefix(`uploads/${video.id}/`);
    } catch {
      // Ignore - might not exist
    }
  }
  
  console.log(`✅ Cleaned up ${staleUploads.length} stale uploads`);
  return staleUploads.length;
}

// ==================== Outbox Processor ====================

/**
 * Process unprocessed outbox events
 * Runs every minute, re-emits events that failed to publish
 */
export async function processOutbox(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // Find unprocessed events older than 5 minutes
  const unprocessedEvents = await prisma.outboxEvent.findMany({
    where: {
      processedAt: null,
      createdAt: { lt: fiveMinutesAgo },
    },
    take: 50, // Smaller batch to avoid clogging
    orderBy: { createdAt: "asc" },
  });
  
  if (unprocessedEvents.length === 0) {
    return 0;
  }
  
  console.log(`📤 Processing ${unprocessedEvents.length} outbox events`);
  
  for (const event of unprocessedEvents) {
    try {
      // Re-publish the message
      // Note: We reconstruct the exchange/routing key based on event type if needed
      // Ideally OutboxEvent should store exchange/routingKey, but schema might just have payload.
      // Based on schema analysis, if it only has 'eventType' and 'payload', we map manually.
      
      const exchange = EXCHANGES.VIDEO; // Default
      let routingKey = "";

      if (event.eventType === EVENTS.VIDEO_UPLOADED) routingKey = EVENTS.VIDEO_UPLOADED;
      else if (event.eventType === EVENTS.VIDEO_UPDATED) routingKey = EVENTS.VIDEO_UPDATED;
      else if (event.eventType === EVENTS.VIDEO_DELETED) routingKey = EVENTS.VIDEO_DELETED;
      else {
           // Fallback or unknown
           console.warn(`Unknown Outbox event type: ${event.eventType}, skipping autofix`);
           continue; 
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await publishMessage(exchange, routingKey as any, event.payload as object);

      // Mark processed
      await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() }
      });
      
      console.log(`✅ Processed outbox event: ${event.id}`);
    } catch (error) {
      console.error(`Failed to process outbox event ${event.id}:`, error);
    }
  }
  
  return unprocessedEvents.length;
}

// ==================== Retry Failed Transcodes ====================

/**
 * Retry videos that failed processing (up to 3 attempts)
 * Runs every 5 minutes
 */
export async function retryFailedTranscodes(): Promise<number> {
  // Find failed videos with < 3 attempts
  const failedVideos = await prisma.video.findMany({
    where: {
      processingStatus: "FAILED",
      uploadAttempts: { lt: 3 },
      deletedAt: null,
    },
    select: { 
      id: true, 
      channel: { select: { userId: true } }, 
      originalFilePath: true, // Use path not fileName if possible, schema dependent
      originalFileSize: true,
      uploadAttempts: true,
      channelId: true,
    },
    take: 10, // Process in batches
  });

  if (failedVideos.length === 0) {
    return 0;
  }

  console.log(`🔄 Retrying ${failedVideos.length} failed videos`);

  for (const video of failedVideos) {
    try {
      // Increment attempts first to prevent infinite loop if crash
      await prisma.video.update({
        where: { id: video.id },
        data: { 
          uploadAttempts: { increment: 1 },
          processingStatus: "PROCESSING", // Set back to processing
          processingError: null,
        },
      });

      // Infer mimetype from extension if possible
      const ext = video.originalFilePath?.split('.').pop()?.toLowerCase();
      let mimetype = "video/mp4";
      if (ext === "mov" || ext === "quicktime") mimetype = "video/quicktime";
      else if (ext === "webm") mimetype = "video/webm";
      else if (ext === "avi") mimetype = "video/x-msvideo";
      else if (ext === "mkv") mimetype = "video/x-matroska";

      // Re-emit uploaded event to trigger transcoder
      await publishMessage(
        EXCHANGES.VIDEO,
        EVENTS.VIDEO_UPLOADED,
        {
            videoId: video.id,
            channelId: video.channelId,
            fileName: video.originalFilePath || "unknown", // Using stored path
            size: Number(video.originalFileSize || 0),
            mimetype,
        }
      );
      
      console.log(`✅ Retried video ${video.id} (Attempt ${video.uploadAttempts + 1})`);
    } catch (error) {
      console.error(`Failed to retry video ${video.id}:`, error);
    }
  }

  return failedVideos.length;
}

// ==================== Hard Delete Cleanup ====================

/**
 * Hard delete videos that were soft deleted over 30 days ago
 * Runs daily
 */
export async function hardDeleteOldVideos(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const oldVideos = await prisma.video.findMany({
    where: {
      deletedAt: { lt: thirtyDaysAgo },
    },
    select: { id: true },
  });
  
  if (oldVideos.length === 0) {
    return 0;
  }
  
  console.log(`🗑️ Hard deleting ${oldVideos.length} old videos`);
  
  for (const video of oldVideos) {
    try {
      // Delete MinIO objects
      await deleteObjectsWithPrefix(`uploads/${video.id}/`);
      await deleteObjectsWithPrefix(`processed/${video.id}/`);
      
      // Hard delete from DB
      await prisma.video.delete({ where: { id: video.id } });
    } catch (error) {
      console.error(`Failed to hard delete video ${video.id}:`, error);
    }
  }
  
  console.log(`✅ Hard deleted ${oldVideos.length} old videos`);
  return oldVideos.length;
}

// ==================== Job Runner ====================

let intervalIds: NodeJS.Timeout[] = [];

/**
 * Start all background jobs
 */
export function startBackgroundJobs(): void {
  console.log("🔄 Starting background jobs");
  
  // Stale upload cleanup - every hour
  intervalIds.push(
    setInterval(async () => {
      try {
        await cleanupStaleUploads();
      } catch (error) {
        console.error("Stale upload cleanup error:", error);
      }
    }, 60 * 60 * 1000)
  );
  
  // Outbox processor - every minute
  intervalIds.push(
    setInterval(async () => {
      try {
        await processOutbox();
      } catch (error) {
        console.error("Outbox processor error:", error);
      }
    }, 60 * 1000)
  );

  // Retry failed transcodes - every 5 minutes
  intervalIds.push(
    setInterval(async () => {
      try {
        await retryFailedTranscodes();
      } catch (error) {
        console.error("Retry transcodes error:", error);
      }
    }, 5 * 60 * 1000)
  );
  
  // Hard delete - every 24 hours
  intervalIds.push(
    setInterval(async () => {
      try {
        await hardDeleteOldVideos();
      } catch (error) {
        console.error("Hard delete error:", error);
      }
    }, 24 * 60 * 60 * 1000)
  );
  
  // Run stale cleanup immediately on startup
  cleanupStaleUploads().catch(console.error);
}

/**
 * Stop all background jobs
 */
export function stopBackgroundJobs(): void {
  for (const id of intervalIds) {
    clearInterval(id);
  }
  intervalIds = [];
  console.log("🛑 Background jobs stopped");
}
