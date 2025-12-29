import startConsumer from "./consumer/consumer";
async function main() {
    try {
        await startConsumer();
    } catch (error) {
        console.error("Failed to start consumer", error);
    }
}

main();
