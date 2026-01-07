"use server";

import { getCurrentUserAction } from "@/app/actions/auth";
import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// getStudioBootstrap and getActiveChannelId moved to ./data.ts for React.cache optimization

// Keep this for client-side explicit switching if needed, 
// though we usually just set cookie and refresh.
export async function switchChannelSession(channelId: string) {
    const user = await getCurrentUserAction();
    if (!user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Verify ownership
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
        });

        if (!channel || channel.userId !== user.id) {
            return { success: false, error: "Channel not found or unauthorized" };
        }

        // Set cookie
        (await cookies()).set("active_channel_id", channelId, {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: false,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        revalidatePath("/studio", "layout"); // Ensure the layout and pages re-fetch with new cookie
        return { success: true };
    } catch (error) {
        console.error("Failed to switch channel:", error);
        return { success: false, error: "Failed to switch channel" };
    }
}

// @deprecated - Use getStudioBootstrap instead for layout
export async function fetchUserChannels() {
  const user = await getCurrentUserAction();
  if (!user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  // ... (keeping for backward compat if needed temporarily, but ideally remove)
   try {
    const channels = await prisma.channel.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        handle: true,
        image: true,
        subscriberCount: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: channels };
  } catch (error) {
    return { success: false, error: "Failed to fetch channels" };
  }
}
