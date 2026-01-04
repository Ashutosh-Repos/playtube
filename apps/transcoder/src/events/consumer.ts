import { consumeMessage, EVENTS, EXCHANGES, QUEUES, videoUploadedSchema, publishMessage } from "@repo/events";
import { JOBS, QUEUES as BULL_QUEUES } from "../queue/definitions";
import { getRedisConnection } from "../config";
import { z } from "zod";
import { Queue, QueueEvents } from "bullmq";

type VideoUploadedEvent = z.infer<typeof videoUploadedSchema>;

// Need a reference to the 'transcode-queue' to add the INITIAL probe job.
// The 'addTranscodeFlow' creates the TREE, but we need to kick it off.

export const transcodeQueue = new Queue(BULL_QUEUES.TRANSCODE, {
    connection: getRedisConnection()
});

export const transcodeQueueEvents = new QueueEvents(BULL_QUEUES.TRANSCODE, {
    connection: getRedisConnection()
});

transcodeQueueEvents.on("progress", ({ jobId, data }) => {
    // 'data' is the percent value number or object passed to updateProgress
    // In worker.ts we passed a number.
    // NOTE: This global listener hears ALL job progress.
    // For 'transcode-chunk', this is great. 
    // Ideally we would aggregate this or just forward it.
    // For now, we Log it to show it works, as requested.
    // console.log(`📈 Job ${jobId} Progress: ${data}%`);
});

transcodeQueueEvents.on("failed", async ({ jobId, failedReason }) => {
    console.error(`❌ Job ${jobId} failed: ${failedReason}`);
    try {
        const job = await transcodeQueue.getJob(jobId);
        if (job && job.data && job.data.videoId) {
            await publishMessage(EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_FAILED, {
                videoId: job.data.videoId,
                error: failedReason,
                stage: job.name,
                retryable: false // BullMQ exhausted retries
            });
            console.log(`🚨 Sent TRANSCODER_FAILED event for ${job.data.videoId}`);
        }
    } catch (e) {
        console.error("Failed to publish failure event:", e);
    }
});

export const startEventConsumer = async () => {
    console.log("👂 Starting Event Consumer...");
    // ... [Rest of functionality]
    // ...
    try {
        await consumeMessage(
            QUEUES.TRANSCODER_QUEUE, // Expected queue name for Transcoder Service
            EXCHANGES.VIDEO,
            EVENTS.VIDEO_UPLOADED,
            videoUploadedSchema,
            async (rawMessage: VideoUploadedEvent) => {
                try {
                    const message = videoUploadedSchema.parse(rawMessage);
                    console.log(`[Pipeline] 📥 Transcoder Consumer: Received VIDEO_UPLOADED for ${message.videoId}`);
                    
                    // Add Probe Job to BullMQ
                    await transcodeQueue.add(JOBS.PROBE_AND_SPLIT, {
                        videoId: message.videoId,
                        fileName: message.fileName,
                    }, {
                        removeOnComplete: { count: 100, age: 24 * 3600 },
                        removeOnFail: { age: 24 * 3600 }
                    });
                    
                    console.log(`✅ Added PROBE job for ${message.videoId}`);
                } catch (error) {
                    console.error("Failed to process VIDEO_UPLOADED:", error);
                }
            }
        );
        console.log("🐰 Connected to RabbitMQ Queue: " + QUEUES.TRANSCODER_QUEUE);
    } catch (err) {
        console.error("Consumer connection failed:", err);
    }
};
