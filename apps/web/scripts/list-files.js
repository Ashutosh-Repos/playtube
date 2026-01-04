const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT
    ? `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || 9000}`
    : "http://localhost:9000",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "play-videos";

async function main() {
  console.log(`Listing files in bucket: ${BUCKET_NAME}...`);
  
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
        console.log("Bucket is empty.");
    } else {
        console.log(`Found ${response.Contents.length} files:`);
        response.Contents.forEach(file => {
            console.log(` - ${file.Key} (${file.Size} bytes)`);
        });
    }

  } catch (error) {
    if (error.name === "NoSuchBucket") {
        console.error("Error: Bucket does not exist.");
    } else {
        console.error("Error listing files:", error);
    }
  }
}

main();
