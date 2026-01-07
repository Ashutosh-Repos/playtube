"use server";

import { revalidatePath } from "next/cache";
import { videoService } from "@/lib/api/video-service";

export async function revalidateVideoList() {
    revalidatePath("/studio/content");
}

export async function getChannelVideosAction(channelId: string, page = 1, limit = 10) {
  try {
    const response = await videoService.listVideos({ channelId, page, limit });
    return response;
  } catch (error) {
    console.error("Failed to fetch channel videos:", error);
    return { success: false, data: [], meta: { total: 0, page: 1, limit: 10, pages: 0 } };
  }
}

export async function getChannelPlaylistsAction(channelId: string) {
  try {
    const response = await videoService.listPlaylists({ channelId });
    return response;
  } catch (error) {
    console.error("Failed to fetch channel playlists:", error);
    return { success: false, data: [] };
  }
}
