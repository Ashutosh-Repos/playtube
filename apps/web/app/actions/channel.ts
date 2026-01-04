"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { videoService, ServiceError, CreateChannelInput, UpdateChannelInput } from "@/lib/api/video-service";
import { prisma } from "@repo/database";
import { getCurrentUserAction } from "@/app/actions/auth";

// Validation schemas - matches backend (channel.ts)
const createChannelSchema = z.object({
  name: z.string().min(1).max(50),
  handle: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._]+$/, "Handle can only contain letters, numbers, underscores, and periods."),
  description: z.string().max(5000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  links: z.array(z.object({
    title: z.string().max(100),
    url: z.string().url().max(2000),
  })).max(20).optional(),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  links: z.array(z.object({
    title: z.string().max(100),
    url: z.string().url().max(2000),
  })).max(20).optional(),
});

// ============================================================================
// READS - Direct Prisma (Fast Path)
// ============================================================================

/**
 * Get channel by ID (for display)
 */
export async function getChannelById(channelId: string) {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId, deletedAt: null },
      select: {
        id: true,
        name: true,
        handle: true,
        description: true,
        image: true,
        bannerUrl: true,
        subscriberCount: true,
        videoCount: true,
        totalViews: true,
        createdAt: true,
        links: true,
      },
    });

    if (!channel) {
      return { success: false, error: "Channel not found" };
    }

    return { success: true, data: channel };
  } catch (error) {
    console.error("Get Channel Error:", error);
    return { success: false, error: "Failed to fetch channel" };
  }
}

/**
 * Get channels owned by the current user
 */
export async function getUserChannels() {
  const user = await getCurrentUserAction();
  if (!user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const channels = await prisma.channel.findMany({
      where: { userId: user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        handle: true,
        image: true,
        subscriberCount: true,
        videoCount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: channels };
  } catch (error) {
    console.error("Get User Channels Error:", error);
    return { success: false, error: "Failed to fetch channels" };
  }
}

/**
 * Check if a handle is available
 */
export async function checkHandleAvailability(handle: string) {
  try {
    const response = await videoService.checkHandleAvailability(handle);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to check handle" };
  }
}

// ============================================================================
// WRITES - Via Video Service API (Triggers Events)
// ============================================================================

/**
 * Create a new channel
 */
export async function createChannelAction(data: z.infer<typeof createChannelSchema>) {
  const user = await getCurrentUserAction();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const validated = createChannelSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const createData: CreateChannelInput = {
      ...validated.data,
      image: validated.data.image || undefined,
      bannerUrl: validated.data.bannerUrl || undefined,
      contactEmail: validated.data.contactEmail || undefined,
    };

    const response = await videoService.createChannel(createData);
    revalidatePath("/studio");
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "HANDLE_TAKEN") {
        return { success: false, error: "This handle is already taken" };
      }
      return { success: false, error: error.message };
    }
    console.error("Create Channel Error:", error);
    return { success: false, error: "Failed to create channel" };
  }
}

/**
 * Update channel details
 */
export async function updateChannelAction(channelId: string, data: z.infer<typeof updateChannelSchema>) {
  const validated = updateChannelSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const updateData: UpdateChannelInput = {
      ...validated.data,
      image: validated.data.image || undefined,
      bannerUrl: validated.data.bannerUrl || undefined,
      contactEmail: validated.data.contactEmail || undefined,
    };

    const response = await videoService.updateChannel(channelId, updateData);
    revalidatePath("/studio");
    revalidatePath(`/@${channelId}`);
    return response;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Update Channel Error:", error);
    return { success: false, error: "Failed to update channel" };
  }
}

/**
 * Delete a channel
 */
export async function deleteChannelAction(channelId: string) {
  try {
    await videoService.deleteChannel(channelId);
    revalidatePath("/studio");
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { success: false, error: error.message };
    }
    console.error("Delete Channel Error:", error);
    return { success: false, error: "Failed to delete channel" };
  }
}
