
import { minioClient } from "../lib/storage";
import { config } from "../config";

async function check() {
    try {
        console.log("Checking bucket:", config.minio.bucket);
        const stream = minioClient.listObjects(config.minio.bucket || "play-videos", "", true);
        
        console.log("--- Objects in Bucket ---");
        let count = 0;
        for await (const obj of stream) {
            console.log(`- ${obj.name} (${obj.size} bytes)`);
            count++;
        }
        console.log(`--- Total: ${count} objects ---`);
        
        if (count === 0) {
            console.log("⚠️ Bucket is empty. Upload likely failed on client side.");
        }
    } catch (e) {
        console.error("Error checking MinIO:", e);
    }
}

check();
