"use server";

import { videoService, InitiateUploadInput } from "@/lib/api/video-service";
import { revalidatePath } from "next/cache";

export async function initiateUploadAction(data: InitiateUploadInput) {
    try {
        const response = await videoService.initiateUpload(data);
        if (response.success) {
            return { success: true, data: response.data };
        }
        return { success: false, error: { message: "error" in response ? response.error : "Upload failed" } };
    } catch (error: any) {
        console.error("Initiate Upload Action Failed:", error);
        return { success: false, error: { message: error.message || "Upload failed" } };
    }
}

export async function checkVideoStatusAction(videoId: string) {
    try {
        const response = await videoService.getVideo(videoId);
        if (response.success) {
            return { success: true, data: response.data };
        }
        return { success: false, error: { message: response.error } };
    } catch (error: any) {
        return { success: false, error: { message: error.message || "Status check failed" } };
    }
}

export async function retryUploadAction(videoId: string) {
    try {
        await videoService.retryUpload(videoId);
        return { success: true };
    } catch (error: any) {
        console.error("Retry Upload Action Failed:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteVideoAction(videoId: string) {
    try {
        await videoService.deleteVideo(videoId);
        revalidatePath("/studio/content");
        return { success: true };
    } catch (error: any) {
        console.error("Delete Video Action Failed:", error);
        return { success: false, error: error.message };
    }
}
