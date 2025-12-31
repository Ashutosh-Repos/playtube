import "dotenv/config";

async function main() {
    // Dynamic import ensures environment variables are loaded BEFORE application logic
    const { default: startConsumer } = await import("./consumer/consumer");
    
    try {
        await startConsumer();
    } catch (error) {
        console.error("Failed to start consumer", error);
    }
}

main();
