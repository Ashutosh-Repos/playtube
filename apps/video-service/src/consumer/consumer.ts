
import { 
    EVENTS, 
    EXCHANGES, 
    QUEUES,
    transcodeProgressSchema, 
    transcodeThumbnailsSchema, 
    transcodeCompletedSchema, 
    transcodeFailedSchema,
    rabbit
} from "@repo/events";
import { cacheVideoStatus, publishToVideoChannel } from "../lib/redis";
import { prisma } from "@repo/database";
import { getFileUrl } from "../lib/storage";
import { z } from "zod";

// Event types
type TranscodeProgressEvent = z.infer<typeof transcodeProgressSchema>;
type TranscodeThumbnailsEvent = z.infer<typeof transcodeThumbnailsSchema>;
type TranscodeCompletedEvent = z.infer<typeof transcodeCompletedSchema>;
type TranscodeFailedEvent = z.infer<typeof transcodeFailedSchema>;

export const startConsumer = async () => {
    try {
        console.log("🐰 Connecting Unified Consumer for Transcoder Events...");

        const queue = QUEUES.VIDEO_STATUS_QUEUE;
        const dlq = `${queue}.dlq`;

        const setupFn = async (channel: any) => {
            await channel.prefetch(20);

            // Assert DLQ
            await rabbit.assertQueue(dlq, { durable: true });

            // Assert Main Queue
            await rabbit.assertQueue(queue, { 
                durable: true,
                arguments: {
                    "x-dead-letter-exchange": "",
                    "x-dead-letter-routing-key": dlq
                }
            });

            // Bind ALL keys we care about
            await rabbit.bindQueue(queue, EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_PROGRESS);
            await rabbit.bindQueue(queue, EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_THUMBNAILS);
            await rabbit.bindQueue(queue, EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_COMPLETED);
            await rabbit.bindQueue(queue, EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_FAILED);

            await channel.consume(queue, async (msg: any) => {
                if (!msg) return;

                const routingKey = msg.fields.routingKey;
                let content: any;

                try {
                    content = JSON.parse(msg.content.toString());
                } catch (e) {
                    console.error("❌ Malformed JSON:", e);
                    channel.nack(msg, false, false);
                    return;
                }

                try {
                    switch (routingKey) {
                        case EVENTS.TRANSCODER_PROGRESS:
                            const prog = transcodeProgressSchema.parse(content);
                            console.log(`[Pipeline] 🔄 Received Progress for ${prog.videoId}: ${prog.progress}%`);
                            await handleProgress(prog);
                            break;
                            
                        case EVENTS.TRANSCODER_THUMBNAILS:
                            const thumb = transcodeThumbnailsSchema.parse(content);
                            console.log(`[Pipeline] 📷 Received Thumbnails for ${thumb.videoId}`);
                            await handleThumbnails(thumb);
                            break;
                            
                        case EVENTS.TRANSCODER_COMPLETED:
                            const comp = transcodeCompletedSchema.parse(content);
                            console.log(`[Pipeline] 🎉 Received Completed for ${comp.videoId}`);
                            await handleCompleted(comp);
                            break;
                            
                        case EVENTS.TRANSCODER_FAILED:
                            const fail = transcodeFailedSchema.parse(content);
                            console.log(`[Pipeline] ❌ Received Failed for ${fail.videoId}`);
                            await handleFailed(fail);
                            break;
                            
                        default:
                            console.warn(`⚠️ Unknown routing key: ${routingKey}`);
                            // Ack it so we don't loop, but maybe log it well
                    }
                    channel.ack(msg);
                } catch (e) {
                    console.error(`❌ Error processing ${routingKey}:`, e);
                    // Decide on DLQ vs Retry using Headers
                    if (e instanceof z.ZodError) {
                         console.error("Validation failed", e.errors);
                         channel.nack(msg, false, false); // Validation error = code bug, no point retrying
                    } else {
                        channel.nack(msg, false, false); // DLQ other errors for now (could retry logic later)
                    }
                }
            });
        };

        const consumerId = `video-unified-consumer-${Date.now()}`;
        await rabbit.createConsumerChannel(consumerId, setupFn);
        console.log("✅ Unified Consumer Started!");

    } catch (err) {
        console.error("Failed to start unified consumer:", err);
    }
};

// --- Handlers (Refactored to match flat schema) ---

async function handleProgress(payload: TranscodeProgressEvent): Promise<void> {
  const { videoId, progress, stage } = payload;
  // ... (rest same as before, just using payload directly)
  
  // Optimistic Cache update
  await cacheVideoStatus(videoId, { status: "processing", progress });
  await publishToVideoChannel(videoId, { type: "progress", status: "processing", progress, stage });

  // DB Update Guard
  if (progress % 25 === 0) {
    console.log(`[Pipeline] 💾 Saving Progress ${progress}% to DB for ${videoId}`);
    const video = await prisma.video.findUnique({ 
        where: { id: videoId },
        select: { processingStatus: true, deletedAt: true }
    });
    
    if (!video || video.deletedAt || video.processingStatus === "READY" || video.processingStatus === "FAILED") return;

    await prisma.video.update({
      where: { id: videoId },
      data: { processingProgress: progress },
    });
  }
}

async function handleThumbnails(payload: TranscodeThumbnailsEvent): Promise<void> {
  const { videoId, thumbnailOptions } = payload;
  const thumbnails = thumbnailOptions.map(t => getFileUrl(t)).filter((t): t is string => t !== null);

  const video = await prisma.video.findUnique({ 
    where: { id: videoId },
    select: { processingStatus: true, deletedAt: true }
  });

  if (!video || video.deletedAt || video.processingStatus !== "PROCESSING") return;

  await prisma.video.update({
    where: { id: videoId },
    data: { 
      thumbnailOptions, 
      thumbnailUrl: thumbnailOptions[0], 
    },
  });

  await cacheVideoStatus(videoId, { status: "processing", thumbnails });
  await publishToVideoChannel(videoId, { type: "thumbnails", thumbnails });
}

async function handleCompleted(payload: TranscodeCompletedEvent): Promise<void> {
  const { videoId, hlsPlaylistUrl, thumbnailOptions, previewSprite, duration, width, height, fps, resolutions } = payload;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { processingStatus: true, deletedAt: true },
  });

  if (!video || video.deletedAt || video.processingStatus === "READY") return;

  await prisma.video.update({
    where: { id: videoId },
    data: {
      processingStatus: "READY",
      processingProgress: 100,
      hlsPlaylistUrl,
      thumbnailUrl: thumbnailOptions[0],
      thumbnailOptions,
      previewSprite,
      duration,
      width,
      height,
      fps,
      resolutions,
    },
  });
  console.log(`[Pipeline] ✅ Video ${videoId} marked as READY in DB`);

  const fullHlsUrl = getFileUrl(hlsPlaylistUrl);
  const fullThumbnails = thumbnailOptions.map(t => getFileUrl(t)).filter((t): t is string => t !== null);

  await cacheVideoStatus(videoId, {
    status: "ready",
    progress: 100,
    thumbnails: fullThumbnails,
    hlsUrl: fullHlsUrl || undefined,
  });

  await publishToVideoChannel(videoId, {
    type: "state",
    status: "ready",
    progress: 100,
    thumbnails: fullThumbnails,
    hlsUrl: fullHlsUrl,
    canPublish: true,
  });
  
  // Publish Domain Event (Video Updated)
  const v = await prisma.video.findUnique({ where: { id: videoId }, select: { channelId: true } });
  if (v) {
       // TODO: Refactor 'publishMessage' to be robust or import it
       const { publishMessage } = await import("@repo/events"); 
       await publishMessage(EXCHANGES.VIDEO, EVENTS.VIDEO_UPDATED, {
           videoId,
           channelId: v.channelId,
           updates: ["processingStatus", "hlsPlaylistUrl"],
       });
  }
}

async function handleFailed(payload: TranscodeFailedEvent): Promise<void> {
    const { videoId, error, retryable } = payload;
    
    const video = await prisma.video.findUnique({ where: { id: videoId }, select: { processingStatus: true } });
    if (!video || video.processingStatus === "FAILED" || video.processingStatus === "READY") return;
    
    await prisma.video.update({
        where: { id: videoId },
        data: { processingStatus: "FAILED", processingError: error }
    });
    
    await cacheVideoStatus(videoId, { status: "failed", error });
    await publishToVideoChannel(videoId, { type: "state", status: "failed", error, retryable });
}
