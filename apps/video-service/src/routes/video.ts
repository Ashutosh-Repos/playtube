
import { Router, Request, Response } from "express";
import { prisma, Prisma, videoSelect, videoListSelect } from "@repo/database";
import { requireAuth, AuthUser, getSession, VideoDetails, VideoListItem } from "@repo/shared";
import { z } from "zod";
import { publishMessage, EXCHANGES, EVENTS } from "@repo/events";
import { deleteObjectsWithPrefix, getFileUrl, abortMultipartUpload } from "../lib/storage";

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Local types based on shared selects
type VideoResponse = Prisma.VideoGetPayload<{
  select: typeof videoSelect;
}>;

const router = Router();

// Validation schema for updating video details
const updateVideoSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"]).optional(),
  categoryId: z.string().optional().nullable(),
  language: z.string().max(10).optional().nullable(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().optional().nullable(),
  allowComments: z.boolean().optional(),
  allowEmbedding: z.boolean().optional(),
  isAgeRestricted: z.boolean().optional(),
  isPremiere: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  premiereStartsAt: z.string().datetime().optional().nullable(),
  chapters: z.array(z.object({
    title: z.string().min(1).max(100),
    startTime: z.number().int().min(0),
  })).optional(),
  cards: z.array(z.object({
    type: z.enum(["VIDEO", "PLAYLIST", "CHANNEL", "LINK", "POLL"]),
    title: z.string().max(100).optional().nullable(),
    startTime: z.number().int().min(0),
    endTime: z.number().int().min(0).optional().nullable(),
    targetVideoId: z.string().optional().nullable(),
    targetPlaylistId: z.string().optional().nullable(),
    targetChannelId: z.string().optional().nullable(),
    targetUrl: z.string().url().optional().nullable(),
    pollOptions: z.array(z.string()).optional().nullable(),
  })).optional(),
});

const thumbnailUploadSchema = z.object({
  contentType: z.string().regex(/^image\/(jpeg|png|webp|jpg)$/),
});

// Helper to transform DB Video object for API response
// Converts S3 keys to full signed/public URLs
const transformVideo = (video: any): VideoDetails => {
    if (!video) return null as any;
    
    // Explicitly handle Date -> String conversion for type safety
    // even though res.json() does this, we want the object to match 
    // the TransformedVideo type before it leaves the handler.
    const formatDate = (date: any) => (date instanceof Date ? date.toISOString() : date);

    return {
        ...video,
        viewCount: Number(video.viewCount || 0),
        thumbnailUrl: getFileUrl(video.thumbnailUrl),
        hlsPlaylistUrl: getFileUrl(video.hlsPlaylistUrl),
        previewSprite: getFileUrl(video.previewSprite),
        // Transform Dates to Strings
        createdAt: formatDate(video.createdAt),
        updatedAt: formatDate(video.updatedAt),
        publishedAt: formatDate(video.publishedAt),
        scheduledAt: formatDate(video.scheduledAt),
        // Transform thumbnail options array
        thumbnailOptions: Array.isArray(video.thumbnailOptions) 
            ? video.thumbnailOptions.map((k: string) => getFileUrl(k))
            : [],
    };
};

/**
 * GET /videos
 * List videos for the authenticated user (Studio Dashboard)
 * Supports filtering by channelId
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { channelId, page = "1", limit = "10", status } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const where: any = {
      channel: { userId: userId }, // Ensure user owns the channel
      deletedAt: null,
    };

    if (channelId) {
      where.channelId = channelId as string;
    }

    if (status) {
        where.processingStatus = status as string;
    }

    // Optimize: Run both queries in parallel with transaction
    const [videos, total] = await prisma.$transaction([
      prisma.video.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
        // Optimized select for Studio Content table - only essential fields
        select: videoListSelect,
      }),
      prisma.video.count({ where }),
    ]);

    res.json({
      success: true,
      data: videos.map(v => transformVideo(v)),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get videos error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch videos" },
    });
  }
});

/**
 * GET /videos/:id
 * Get single video details (Public + Owner view)
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Optional Auth: Manually extract user to check ownership for private videos
    const session = await getSession(req);
    const authUserId = session?.user?.id;

    

    const video = await prisma.video.findFirst({
      where: { 
        id, 
        deletedAt: null,
        OR: [
          { visibility: { in: ["PUBLIC", "UNLISTED"] } },
          { channel: { userId: authUserId || "ANONYMOUS" } }
        ]
      },
      select: videoSelect,
    }) as VideoResponse;

    if (!video) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found or access denied" },
      });
    }
    // Transform (Key -> URL)
    res.json({
      success: true,
      data: transformVideo(video),
    });
  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch video details" },
    });
  }
});

/**
 * PATCH /videos/:id
 * Update video metadata
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;

    // Validate body
    const parsed = updateVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid input" },
      });
    }

    // Find video and check ownership
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });

    if (!video || video.deletedAt) {
      console.warn(`[Video] ⚠️ Update failed: Video ${id} not found`);
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    if (video.channel.userId !== userId) {
      console.warn(`[Video] ⚠️ Update failed: Unauthorized for ${id}`);
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized to update this video" },
      });
    }
    
    console.log(`[Video] Updating video ${id} with:`, JSON.stringify(parsed.data));

    // Extract nested data
    const { chapters, cards, ...videoData } = parsed.data;

    // Update
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        ...videoData,
        updatedAt: new Date(),
        // Nested updates: Simple replacement (Delete old, create new)
        // This is safest for these types of metadata
        chapters: chapters ? {
          deleteMany: {}, // 🗑️ Clear existing
          create: chapters // ✨ Add new
        } : undefined,
        cards: cards ? {
          deleteMany: {}, // 🗑️ Clear existing
          create: (cards as any[]).map(c => ({
            ...c,
            // pollOptions is already a Json-compatible array from Zod
            pollOptions: c.pollOptions || null,
          })) // ✨ Add new
        } : undefined,
      },
      include: {
        chapters: { orderBy: { startTime: "asc" } },
        cards: { orderBy: { startTime: "asc" } },
        category: true,
        channel: { select: { id: true, name: true, handle: true, image: true, subscriberCount: true } }
      }
    });
    
    console.log(`[Video] ✅ Database updated for ${id} (Chapters: ${updatedVideo.chapters.length}, Cards: ${updatedVideo.cards.length})`);

    // Publish update event (for search/feed services)
    const updates = Object.keys(parsed.data);
    await publishMessage(EXCHANGES.VIDEO, EVENTS.VIDEO_UPDATED, {
      videoId: updatedVideo.id,
      channelId: updatedVideo.channelId,
      updates,
      title: updatedVideo.title,
      visibility: updatedVideo.visibility,
      thumbnailUrl: updatedVideo.thumbnailUrl, // This sends the KEY, which is correct for consumers as they might want purely backend keys
    });
    
    console.log(`[Video] ✅ Update event published for ${id}`);

    // Return transformed video to frontend
    res.json({
      success: true,
      data: transformVideo(updatedVideo),
    });
  } catch (error) {
    console.error(`[Video] ❌ Update video error for ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update video" },
    });
  }
});

/**
 * POST /videos/:id/thumbnail
 * Generate a presigned URL for custom thumbnail upload
 */
router.post("/:id/thumbnail", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;

    if(!id) return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid video id" },
    })

    // Validate request
    const parsed = thumbnailUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid image type. Supported: jpeg, png, webp" },
      });
    }

    // Check ownership
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });

    if (!video || video.deletedAt) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    const { getPresignedThumbnailUrl } = await import("../lib/storage");
    const { uploadUrl, key } = await getPresignedThumbnailUrl(id, parsed.data.contentType);

    res.json({
      success: true,
      data: { uploadUrl, key },
    });
  } catch (error) {
    console.error("Thumbnail upload url error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to generate upload URL" },
    });
  }
});

/**
 * DELETE /videos/:id
 * Delete a video (Soft delete + File cleanup)
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;

    // Get video
    const video = await prisma.video.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });

    if (!video || video.deletedAt) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Video not found" },
      });
    }

    // Check ownership
    if (video.channel.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Not authorized" },
      });
    }

    // Trigger cleanup of files (MinIO)
    try {
      // 1. If there's an active/uncompleted multipart session, abort it first
      if (video.uploadId) {
        console.log(`[Video] 🛑 Aborting active multipart upload ${video.uploadId} for ${id}`);
        await abortMultipartUpload(id as string, video.uploadId as string);
      }

      // 2. Cleanup all associated objects (originals, thumbnails, HLS segments)
      console.log(`[Video] 🧹 Cleaning up S3 objects for ${id}`);
      await deleteObjectsWithPrefix(`uploads/${id}/`);
      await deleteObjectsWithPrefix(`processed/${id}/`);
    } catch (e) {
      console.warn(`[Video] ⚠️ Failed partially or fully to cleanup files for video ${id}`, e);
    }

    // Soft Delete
    await prisma.video.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Publish Deleted Event
    await publishMessage(EXCHANGES.VIDEO, EVENTS.VIDEO_DELETED, {
      videoId: id,
      channelId: video.channelId,
    });

    res.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete video" },
    });
  }
});

export default router;
