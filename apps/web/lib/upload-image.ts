import { getPresignedUrl } from "@/app/actions/upload";

export type UploadType = "avatar" | "banner" | "thumbnail" | "playlist-thumbnail";

/**
 * Uploads an image to S3/MinIO using a Server Action to get a Presigned URL.
 * 
 * @param file The file to upload (File object)
 * @param type The type of asset ("avatar", "banner", etc.)
 * @returns The final public URL of the uploaded image.
 * @throws Error if upload fails.
 */
export async function uploadImage(file: File, type: UploadType): Promise<string> {
    if (!file) {
        throw new Error("No file selected");
    }

    // 1. Get Presigned URL
    // We pass file size and type for validation on the server
    const result = await getPresignedUrl(type, file.type, file.size);

    if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to initiate upload");
    }

    const { url, publicUrl } = result.data;

    // 2. Upload to S3/MinIO
    // Note: We use fetch directly to PUT the file.
    const response = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": file.type,
            // x-amz-acl: public-read? usually handled by bucket policy for signed URLs
        },
    });

    if (!response.ok) {
        console.error("Upload failed", await response.text());
        throw new Error("Failed to upload image to storage");
    }

    return publicUrl;
}
