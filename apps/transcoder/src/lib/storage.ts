import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { config } from "../config";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";

// --- S3 Client ---
const s3Client = new S3Client({
  region: config.minio.region, // Configurable region
  endpoint: config.minio.endpoint?.startsWith("http")  
    ? config.minio.endpoint 
    : `${config.minio.useSSL ? "https" : "http"}://${config.minio.endpoint || "localhost"}:${config.minio.port}`,
  credentials: {
    accessKeyId: config.minio.accessKey || "minioadmin",
    secretAccessKey: config.minio.secretKey || "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = config.minio.bucket;

// --- Helpers ---

/**
 * Download file from S3 to local path
 */
export async function downloadFile(key: string, localPath: string): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  
  if (!response.Body) {
    throw new Error(`Failed to download ${key}: Body is empty`);
  }

  const writer = fs.createWriteStream(localPath);
  
  if (response.Body instanceof Readable) {
      response.Body.pipe(writer);
  } else {
      // For some SDK versions/environments (like browser), Body might be a Blob or other type.
      // In Node environment with valid client config, it should be a stream.
      // Fallback or explicit error for safety.
      throw new Error(`S3 Body is not a Readable stream.`);
  }

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

/**
 * Upload file from local path to S3
 */
export async function uploadFile(key: string, localPath: string, contentType: string): Promise<void> {
  const fileStream = fs.createReadStream(localPath);
  
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
    },
  });

  await upload.done();
}

/**
 * Upload buffer or stream directly
 */
export async function uploadStream(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();
}

/**
 * Helper to ensure local directory exists
 */
export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
