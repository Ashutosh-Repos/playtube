
import { Router, Request, Response } from "express";
import { prisma } from "@repo/database";
import { requireAuth, AuthUser } from "@repo/shared";
import { z } from "zod";
import { publishMessage, EXCHANGES, EVENTS } from "@repo/events";

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const router = Router();

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

const createPlaylistSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PRIVATE"),
  channelId: z.string().optional(), // Optional: if present, it's a Channel Playlist
});

const updatePlaylistSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
});

const addVideoSchema = z.object({
  videoId: z.string(),
});

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

/**
 * POST /
 * Create a new playlist.
 * - If channelId is provided: Channel Playlist (Type C)
 * - If channelId is missing: Personal Playlist (Type B)
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const result = createPlaylistSchema.safeParse(req.body);

    if (!result.success) {
      const errorMsg = result.error.errors[0]?.message || "Invalid input";
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: errorMsg },
      });
    }

    const { title, description, visibility, channelId } = result.data;

    // Type B: Personal Playlist Protection
    if (!channelId && visibility !== "PRIVATE") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_VISIBILITY", message: "Personal playlists must be PRIVATE" },
      });
    }

    // Type C: Channel Playlist Constraints
    if (channelId) {
      // Check if user owns the channel
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { userId: true },
      });

      if (!channel) {
        return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Channel not found" } });
      }

      if (channel.userId !== userId) {
        return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized for this channel" } });
      }
    }

    const playlist = await prisma.playlist.create({
      data: {
        userId,
        channelId: channelId || undefined,
        title,
        description,
        visibility,
      },
    });

    await publishMessage(EXCHANGES.PLAYLIST, EVENTS.PLAYLIST_CREATED, {
        playlistId: playlist.id,
        userId: playlist.userId,
        channelId: playlist.channelId || undefined,
        title: playlist.title,
        visibility: playlist.visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
    });

    res.status(201).json({ success: true, data: playlist });
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create playlist" } });
  }
});

/**
 * GET /
 * List playlists.
 * - ?channelId=... -> Channel Playlists
 * - ?scope=personal -> Personal Playlists
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { channelId, scope } = req.query;

    const where: any = {
      userId, // Always scope to the user (unless viewing public channel playlists, but this route is for "My Playlists")
      deletedAt: null, // Exclude soft-deleted
    };

    if (channelId) {
      where.channelId = channelId as string;
    } else if (scope === "personal") {
      where.channelId = null;
    }

    const playlists = await prisma.playlist.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        thumbnailUrl: true,
        videoCount: true,
        isSystem: true,
        systemType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: playlists });
  } catch (error) {
    console.error("List playlists error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list playlists" } });
  }
});

/**
 * GET /:id
 * Get details + videos
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { position: "asc" },
          where: {
            video: {
              deletedAt: null,
            },
          },
          include: {
            video: {
              select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                duration: true,
                visibility: true,
                channel: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!playlist || playlist.deletedAt) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Playlist not found" } });
    }

    // Access Control & Filtering
    const isOwner = playlist.userId === userId;
    const isPublic = playlist.visibility === "PUBLIC" || playlist.visibility === "UNLISTED";

    if (!isOwner && !isPublic) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Private playlist" } });
    }

    // Filter videos:
    // If not owner, filter out PRIVATE videos from the public playlist
    if (!isOwner && isPublic) {
      playlist.videos = playlist.videos.filter((pv) => pv.video.visibility === "PUBLIC");
    }

    res.json({ success: true, data: playlist });
  } catch (error) {
    console.error("Get playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch playlist" } });
  }
});

/**
 * PATCH /:id
 * Update playlist details
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;

    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.deletedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Playlist not found" } });

    if (playlist.userId !== userId) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });
    }

    if (playlist.isSystem) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Cannot edit system playlists" } });
    }

    const { title, description, visibility } = req.body;

    // Guard: Personal playlists must remain PRIVATE
    if (playlist.channelId === null && visibility && visibility !== "PRIVATE") {
       return res.status(400).json({ success: false, error: { code: "INVALID_VISIBILITY", message: "Personal playlists must remain PRIVATE" } });
    }

    const updated = await prisma.playlist.update({
      where: { id },
      data: { title, description, visibility },
    });

    await publishMessage(EXCHANGES.PLAYLIST, EVENTS.PLAYLIST_UPDATED, {
        playlistId: updated.id,
        userId: updated.userId,
        channelId: updated.channelId || undefined,
        title: updated.title,
        visibility: updated.visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update playlist" } });
  }
});

/**
 * DELETE /:id
 * Delete playlist
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params;

    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.deletedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Playlist not found" } });

    if (playlist.userId !== userId) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });
    }

    if (playlist.isSystem) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Cannot delete system playlists" } });
    }

    // Soft delete instead of hard delete
    await prisma.playlist.update({ 
      where: { id },
      data: { deletedAt: new Date() },
    });

    await publishMessage(EXCHANGES.PLAYLIST, EVENTS.PLAYLIST_DELETED, {
        playlistId: id as string,
        userId: playlist.userId,
        channelId: playlist.channelId || undefined,
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete playlist" } });
  }
});

/**
 * POST /:id/videos
 * Add video to playlist
 */
router.post("/:id/videos", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params as { id: string };
    
    const bodyResult = addVideoSchema.safeParse(req.body);
    if (!bodyResult.success) {
         return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: bodyResult.error.errors[0]?.message } });
    }
    const { videoId } = bodyResult.data;

    // Check playlist ownership
    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.deletedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Playlist not found" } });
    if (playlist.userId !== userId) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });

    // Verify video exists and is not deleted
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video || video.deletedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Video not found" } });

    // Calculate position (append to end)
    const lastItem = await prisma.playlistVideo.findFirst({
      where: { playlistId: id },
      orderBy: { position: "desc" },
    });
    const position = lastItem ? lastItem.position + 1 : 1;

    // Add to playlist
    await prisma.playlistVideo.create({
      data: {
        playlistId: id,
        videoId,
        position,
      },
    });

    // Auto-set thumbnail if missing or first video
    const shouldUpdateThumbnail = position === 1 || !playlist.thumbnailUrl;
    
    await prisma.playlist.update({
      where: { id },
      data: { 
        videoCount: { increment: 1 }, 
        updatedAt: new Date(),
        ...(shouldUpdateThumbnail && video.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl } : {})
      },
    });

    await publishMessage(EXCHANGES.PLAYLIST, EVENTS.PLAYLIST_VIDEO_ADDED, {
        playlistId: id as string,
        videoId,
        position,
    });

    res.status(201).json({ success: true, data: { added: true, position } });
  } catch (error) {
    // Unique constraint violation (already added)
    if ((error as any).code === 'P2002') {
         return res.status(400).json({ success: false, error: { code: "DUPLICATE", message: "Video already in playlist" } });
    }
    console.error("Add video to playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to add video" } });
  }
});

/**
 * DELETE /:id/videos/:videoId
 * Remove video from playlist
 */
router.delete("/:id/videos/:videoId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id, videoId } = req.params as { id: string; videoId: string };

     // Check playlist ownership
     const playlist = await prisma.playlist.findUnique({ where: { id } });
     if (!playlist || playlist.deletedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Playlist not found" } });
     if (playlist.userId !== userId) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });

     // Delete
     const deleted = await prisma.playlistVideo.deleteMany({
         where: { playlistId: id, videoId }
     });

     if (deleted.count > 0) {
        await prisma.playlist.update({
            where: { id },
            data: { videoCount: { decrement: 1 }, updatedAt: new Date() },
        });
     }

     await publishMessage(EXCHANGES.PLAYLIST, EVENTS.PLAYLIST_VIDEO_REMOVED, {
        playlistId: id as string,
        videoId: videoId as string,
    });

     res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("Remove video from playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to remove video" } });
  }
});


/**
 * PUT /:id/videos/:videoId/order
 * Reorder videos in playlist
 */
router.put("/:id/videos/:videoId/order", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id, videoId } = req.params as { id: string; videoId: string };
    const { newPosition } = req.body;

    if (typeof newPosition !== 'number' || newPosition < 1) {
        return res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Invalid newPosition" } });
    }

    // Check ownership
    const playlist = await prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.deletedAt) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Playlist not found" } });
    if (playlist.userId !== userId) return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });

    // Find current position
    const currentItem = await prisma.playlistVideo.findUnique({
        where: { playlistId_videoId: { playlistId: id, videoId } }
    });

    if (!currentItem) {
        return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Video not in playlist" } });
    }

    const oldPosition = currentItem.position;
    if (oldPosition === newPosition) {
        return res.json({ success: true, data: { reordered: false } });
    }

    // Max position check (optional but safest)
    const maxPosAgg = await prisma.playlistVideo.aggregate({
        where: { playlistId: id },
        _max: { position: true }
    });
    const maxPos = maxPosAgg._max.position || 0;

    // Cap newPosition
    const targetPosition = Math.min(newPosition, maxPos);

    // Transactional reorder
    await prisma.$transaction(async (tx) => {
        if (targetPosition < oldPosition) {
             // Moving UP: Shift items in [new, old) -> +1
             await tx.playlistVideo.updateMany({
                 where: {
                     playlistId: id,
                     position: { gte: targetPosition, lt: oldPosition }
                 },
                 data: { position: { increment: 1 } }
             });
        } else {
             // Moving DOWN: Shift items in (old, new] -> -1
             await tx.playlistVideo.updateMany({
                 where: {
                     playlistId: id,
                     position: { gt: oldPosition, lte: targetPosition }
                 },
                 data: { position: { decrement: 1 } }
             });
        }

        // Move target
        await tx.playlistVideo.update({
            where: { playlistId_videoId: { playlistId: id, videoId } },
            data: { position: targetPosition }
        });
    });

    res.json({ success: true, data: { reordered: true, newPosition: targetPosition } });
  } catch (error) {
    console.error("Reorder playlist error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to reorder playlist" } });
  }
});

export default router;
