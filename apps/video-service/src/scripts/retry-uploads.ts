
import { prisma } from "@repo/database";
import { publishMessage, EXCHANGES, EVENTS, rabbit } from "@repo/events";
import { QUEUES } from "@repo/events";

async function main() {
    console.log("🔄 Retrying failed videos");
    
    // Connect RabbitMQ Publisher Channel
    await rabbit.connect();

    // 1. Find videos stuck in UPLOADING or PROCESSING
    const videos = await prisma.video.findMany({
        where: {
            processingStatus: { in: ["UPLOADING", "PROCESSING"] }
        },
        select: { id: true, channelId: true, originalFilePath: true, originalFileSize: true }
    });
    
    console.log(`Found ${videos.length} stuck videos`);
    
    for (const v of videos) {
        if (!v.originalFilePath) continue;
        
        console.log(`Retrying video ${v.id}...`);
        
        // Manual Publish to VIDEO EXCHANGE -> bound to TRANSCODER QUEUE
        await publishMessage(EXCHANGES.VIDEO, EVENTS.VIDEO_UPLOADED, {
            videoId: v.id,
            channelId: v.channelId,
            fileName: v.originalFilePath, 
            size: Number(v.originalFileSize) || 0,
            mimetype: "video/mp4" 
        });
        
        console.log(`✅ Retried video ${v.id} (Attempt 1)`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    process.exit(0);
}

main();
