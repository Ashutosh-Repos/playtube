import { Worker, Job } from "bullmq";
import { config, getRedisConnection } from "../config";
import { QUEUES, JOBS } from "./definitions";
import { downloadFile, uploadFile, uploadStream, ensureDir } from "../lib/storage";
import { probeVideo, transcodeResolution, generateThumbnails, createMasterPlaylist, generatePreviewSprite } from "../lib/ffmpeg";
import * as path from "path";
import * as fs from "fs";
import { addTranscodeFlow } from "./flow";
import { EVENTS, EXCHANGES, publishMessage } from "@repo/events";

// Temporary scratch space
const TEMP_DIR = "/tmp/transcoder";

/**
 * The Master Worker
 * Handles all job types in the 'transcode-queue'
 */
/**
 * The Master Worker
 * Handles all job types in the 'transcode-queue'
 */
export let worker: Worker;

export const startWorker = () => {
    worker = new Worker(QUEUES.TRANSCODE, async (job: Job) => {
        console.log(`[Pipeline] 👷 Job ${job.name} started (ID: ${job.id}) - Data: ${JSON.stringify(job.data)}`);
        
        try {
            switch (job.name) {
                case JOBS.PROBE_AND_SPLIT:
                    return await handleProbeAndSplit(job);
                case JOBS.TRANSCODE_CHUNK:
                    return await handleTranscodeChunk(job);
                case JOBS.GENERATE_THUMBNAILS:
                    return await handleThumbnails(job);
                case JOBS.GENERATE_SPRITE:
                    return await handleGenerateSprite(job);
                case JOBS.MERGE_MANIFEST:
                    return await handleMergeManifest(job);
                case JOBS.CONTENT_MODERATION:
                    return await handleContentModeration(job);
                default:
                    throw new Error(`Unknown job type: ${job.name}`);
            }
        } catch (error) {
            console.error(`❌ Job ${job.name} failed:`, error);
            throw error;
        }
    }, {
        connection: getRedisConnection(),
        concurrency: parseInt(process.env.TRANSCODER_CONCURRENCY || "2"), // Configurable scaling
        lockDuration: 60000, 
        maxStalledCount: 2, // Allow 2 stalled retries
    });
    
    // Cleanup Listener: Remove temp files only on FINAL failure
    worker.on("failed", async (job, err) => {
        if (job && job.data && job.data.videoId) {
            // Check if we have exhausted retries
            const maxAttempts = job.opts.attempts || 1;
            if (job.attemptsMade >= maxAttempts) {
                console.warn(`💀 Job ${job.name} exhausted retries. Nuking temp dir for ${job.data.videoId}...`);
                try {
                     const vidDir = path.join(TEMP_DIR, job.data.videoId);
                     if (fs.existsSync(vidDir)) {
                         fs.rmSync(vidDir, { recursive: true, force: true });
                         console.log(`🧹 Cleaned up ${vidDir}`);
                     }
                } catch (e) {
                    console.error("Failed to cleanup temp dir:", e);
                }
            }
        }
    });

    return worker;
};

// --- Startup Check ---
// Fail fast if FFmpeg is not found
import { execSync } from "child_process";
try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    console.log("✅ FFmpeg binary found");
} catch (error) {
    console.error("❌ FFmpeg binary NOT found in PATH. Please install ffmpeg.");
    process.exit(1);
}

// --- Handlers ---

/**
 * 1. PROBE STEP
 * Downloads file, Checks Resolution, Spawns Parallel Flow
 */
async function handleProbeAndSplit(job: Job) {
    const { videoId, fileName } = job.data;
    // Use the fileName provided by the event (which includes the full S3 key + extension)
    const s3Key = fileName;
    const localInput = path.join(TEMP_DIR, videoId, "original.mp4");
    
    ensureDir(path.dirname(localInput));
    
    // Download
    console.log(`[Pipeline] ⬇️ Downloading ${s3Key} to ${localInput}...`);
    await downloadFile(s3Key, localInput);
    
    // Probe
    const metadata = await probeVideo(localInput);
    console.log(`🔎 Probed ${videoId}: ${metadata.width}x${metadata.height}, ${metadata.duration}s`);
    
    // Decision Ladder
    const height = metadata.height;
    const resolutions = [];
    
    if (height >= 2160) resolutions.push({ width: 3840, height: 2160, bandwidth: 14000000, name: "4k" });
    if (height >= 1440) resolutions.push({ width: 2560, height: 1440, bandwidth: 10000000, name: "2k" });
    if (height >= 1080) resolutions.push({ width: 1920, height: 1080, bandwidth: 6000000, name: "1080p" });
    if (height >= 720)  resolutions.push({ width: 1280, height: 720,  bandwidth: 3000000, name: "720p" });
    if (height >= 480)  resolutions.push({ width: 854,  height: 480,  bandwidth: 1500000, name: "480p" });
    resolutions.push({ width: 640, height: 360, bandwidth: 800000, name: "360p" }); // Always include 360p
    
    // Chain: Probe -> Content Moderation -> Transcode Flow
    // Instead of spawning the flow directly, we pass the baton to the Moderator.
    const { transcodeQueue } = await import("../events/consumer");
    
    await transcodeQueue.add(JOBS.CONTENT_MODERATION, {
        videoId,
        inputPath: s3Key,
        resolutions,
        metadata: { 
            duration: metadata.duration, 
            fps: metadata.fps 
        }
    }, {
        removeOnComplete: { count: 100, age: 24 * 3600 },
        removeOnFail: { age: 24 * 3600 }
    });
    
    console.log(`🛡️ Sent ${videoId} to Content Moderation`);
    
    return { resolutions };
}

/**
 * 1.5 CONTENT MODERATION (Stub)
 * Checks for NSFW/Copyright.
 */
async function handleContentModeration(job: Job) {
    const { videoId, inputPath, resolutions, metadata } = job.data;
    
    console.log(`🛡️ Scanning content for video ${videoId}...`);
    
    // Stub: Simulate AI check delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Future: Call external API (e.g. AWS Rekognition)
    // if (unsafe) throw new Error("Content Policy Violation");
    
    console.log(`✅ Content checks passed for ${videoId}`);
    
    // Proceed to Transcode Flow
    await addTranscodeFlow(videoId, inputPath, resolutions, metadata);
    
    return { status: "approved" };
}

/**
 * 2. TRANSCODE CHUNK
 * Transcodes 1 resolution
 */
async function handleTranscodeChunk(job: Job) {
    const { videoId, inputPath: s3Key, resolution } = job.data;
    const localDir = path.join(TEMP_DIR, videoId, resolution.name);
    const localInput = path.join(TEMP_DIR, videoId, "original.mp4");
    
    ensureDir(localDir);
    
    // Optimisation: Check if file exists
    // Optimisation: "Download Once" Strategy with File Lock
    const lockFile = `${localInput}.lock`;
    
    // 1. Check if file exists fully
    if (!fs.existsSync(localInput)) {
        // 2. Check if locked by another worker in this pod
        // 2. Check if locked by another worker in this pod
        let fd: number | null = null;
        try {
            // Atomic check-and-create: 'wx' fails if file exists
            fd = fs.openSync(lockFile, 'wx');
            fs.writeSync(fd, "LOCKED");
            fs.closeSync(fd);
            
            // We got the lock!
             try {
                // 4. Download
                console.log(`[Pipeline] ⬇️ Downloading ${s3Key} (Primary)...`);
                await downloadFile(s3Key, localInput);
             } catch (e) {
                 // Clean up if download failed
                 if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
                 if (fs.existsSync(localInput)) fs.rmSync(localInput, { force: true });
                 throw e;
             } finally {
                 // 5. Release Lock
                 if (fs.existsSync(lockFile)) fs.rmSync(lockFile, { force: true });
             }

        } catch (err: any) {
            if (err.code === 'EEXIST') {
                 // Lock exists, someone else is downloading
                 console.log(`🔒 Found lock for ${s3Key}, waiting for download...`);
                 await waitForFile(localInput, lockFile);
            }
        }
    } else {
        // Double check it's not a partial download (lock file still exists?)
        // Atomic 'wx' isn't needed here as we are just reading, but waitForFile is safe.
        if (fs.existsSync(lockFile)) {
             console.log(`🔒 Found orphan/active lock for existing file, waiting...`);
             await waitForFile(localInput, lockFile);
        }
    }
    
    console.log(`⚙️ Transcoding ${resolution.name}...`);
    // Pass progress
    await transcodeResolution(localInput, localDir, resolution, async (percent) => {
        // Debounce or just update. BullMQ handles throttling reasonably well but good to not flood.
        // We'll update max every 1% change or so.
        await job.updateProgress(percent);
        
        // Publish Progress to RabbitMQ for API/Frontend
        // Simple throttling: Only publish every 10% or 100% to reduce RabbitMQ load
        if (percent % 10 === 0 || percent === 100) {
            await publishMessage(EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_PROGRESS, {
                videoId,
                progress: percent,
                stage: "transcoding"
            });
        }
    });
    
    // Upload Artifacts (Playlist + Segments)
    console.log(`⬆️ Uploading ${resolution.name} artifacts...`);
    const files = fs.readdirSync(localDir);
    for (const file of files) {
        const key = `processed/${videoId}/${resolution.name}/${file}`;
        const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/MP2T";
        await uploadFile(key, path.join(localDir, file), contentType);
    }

    // Cleanup local resolution artifacts (save disk space)
    try {
        fs.rmSync(localDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up ${localDir}`);
    } catch (e) {
        console.warn(`⚠️ Failed to cleanup ${localDir}:`, e);
    }
    
    return { resolution: resolution.name };
}

/**
 * 3. THUMBNAILS
 */
async function handleThumbnails(job: Job) {
   const { videoId, inputPath: s3Key } = job.data;
   const localDir = path.join(TEMP_DIR, videoId, "thumbnails");
   const localInput = path.join(TEMP_DIR, videoId, "original.mp4");
   
   ensureDir(localDir);
   
   if (!fs.existsSync(localInput)) {
       await downloadFile(s3Key, localInput);
   }
   
   console.log(`[Pipeline] 📷 Generating thumbnails...`);
   const filenames = await generateThumbnails(localInput, localDir);
   
   const thumbnailKeys = [];
   for (const file of filenames) {
        const key = `processed/${videoId}/thumbnails/${file}`;
        await uploadFile(key, path.join(localDir, file), "image/jpeg");
        thumbnailKeys.push(key);
   }

   // Publish Thumbnails Event to RabbitMQ
   await publishMessage(EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_THUMBNAILS, {
       videoId,
       thumbnailOptions: thumbnailKeys
   });
   
   return { thumbnailKeys };
}

/**
 * 3a. SPRITE GENERATION
 */
async function handleGenerateSprite(job: Job) {
    const { videoId, inputPath: s3Key, duration } = job.data;
    const localDir = path.join(TEMP_DIR, videoId, "sprite");
    const localInput = path.join(TEMP_DIR, videoId, "original.mp4");

    ensureDir(localDir);

    if (!fs.existsSync(localInput)) {
        await downloadFile(s3Key, localInput);
    }

    console.log(`[Pipeline] 🎞️ Generating preview sprite (duration: ${duration}s)...`);
    // Use adaptive strategy based on duration
    const spriteFile = await generatePreviewSprite(localInput, localDir, duration);
    
    // Upload Sprite
    const key = `processed/${videoId}/sprite/${spriteFile}`;
    await uploadFile(key, path.join(localDir, spriteFile), "image/jpeg");
    
    // Cleanup
    try {
        fs.rmSync(localDir, { recursive: true, force: true });
    } catch(e) {}

    return { spriteKey: key };
}

/**
 * 4. MERGE (Root)
 * Waits for all, creates master playlist, notifies completion
 */
async function handleMergeManifest(job: Job) {
   const { videoId, resolutions, metadata } = job.data;
   
   // Get children results
   const childrenValues = await job.getChildrenValues(); 
   
   // Extract thumbnail keys
   let thumbnailOptions: string[] = [];
   // Extract Sprite Key
   let previewSprite: string | undefined = undefined;

   Object.values(childrenValues).forEach((val: any) => {
       if (val && val.thumbnailKeys) {
           thumbnailOptions = val.thumbnailKeys;
       }
       if (val && val.spriteKey) {
           previewSprite = val.spriteKey;
       }
   });

   const localDir = path.join(TEMP_DIR, videoId);
   ensureDir(localDir); // Ensure dir exists even if worker restarted
   console.log("📝 Creating Master Playlist...");
   await createMasterPlaylist(localDir, resolutions);
   
   const masterKey = `processed/${videoId}/master.m3u8`;
   await uploadFile(masterKey, path.join(localDir, "master.m3u8"), "application/vnd.apple.mpegurl");
   
   console.log("✅ Transcoding Flow Complete!");
   
   // Publish Event to RabbitMQ
   console.log(`[Pipeline] 📤 Publishing TRANSCODER_COMPLETED for ${videoId}`);
   await publishMessage(EXCHANGES.TRANSCODER, EVENTS.TRANSCODER_COMPLETED, {
       videoId,
       hlsPlaylistUrl: masterKey,
       thumbnailOptions,
       previewSprite, 
       duration: metadata?.duration || 0, 
       width: resolutions[0].width,
       height: resolutions[0].height,
       fps: metadata?.fps || 30,
       resolutions: resolutions.map((r: any) => r.name),
   } as any); // Casting as any to allow new fields while we update the schema in parallel if not already matched
   
   // Cleanup local files
   fs.rmSync(path.join(TEMP_DIR, videoId), { recursive: true, force: true });
   
   return { masterKey, thumbnailOptions, previewSprite };
}

/**
 * Helper: Wait for file to appear and lock to disappear
 */
async function waitForFile(filePath: string, lockPath: string, timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (fs.existsSync(filePath) && !fs.existsSync(lockPath)) {
            return; // Ready
        }
        await new Promise(r => setTimeout(r, 1000)); // Poll every 1s
    }
    throw new Error(`Timeout waiting for file download: ${filePath}`);
}
