import * as amqp from "amqplib";
import { Connection, Channel } from "amqplib";
import { env } from "@repo/env";

class RabbitMQClient {
  private connection: Connection | null = null;
  private pubChannel: Channel | null = null;
  private pubChannelCreating: Promise<Channel> | null = null;
  private consumers: Map<string, { factory: (conn: Connection) => Promise<Channel>, currentChannel?: Channel }> = new Map();
  private connecting: Promise<void> | null = null;

  async connect() {
    if (this.connection) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const retries = 5;
      let attempt = 0;
      
      while (attempt < retries) {
        try {
          console.log(`🐰 Connecting to RabbitMQ (Attempt ${attempt + 1}/${retries})...`);
          const conn = await amqp.connect(env.RABBITMQ_URL);
          this.connection = conn as unknown as Connection;
          
          conn.on("error", (err) => {
            console.error("🐰 RabbitMQ Connection Error", err);
            this.handleDisconnect();
          });
  
          conn.on("close", () => {
            console.warn("🐰 RabbitMQ Connection Closed");
            this.handleDisconnect();
          });
  
          console.log("✅ RabbitMQ Connected");
          
          // Recover Consumers automatically on connect
          await this.recoverConsumers();
          
          return; 
        } catch (error) {
          attempt++;
          console.error(`❌ Failed to connect to RabbitMQ (Attempt ${attempt})`, error);
          if (attempt >= retries) throw error; 
          const delay = 1000 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    })();
    
    try {
        await this.connecting;
    } finally {
        this.connecting = null;
    }
  }
  
  private handleDisconnect() {
      this.connection = null;
      this.pubChannel = null;
      // Consumers will be recovered on next connect via recoverConsumers
      // Note: Channels are already closed by the connection closure, so currentChannel refs are stale/closed.
  }

  // --- Publisher Channel (Shared) ---
  async getPublisherChannel() {
    if (!this.connection) await this.connect();
    if (this.pubChannel) return this.pubChannel;
    if (this.pubChannelCreating) return this.pubChannelCreating;

    this.pubChannelCreating = (async () => {
        try {
            const ch = await (this.connection as any).createConfirmChannel();
            
            ch.on("error", () => { this.pubChannel = null; });
            ch.on("close", () => { this.pubChannel = null; });
            
            this.pubChannel = ch;
            return ch;
        } catch (err) {
            this.pubChannel = null;
            throw err;
        } finally {
            this.pubChannelCreating = null;
        }
    })();
    
    return this.pubChannelCreating;
  }
  
  // --- Consumer Channels (Isolated) ---
  async createConsumerChannel(consumerId: string, setup: (channel: Channel) => Promise<void>) {
      if (!this.connection) await this.connect();
      
      const factory = async (conn: Connection) => {
          const ch = await (conn as any).createConfirmChannel();
          ch.on("error", (err: any) => console.error(`Consumer ${consumerId} channel error`, err));
          await setup(ch);
          return ch;
      };

      // Initial Creation
      const ch = await factory(this.connection as unknown as Connection);
      
      // Store state
      this.consumers.set(consumerId, { factory, currentChannel: ch });

      return ch;
  }
  
  async removeConsumer(consumerId: string) {
      const entry = this.consumers.get(consumerId);
      if (entry?.currentChannel) {
          try {
              console.log(`🛑 Closing channel for consumer ${consumerId}`);
              await entry.currentChannel.close();
          } catch(e) {
              // Ignore already closed errors
          }
      }
      this.consumers.delete(consumerId);
  }

  private async recoverConsumers() {
      if (!this.connection) return;
      if (this.consumers.size === 0) return;

      console.log(`🔄 Recovering ${this.consumers.size} consumers...`);
      for (const [id, entry] of this.consumers) {
          try {
             // Re-run factory to get new channel
             const newCh = await entry.factory(this.connection);
             // Update reference
             entry.currentChannel = newCh;
          } catch (err) {
              console.error(`❌ Failed to recover consumer ${id}`, err);
          }
      }
  }

  // --- Topology Helpers ---
  async assertExchange(name: string, type: string = "topic", options?: amqp.Options.AssertExchange) {
    const channel = await this.getPublisherChannel();
    await channel.assertExchange(name, type, options);
  }

  async assertQueue(name: string, options?: amqp.Options.AssertQueue) {
     const channel = await this.getPublisherChannel();
     return channel.assertQueue(name, options);
  }

  async bindQueue(queue: string, exchange: string, routingKey: string) {
      const channel = await this.getPublisherChannel();
      await this.assertExchange(exchange); 
      await channel.bindQueue(queue, exchange, routingKey);
  }

  async close() {
    try {
      if (this.connection) await (this.connection as any).close();
    } catch (e) {
      console.error("Error closing RabbitMQ", e);
    }
  }
}

export const rabbit = new RabbitMQClient();
