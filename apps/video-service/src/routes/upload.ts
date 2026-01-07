import { Router, Request, RequestHandler } from "express";
import { prisma } from "@repo/database";
import { cacheVideoStatus } from "../lib/redis";
import { 
  deleteObjectsWithPrefix,
  createMultipartUpload,
  getPresignedPartUrl,
  completeMultipartUpload,
  listUploadedParts,
  abortMultipartUpload,
  getObjectStat
} from "../lib/storage";
import { requireAuth, AuthUser } from "@repo/shared";
import { uploadVideoSchema } from "../validation/schema";
import { config } from "../config";
import { EVENTS, EXCHANGES, publishMessage } from "@repo/events";
import { publishToVideoChannel } from "../lib/redis";

const router: Router = Router();

// Extend Express Request to include user (if not already handled by types)
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * POST /videos/upload
 * Create video record and get presigned upload URL
 */
const uploadHandler: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;

    // Validate input
    const parsed = uploadVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    const { fileName, channelId } = parsed.data;

    // Verify channel ownership
    const userChannel = await prisma.channel.findFirst({
      where: { 
        id: channelId,
        userId: userId 
      },
      select: { id: true, handle: true, name: true, image: true, status: true },
    });

    if (!userChannel) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not own this channel or it does not exist" },
      });
    }

    if (userChannel.status !== "ACTIVE") {
        return res.status(403).json({
            success: false,
            error: { code: "CHANNEL_SUSPENDED", message: "This channel is suspended or restricted" },
        });
    }

    // Calculate expiry time
    const uploadExpiresAt = new Date(Date.now() + config.upload.presignedUrlExpiry * 1000);
    console.log(`[Pipeline] 🆕 Creating Video Record for ${fileName} (Channel: ${userChannel.handle})`);

    // Create video record
    const video = await prisma.video.create({
      data: {
        channelId: userChannel.id,
        title: fileName.replace(/\.[^/.]+$/, "").substring(0, 100), // Remove extension and truncate to 100 chars
        processingStatus: "UPLOADING",
        visibility: "PRIVATE",
        // Denormalized channel info
        channelHandle: userChannel.handle,
        channelName: userChannel.name,
        channelImage: userChannel.image,
        // Upload tracking
        originalFileName: fileName,
        uploadExpiresAt: uploadExpiresAt,
        uploadStartedAt: new Date(),
        uploadAttempts: 0,
      },
      select: {
        id: true,
        title: true,
        processingStatus: true,
        createdAt: true,
      },
    });

    // Initialize Multipart Upload (New Flow)
    const uploadId = await createMultipartUpload(video.id);

    // Update video with uploadId
    await prisma.video.update({
        where: { id: video.id },
        data: { uploadId }
    });

    // Cache initial status
    await cacheVideoStatus(video.id, {
      status: "uploading",
      progress: 0,
    });

    // WebSocket URL (absolute for client connection)
    // Pass token in query param for WS authentication
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    
    let wsUrl: string;
    console.log(`[Pipeline] 🔗 Generating WebSocket URL (Public: ${config.publicWsUrl || 'No'})`);
    if (config.publicWsUrl) {
        // Production/Docker: Use configured public ingress
        wsUrl = `${config.publicWsUrl}/ws/videos?id=${video.id}&token=${token}`;
    } else {
        // Local Dev: Fallback to request host
        const host = req.get("host") || `localhost:${config.port}`;
        const wsProtocol = req.protocol === "https" ? "wss" : "ws";
        wsUrl = `${wsProtocol}://${host}/ws/videos?id=${video.id}&token=${token}`;
    }

    console.log(`[Pipeline] 1. Upload Initiated: videoId=${video.id} channel=${userChannel.handle} uploadId=${uploadId}`);

    res.status(201).json({
      success: true,
      data: {
        videoId: video.id,
        uploadId,  // Multipart ID
        wsUrl,
        expiresAt: uploadExpiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(`[Pipeline] ❌ Upload Init Failed:`, error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to initiate upload" },
        });
  }
};

router.post("/", requireAuth, uploadHandler);

/**
 * POST /videos/:id/multipart/part
 * Get presigned URL for a chunk
 */
router.post("/:id/multipart/part", requireAuth, async (req : AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        
        if (!id) return res.status(400).json({ success: false, error: "Missing video ID" });

        const { uploadId, partNumber } = req.body; // Validation needed

        if (!uploadId || !partNumber) {
             return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "uploadId and partNumber required" }});
        }

        const video = await prisma.video.findUnique({
            where: { id },
            include: { channel: true }
        });

        if (!video || video.channel.userId !== userId) {
            return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Unauthorized" }});
        }

        // Verify uploadId matches DB to ensure we are appending to the correct session
        if (video.uploadId !== uploadId) {
             return res.status(400).json({ success: false, error: { code: "INVALID_SESSION", message: "Upload session mismatch. Please restart upload." }});
        }

        const url = await getPresignedPartUrl(id, String(uploadId), Number(partNumber));
        res.json({ success: true, data: { url } });

    } catch (error) {
        console.error("Multipart Part Error:", error);
        res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get part URL" }});
    }
});

/**
 * POST /videos/:id/multipart/complete
 * Finish the upload
 */
router.post("/:id/multipart/complete", requireAuth, async (req : AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        
        if (!id) return res.status(400).json({ success: false, error: "Missing video ID" });

        const { uploadId, parts } = req.body;

        if (!uploadId || !parts || !Array.isArray(parts)) {
             return res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "uploadId and parts array required" }});
        }

        const video = await prisma.video.findUnique({
             where: { id },
             include: { channel: true } 
        });

        if (!video || video.channel.userId !== userId) {
             return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Unauthorized" }});
        }
        
         if (video.uploadId !== uploadId) {
             return res.status(400).json({ success: false, error: { code: "INVALID_SESSION", message: "Upload session mismatch" }});
        }

        await completeMultipartUpload(id, String(uploadId), parts);
        
        // ---------------------------------------------------------------------
        // Consolidated Processing Trigger (Previously s3-events webhook)
        // ---------------------------------------------------------------------
        console.log(`[Pipeline] ✅ Multipart Upload Completed for ${id}. Triggering Processing...`);

        // 1. Get object key (must match storage.ts convention: uploads/{videoId}/original.mp4)
        const objectKey = `uploads/${id}/original.mp4`;
        let fileSize = 0;

        try {
            const stat = await getObjectStat(objectKey);
            fileSize = stat.size;
        } catch (e) {
            console.warn(`[Pipeline] ⚠️ Could not get stats for ${objectKey}, using 0 size`, e);
        }

        // 2. Update Database (UPLOADING -> PROCESSING)
        await prisma.video.update({
            where: { id },
            data: {
                processingStatus: "PROCESSING",
                originalFilePath: objectKey,
                originalFileSize: fileSize,
            }
        });

        // 3. Publish Event for Transcoder
        await publishMessage(EXCHANGES.VIDEO, EVENTS.VIDEO_UPLOADED, {
            videoId: id,
            channelId: video.channelId,
            fileName: objectKey,
            size: fileSize,
            mimetype: "video/mp4", // Default or should we detect? For now MP4 is safe assumption.
        });

        // 4. Update Cache & Broadcast (Shared with webhook logic)
        await cacheVideoStatus(id, {
            status: "processing",
            progress: 0,
        });

        await publishToVideoChannel(id, {
            type: "state",
            status: "processing",
            progress: 0,
        });

        console.log(`[Pipeline] 🚀 Transcode Event Published for ${id}`);
        res.json({ success: true });

    } catch (error) {
        console.error("Multipart Complete Error:", error);
        res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to complete upload" }});
    }
});

/**
 * GET /videos/:id/multipart
 * List uploaded parts for resume
 */
router.get("/:id/multipart", requireAuth, async (req : AuthenticatedRequest, res) => {
     try {
        const userId = req.user!.id;
        const { id } = req.params;
        
        if (!id) return res.status(400).json({ success: false, error: "Missing video ID" });
        
        const video = await prisma.video.findUnique({ 
            where: { id }, 
            include: { channel: true }
        });

        if (!video || video.channel.userId !== userId) {
             return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Unauthorized" }});
        }

        if (!video.uploadId) {
            return res.json({ success: true, data: { parts: [] } });
        }

        // Check if uploadId is still valid in S3 (it expires after 7 days usually if not completed)
        // For now, just list.
        if (video.uploadId) {
             const parts = await listUploadedParts(id, video.uploadId);
             res.json({ success: true, data: { parts } });
        } else {
             res.json({ success: true, data: { parts: [] } });
        }

     } catch(error) {
         console.error("Multipart List Error:", error);
         // If uploadId is invalid/not found in S3, return empty list to trigger restart?
         res.status(500).json({ success: false, error: "Failed to list parts" });
     }
});

/**
 * DELETE /videos/:id/multipart
 * Abort multipart upload (Clean up S3 parts)
 */
router.delete("/:id/multipart", requireAuth, async (req : AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        
        if (!id) return res.status(400).json({ success: false, error: "Missing video ID" });

        const video = await prisma.video.findUnique({
            where: { id },
            include: { channel: true }
        });

        if (!video || video.channel.userId !== userId) {
            return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Unauthorized" }});
        }

        if (video.uploadId) {
            await abortMultipartUpload(id, video.uploadId);
            console.log(`[Pipeline] 🛑 Aborted Multipart Upload for ${id}`);
        }

        res.json({ success: true });

    } catch (error) {
        console.error("Multipart Abort Error:", error);
        res.status(500).json({ success: false, error: "Failed to abort upload" });
    }
});

/**
 * POST /videos/:id/retry
 * Get a new presigned URL for an existing video (if upload failed)
 */
const retryHandler: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;
    
    console.log(`[Pipeline] Retry requested for video ${id}`);

    // Get video
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });
    
    if (!video) {
        console.warn(`[Pipeline] ⚠️ Retry failed: Video ${id} not found`);
        res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "Video not found" },
        });
        return;
    }

    // Check ownership
    if (video.channel.userId !== userId) {
        console.warn(`[Pipeline] ⚠️ Retry failed: Unauthorized for ${id}`);
        res.status(403).json({
            success: false,
            error: { code: "FORBIDDEN", message: "Not authorized" },
        });
        return;
    }

    // Ensure video is in a state that allows retry (UPLOADING or FAILED)
    if (video.processingStatus !== "UPLOADING" && video.processingStatus !== "FAILED") {
       console.warn(`[Pipeline] ⚠️ Retry failed: Invalid state ${video.processingStatus} for ${id}`);
       res.status(400).json({
         success: false,
         error: { code: "INVALID_STATE", message: `Cannot retry upload for video in status ${video.processingStatus}` },
       });
       return;
    }

    // Calculate new expiry time
    const uploadExpiresAt = new Date(Date.now() + config.upload.presignedUrlExpiry * 1000);

    // Initialize NEW Multipart Session for retry
    const uploadId = await createMultipartUpload(video.id);

    // Update video record (refresh expiry and track retry)
    await prisma.video.update({
        where: { id },
        data: {
            uploadExpiresAt,
            uploadAttempts: { increment: 1 },
            processingStatus: "UPLOADING", // Reset status to uploading if it was failed
            processingError: null,
            uploadId, // Update session
        },
    });

    // WebSocket URL Calculation
    // Include token for WS auth (matching initial upload)
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    
    let wsUrl: string;
    if (config.publicWsUrl) {
        wsUrl = `${config.publicWsUrl}/ws/videos?id=${video.id}&token=${token}`;
    } else {
        const host = req.get("host") || `localhost:${config.port}`;
        const wsProtocol = req.protocol === "https" ? "wss" : "ws";
        wsUrl = `${wsProtocol}://${host}/ws/videos?id=${video.id}&token=${token}`;
    }

    console.log(`[Pipeline] ✅ Retry Initiated for ${id} (Attempt ${video.uploadAttempts + 1}) uploadId=${uploadId}`);

    res.json({
      success: true,
      data: {
        videoId: video.id,
        uploadId,
        wsUrl,
        expiresAt: uploadExpiresAt.toISOString(),
      },
    });

  } catch (error) {
    console.error(`[Pipeline] ❌ Retry upload error:`, error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to generate retry URL" },
    });
  }
};



router.post("/:id/retry", requireAuth, retryHandler);
// router.post("/:id/thumbnail", requireAuth, thumbnailUploadHandler); // Removed as we use shared upload action

// Note: DELETE is handled by video.ts routes (/videos/:id) which includes
// soft-delete checks and proper event emission. Do not duplicate here.

export default router;