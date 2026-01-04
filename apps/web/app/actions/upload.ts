"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentUserAction } from "@/app/actions/auth";
import { v4 as uuidv4 } from "uuid";
import { UploadTypeSchema, ContentTypeSchema, MaxSizes, UploadType } from "@/lib/upload-types";

// Initialize S3 Client
// Note: We reuse the same MinIO credentials/bucket pattern as video-service
const s3Client = new S3Client({
  region: "us-east-1", // MinIO default
  endpoint: process.env.MINIO_ENDPOINT
    ? `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || 9000}`
    : "http://localhost:9000",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "play-videos";

export async function getPresignedUrl(type: UploadType, contentType: string, fileSize: number) {
  const user = await getCurrentUserAction();
  if (!user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  // Validate Input
  const typeResult = UploadTypeSchema.safeParse(type);
  const mimeResult = ContentTypeSchema.safeParse(contentType);

  if (!typeResult.success || !mimeResult.success) {
      return { success: false, error: "Invalid file type or format" };
  }

  if (fileSize > MaxSizes[type]) {
      return { success: false, error: `File too large. Max size for ${type} is ${MaxSizes[type] / 1024 / 1024}MB` };
  }

  try {
    const ext = contentType.split("/")[1];
    const uuid = uuidv4();
    // Structure: images/{userId}/{type}/{uuid}.{ext}
    // This allows easy cleanup if user deletes account
    const key = `images/${user.id}/${type}/${uuid}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    return { 
        success: true, 
        data: { 
            url, 
            key, 
            // We return the full public URL for the frontend to use immediately after upload
            // Assuming localhost/minio pattern for dev, or CDN for prod
            publicUrl: getPublicUrl(key) 
        } 
    };
  } catch (error) {
    console.error("Presigned URL error:", error);
    return { success: false, error: "Failed to generate upload URL" };
  }
}

function getPublicUrl(key: string) {
    // Determine public base URL
    // In dev: http://localhost:9000/play-videos
    // In prod: CDN or public S3 URL
    
    // Naive dev implementation matching video-service fallbacks
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const publicMinioUrl = process.env.PUBLIC_MINIO_URL; 
    
    if (publicMinioUrl) {
        return `${publicMinioUrl}/${BUCKET_NAME}/${key}`;
    }

    const host = process.env.MINIO_ENDPOINT || "localhost";
    const port = process.env.MINIO_PORT || "9000";
    const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";

    return `${protocol}://${host}:${port}/${BUCKET_NAME}/${key}`;
}
