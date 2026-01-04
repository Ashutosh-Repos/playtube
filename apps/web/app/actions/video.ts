"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { videoService, ServiceError, UpdateVideoInput } from "@/lib/api/video-service";
import { getActiveChannelId } from "@/app/studio/data";

// Validation schema (matches backend video.ts updateVideoSchema)
const updateVideoSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"]).optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().optional().nullable(),
  language: z.string().max(10).optional().nullable(),
  allowComments: z.boolean().optional(),
  allowEmbedding: z.boolean().optional(),
  isAgeRestricted: z.boolean().optional(),
  isPremiere: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  premiereStartsAt: z.string().datetime().optional().nullable(),
});

/**
 * Fetch videos for the current active channel (Studio Content page)
 */
export async function fetchStudioVideos(page = 1, limit = 10, status?: string) {
  const channelId = await getActiveChannelId();
  if (!channelId) {
    return { success: false, error: "No active channel" };
  }

  try {
    const response = await videoService.listVideos({ channelId, page, limit, status });
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Fetch Videos Error:", error);
    return { success: false, error: "Failed to fetch videos" };
  }
}

/**
 * Fetch a single video by ID
 */
export async function fetchVideoById(videoId: string) {
  try {
    const response = await videoService.getVideo(videoId);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Fetch Video Error:", error);
    return { success: false, error: "Failed to fetch video" };
  }
}

/**
 * Update video metadata
 */
export async function updateVideoAction(videoId: string, data: z.infer<typeof updateVideoSchema>) {
  const validated = updateVideoSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0]?.message || "Invalid input" };
  }

  try {
    // Pass validated data directly - types now match backend schema
    await videoService.updateVideo(videoId, validated.data);
    revalidatePath("/studio/content");
    revalidatePath(`/watch/${videoId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Update Video Error:", error);
    return { success: false, error: "Failed to update video" };
  }
}

/**
 * Delete a video
 */
export async function deleteVideoAction(videoId: string) {
  try {
    await videoService.deleteVideo(videoId);
    revalidatePath("/studio/content");
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Delete Video Error:", error);
    return { success: false, error: "Failed to delete video" };
  }
}

/**
 * Initiate a video upload
 */
export async function initiateVideoUpload(fileName: string) {
  const channelId = await getActiveChannelId();
  if (!channelId) {
    return { success: false, error: "No active channel" };
  }

  try {
    const response = await videoService.initiateUpload({ fileName, channelId });
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Initiate Upload Error:", error);
    return { success: false, error: "Failed to initiate upload" };
  }
}

/**
 * Retry a failed video upload
 */
export async function retryVideoUpload(videoId: string) {
  try {
    const response = await videoService.retryUpload(videoId);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Retry Upload Error:", error);
    return { success: false, error: "Failed to retry upload" };
  }
}
