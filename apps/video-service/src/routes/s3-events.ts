// S3 Event Handler for MinIO notifications
// This handles MinIO bucket notifications when objects are uploaded
import { Router, type Router as RouterType } from "express";
import { prisma } from "@repo/database";
import { extractVideoIdFromPath, getObjectStat } from "../lib/storage";
import { cacheVideoStatus, publishToVideoChannel } from "../lib/redis";
import { EVENTS, EXCHANGES, publishMessage } from "@repo/events";
import { config } from "../config";

const router: RouterType = Router();

// MinIO S3 Event payload structure
interface S3Event {
  EventName: string;
  Key: string;
  Records?: Array<{
    eventName: string;
    s3: {
      bucket: { name: string };
      object: { key: string; size: number; contentType?: string };
    };
  }>;
}

/**
 * POST /internal/s3-events
 * Webhook endpoint for MinIO bucket notifications
 * Configure MinIO to send events here: mc event add myminio/play-videos arn:minio:sqs::1:webhook --event put
 */
router.post("/", async (req, res) => {
  console.log(`[Pipeline] S3 Event Webhook HIT`);
  try {
    // 1. Security Check: Validation Token
    const token = req.query.token as string || req.headers.authorization?.replace("Bearer ", "");
    const secret = config.minio.webhookSecret;

    if (!secret) {
        console.error("S3_WEBHOOK_SECRET not configured");
        console.warn("⛔ Suspicious S3 event - Invalid or missing token");
        return res.status(200).json({ ok: true }); 
    }

    if (token !== secret) {
       console.warn(`[Pipeline] ⛔ Suspicious S3 event - Invalid token: ${token}`);
       return res.status(200).json({ ok: true }); 
    }

    console.log(`[Pipeline] 1. 📥 Received S3 Event Webhook (Valid Token)`);

    const event = req.body as S3Event;
    
    // Handle different event formats (MinIO can send in different ways)
    let objectKey: string;
    let objectSize: number | undefined;
    
    if (event.Records && event.Records.length > 0) {
      // Standard S3 event format
      const record = event.Records[0];
      objectKey = decodeURIComponent(record!.s3.object.key);
      objectSize = record!.s3.object.size;
    } else if (event.Key) {
      // Simplified format
      objectKey = event.Key;
    } else {
      console.warn("Unknown S3 event format:", event);
      return res.status(200).json({ ok: true }); // Ack anyway
    }
    
    // Only handle object creation events
    const eventName = event.EventName || event.Records?.[0]?.eventName || "";
    if (!eventName.includes("Put") && !eventName.includes("Created")) {
      return res.status(200).json({ ok: true });
    }
    
    // Extract videoId from path (uploads/{videoId}/original)
    const videoId = extractVideoIdFromPath(objectKey);
    if (!videoId) {
      console.log(`[Pipeline] Ignoring non-video object: ${objectKey}`);
      return res.status(200).json({ ok: true });
    }
    
    console.log(`[Pipeline] 2. Validated S3 Event for Video: ${videoId} | Key: ${objectKey} | Event: ${eventName}`);
    
    // Get file size if not in event
    if (!objectSize || objectSize === 0) {
      try {
        console.log(`[Pipeline] Fetching object stats for size...`);
        const stat = await getObjectStat(objectKey);
        objectSize = stat.size;
        
        if (objectSize === 0) {
            console.warn(`[Pipeline] ⚠️ Uploaded file ${objectKey} is 0 bytes. Ignoring.`);
            return res.status(200).json({ ok: true, reason: "empty_file" });
        }
      } catch {
        console.warn(`[Pipeline] ⚠️ Could not get stats for ${objectKey}. Ignoring.`);
        return res.status(200).json({ ok: true });
      }
    }
    
    // Update video with conditional check (idempotent)
    const updated = await prisma.video.updateMany({
      where: {
        id: videoId,
        processingStatus: "UPLOADING",
      },
      data: {
        processingStatus: "PROCESSING",
        originalFilePath: objectKey,
        originalFileSize: objectSize,
      },
    });
    
    if (updated.count === 0) {
      console.log(`[Pipeline] ⚠️ Video ${videoId} already processed/not found (Update count: 0)`);
      // Validate true status for logs
      const check = await prisma.video.findUnique({ where: { id: videoId }, select: { processingStatus: true }});
      console.log(`[Pipeline] Current Status for ${videoId}: ${check?.processingStatus}`);
      return res.status(200).json({ ok: true });
    }
    
    console.log(`[Pipeline] 3. Database Updated (UPLOADING -> PROCESSING) for ${videoId}`);
    
    // Extract content type from event if available
    const contentType = event.Records?.[0]?.s3.object.contentType || "video/mp4";

    // Fetch video to get userId for event
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { 
        channelId: true,
        channel: { select: { userId: true } } 
      }
    });

    if (video) {
        console.log(`[Pipeline] 4. Triggering Transcode Event for ${videoId}`);
        // Publish event to RabbitMQ (Transcoder service listens to this)
        await publishMessage(
            EXCHANGES.VIDEO,
            EVENTS.VIDEO_UPLOADED,
            {
                videoId,
                channelId: video.channelId,
                fileName: objectKey,
                size: objectSize || 0,
                mimetype: contentType,
            }
        );
        console.log(`[Pipeline] ✅ VIDEO_UPLOADED event published for ${videoId}`);
    } else {
        console.warn(`[Pipeline] ⚠️ Could not find video ${videoId} metadata for event emission`);
    }
    
    // Update cache
    await cacheVideoStatus(videoId, {
      status: "processing",
      progress: 0,
    });
    
    // Broadcast to WebSocket
    await publishToVideoChannel(videoId, {
      type: "state",
      status: "processing",
      progress: 0,
    });
    
    console.log(`[Pipeline] 5. Cache updated and WS broadcast sent for ${videoId}`);
    
    res.status(200).json({ ok: true, videoId });
  } catch (error) {
    console.error(`[Pipeline] ❌ S3 event error:`, error);
    // Still return 200 to prevent MinIO from retrying
    res.status(200).json({ ok: true, error: "Processing failed" });
  }
});

export default router;
