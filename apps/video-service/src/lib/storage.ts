import * as Minio from "minio";
import { config } from "../config";

// --- MinIO Client ---

const endPointUrl = new URL(config.minio.endpoint || "http://localhost:9000");

export const minioClient = new Minio.Client({
  endPoint: endPointUrl.hostname,
  port: parseInt(config.minio.port || endPointUrl.port || "9000"),
  useSSL: config.minio.useSSL === "true" || endPointUrl.protocol === "https:",
  accessKey: config.minio.accessKey || "minioadmin",
  secretKey: config.minio.secretKey || "minioadmin",
});

// --- Constants ---

const BUCKET_NAME = config.minio.bucket || "play-videos";

// --- Initialization ---

/**
 * Initialize Storage: Ensure bucket exists
 * Run this on service startup
 */
export async function initStorage() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
        await minioClient.makeBucket(BUCKET_NAME, "us-east-1");
        console.log(`🪣 Created MinIO bucket: ${BUCKET_NAME}`);
        
        // Optional: Set policy for public read if needed (omitted for now)
    } else {
        console.log(`🪣 Connected to MinIO bucket: ${BUCKET_NAME}`);
    }
  } catch (err) {
      console.error("❌ Failed to initialize MinIO storage:", err);
      // We don't exit here, but the service might be unhealthy
  }
}

// --- Helpers ---

/**
 * Generate a Presigned URL for PUT (Upload)
 * Expires in 1 hour by default
 */
export async function getPresignedUploadUrl(videoId: string): Promise<string> {
  // Bucket existence checked at startup (initStorage)
  // Ensure we use .mp4 extension so MinIO webhook filter triggers
  const objectName = `uploads/${videoId}/original.mp4`;
  const expiry = config.upload.presignedUrlExpiry || 3600;

  return await minioClient.presignedPutObject(BUCKET_NAME, objectName, expiry);
}

/**
 * Generate a Presigned URL for Thumbnail Upload (PUT)
 */
export async function getPresignedThumbnailUrl(videoId: string, contentType: string): Promise<{ uploadUrl: string; key: string }> {
  const extension = contentType.split("/")[1] || "jpg";
  const objectName = `uploads/${videoId}/thumbnail.${extension}`;
  const expiry = 600; // 10 minutes

  // Bucket existence checked at startup (initStorage)

  const uploadUrl = await minioClient.presignedPutObject(BUCKET_NAME, objectName, expiry);
  return { uploadUrl, key: objectName };
}

/**
 * Get a Presigned URL for GET (Download/Preview)
 */
export function getFileUrl(objectKey: string | null): string | null {
  if (!objectKey) return null;
  // If it's a full URL already (e.g. external cdn), return it
  if (objectKey.startsWith("http")) return objectKey;

  // Construct public URL manually if bucket is public, 
  // OR generate presigned GET if private.
  // For HLS, usually we want a permanent public URL (via Nginx/CDN).
  // For now, let's assume we serve via MinIO directly (Dev) or Nginx (Prod).
  
  // Dev mode fallback: Direct MinIO URL
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const publicUrl = process.env.PUBLIC_MINIO_URL;
  if (publicUrl) {
      return `${publicUrl}/${BUCKET_NAME}/${objectKey}`;
  }

  const protocol = config.minio.useSSL === "true" ? "https" : "http";
  let host = config.minio.endpoint || "localhost";
  
  // Strip existing protocol if present
  host = host.replace(/^https?:\/\//, '');

  // Strip trailing slash
  if (host.endsWith('/')) host = host.slice(0, -1);

  const port = config.minio.port || "9000";
  
  // If host already contains a port (or is an IP with port), don't append it again
  if (host.includes(':')) {
       return `${protocol}://${host}/${BUCKET_NAME}/${objectKey}`;
  }

  return `${protocol}://${host}:${port}/${BUCKET_NAME}/${objectKey}`;
}

/**
 * Get object stats (size, type)
 */
export async function getObjectStat(objectKey: string) {
  return await minioClient.statObject(BUCKET_NAME, objectKey);
}

/**
 * Check if object exists
 */
export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET_NAME, objectKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete objects with prefix (Folder delete)
 * MinIO doesn't have "Process Prefix", so we list then delete.
 */
export async function deleteObjectsWithPrefix(prefix: string): Promise<void> {
  const objectsList: string[] = [];
  const stream = minioClient.listObjectsV2(BUCKET_NAME, prefix, true);
  
  for await (const obj of stream) {
    if (obj.name) objectsList.push(obj.name);
  }

  if (objectsList.length > 0) {
    await minioClient.removeObjects(BUCKET_NAME, objectsList);
  }
}

/**
 * Extract Video ID from object path
 * e.g. "uploads/123-abc/original" -> "123-abc"
 */
export function extractVideoIdFromPath(key: string): string | null {
  // Regex for uploads/{uuid}/... or processed/{uuid}/...
  // eslint-disable-next-line no-useless-escape
  const match = key.match(/^(?:uploads|processed)\/([^\/]+)\//);
  return match ? (match[1] || null) : null;
}