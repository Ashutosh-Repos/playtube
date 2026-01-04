const { S3Client, CreateBucketCommand, PutBucketPolicyCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");

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

const POLICY = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { AWS: ["*"] },
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
    },
  ],
};

async function main() {
  console.log(`Checking bucket: ${BUCKET_NAME}...`);
  
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log("Bucket exists.");
  } catch (error) {
    if (error.name === "NotFound") {
      console.log("Bucket not found. Creating...");
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log("Bucket created.");
    } else {
      console.error("Error checking bucket:", error);
      return;
    }
  }

  console.log("Setting public read policy...");
  try {
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET_NAME,
        Policy: JSON.stringify(POLICY),
      })
    );
    console.log("Successfully set public read policy.");
  } catch (error) {
    console.error("Failed to set policy:", error);
  }
}

main();
