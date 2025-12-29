import { rabbit } from "./client";
import { EventName, ExchangeName } from "./constants";
import { EventPayloads } from "./types";

export const publishMessage = async <K extends EventName>(
  exchange: ExchangeName,
  routingKey: K,
  message: K extends keyof EventPayloads ? EventPayloads[K] : any
) => {
  // 1. Ensure Exchange (Cached)
  await rabbit.assertExchange(exchange, "topic", { durable: true });
  
  const channel = await rabbit.getPublisherChannel();
  
  // 2. Publish (Reliable)
  return new Promise<void>((resolve, reject) => {
      // Cast to any because standard Channel type definition does not expose the callback signature 
      // used by ConfirmChannel (though it works at runtime)
      (channel as any).publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true },
        (err: any) => {
            if (err) {
                console.error(`❌ Publish failed to ${exchange}:${routingKey}`, err);
                return reject(err);
            }
            console.log(`📤 Published & Acked to ${exchange}:${routingKey}`);
            resolve();
        }
      );
  });
};
