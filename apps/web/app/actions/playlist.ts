"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { videoService, ServiceError, CreatePlaylistInput, UpdatePlaylistInput } from "@/lib/api/video-service";
import { prisma } from "@repo/database";
import { getCurrentUserAction } from "@/app/actions/auth";
import { getActiveChannelId } from "@/app/studio/data";

// Validation schemas - matches backend (playlist.ts)
const createPlaylistSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PRIVATE"),
  channelId: z.string().optional(), // If provided, creates channel playlist
});

const updatePlaylistSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
});

// ============================================================================
// READS - Direct Prisma (Fast Path)
// ============================================================================

/**
 * Get playlists for the current channel (Studio)
 */
export async function getChannelPlaylists() {
  const channelId = await getActiveChannelId();
  if (!channelId) {
    return { success: false, error: "No active channel" };
  }

  try {
    const playlists = await prisma.playlist.findMany({
      where: { channelId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        thumbnailUrl: true,
        videoCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: playlists };
  } catch (error) {
    console.error("Get Channel Playlists Error:", error);
    return { success: false, error: "Failed to fetch playlists" };
  }
}

/**
 * Get personal playlists (user's own playlists, not channel-specific)
 */
export async function getPersonalPlaylists() {
  const user = await getCurrentUserAction();
  if (!user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const playlists = await prisma.playlist.findMany({
      where: { userId: user.id, channelId: null, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        thumbnailUrl: true,
        videoCount: true,
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return { success: true, data: playlists };
  } catch (error) {
    console.error("Get Personal Playlists Error:", error);
    return { success: false, error: "Failed to fetch playlists" };
  }
}

/**
 * Get playlist by ID with videos
 */
export async function getPlaylistById(playlistId: string) {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        videos: {
          where: {
            video: {
              deletedAt: null,
            },
          },
          orderBy: { position: "asc" },
          include: {
            video: {
              select: {
                id: true,
                title: true,
                thumbnailUrl: true,
                duration: true,
                viewCount: true,
                visibility: true,
                channelName: true,
                channelHandle: true,
              },
            },
          },
        },
      },
    });

    if (!playlist || playlist.deletedAt) {
      return { success: false, error: "Playlist not found" };
    }

    return { success: true, data: playlist };
  } catch (error) {
    console.error("Get Playlist Error:", error);
    return { success: false, error: "Failed to fetch playlist" };
  }
}

// ============================================================================
// WRITES - Via Video Service API (Triggers Events)
// ============================================================================

/**
 * Create a new playlist
 */
export async function createPlaylistAction(data: z.infer<typeof createPlaylistSchema>) {
  const validated = createPlaylistSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0]?.message || "Invalid input" };
  }

  try {
    // If no channelId provided but we're in studio context, use active channel
    let channelId = validated.data.channelId;
    if (!channelId) {
      channelId = await getActiveChannelId() || undefined;
    }

    // Backend constraint: Personal playlists (no channelId) must be PRIVATE
    // Enforce this on frontend to provide better UX
    if (!channelId && validated.data.visibility !== "PRIVATE") {
      return { success: false, error: "Personal playlists must be private" };
    }

    const createData: CreatePlaylistInput = {
      ...validated.data,
      channelId,
    };

    const response = await videoService.createPlaylist(createData);
    revalidatePath("/studio/playlists");
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Create Playlist Error:", error);
    return { success: false, error: "Failed to create playlist" };
  }
}

/**
 * Update playlist details
 */
export async function updatePlaylistAction(playlistId: string, data: z.infer<typeof updatePlaylistSchema>) {
  const validated = updatePlaylistSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const response = await videoService.updatePlaylist(playlistId, validated.data);
    revalidatePath("/studio/playlists");
    revalidatePath(`/playlist/${playlistId}`);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Update Playlist Error:", error);
    return { success: false, error: "Failed to update playlist" };
  }
}

/**
 * Delete a playlist
 */
export async function deletePlaylistAction(playlistId: string) {
  try {
    await videoService.deletePlaylist(playlistId);
    revalidatePath("/studio/playlists");
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Delete Playlist Error:", error);
    return { success: false, error: "Failed to delete playlist" };
  }
}

/**
 * Add a video to a playlist
 * Note: Position is calculated server-side (videos are always appended to end)
 */
export async function addVideoToPlaylistAction(playlistId: string, videoId: string) {
  try {
    const result = await videoService.addVideoToPlaylist(playlistId, videoId);
    revalidatePath(`/playlist/${playlistId}`);
    return { success: true, position: result.data.position };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Add Video to Playlist Error:", error);
    return { success: false, error: "Failed to add video to playlist" };
  }
}

/**
 * Remove a video from a playlist
 */
export async function removeVideoFromPlaylistAction(playlistId: string, videoId: string) {
  try {
    await videoService.removeVideoFromPlaylist(playlistId, videoId);
    revalidatePath(`/playlist/${playlistId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Remove Video from Playlist Error:", error);
    return { success: false, error: "Failed to remove video from playlist" };
  }
}

/**
 * Reorder videos in a playlist
 */
export async function reorderPlaylistVideosAction(playlistId: string, videoId: string, newPosition: number) {
  try {
    await videoService.reorderPlaylistVideos(playlistId, videoId, newPosition);
    revalidatePath(`/playlist/${playlistId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Reorder Playlist Error:", error);
    return { success: false, error: "Failed to reorder playlist" };
  }
}
