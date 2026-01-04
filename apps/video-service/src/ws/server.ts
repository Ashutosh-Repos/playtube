import { WebSocketServer, WebSocket, RawData } from "ws";
import http from "http";
import { URL } from "url";
import { getCachedVideoStatus, redisSub, REDIS_KEYS } from "../lib/redis.js";
import { prisma } from "@repo/database";
import { verifyToken } from "@repo/shared";

// Track connections by videoId
const videoConnections = new Map<string, Set<WebSocket>>();

// Track subscribed channels
const subscribedChannels = new Set<string>();

/**
 * Setup WebSocket server
 */
export function setupWebSocket(server: http.Server): { shutdown: () => Promise<void> } {
  const wss = new WebSocketServer({ server, path: "/ws/videos" });

  // Handle Redis Pub/Sub messages
  redisSub.on("message", (channel: string, message: string) => {
    // Extract videoId from channel name
    const match = channel.match(/^video:([^:]+):ws$/);
    if (!match) return;
    
    const videoId = match[1];
    const connections = videoConnections.get(videoId!);
    
    if (connections && connections.size > 0) {
      // Broadcast to all connections for this video
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  });

  wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
    // Parse videoId from URL: /ws/videos?id=xxx&token=xxx
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const videoId = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    if (!videoId) {
      ws.close(4000, "Missing videoId");
      return;
    }

    // Verify JWT token
    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    // Verify using shared hybrid logic
    const result = await verifyToken(token);
    
    if (!result.valid || !result.user) {
      ws.close(4003, "Invalid token");
      return;
    }
    const userId = result.user.id;

    // Check video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, processingStatus: true, channel: { select: { userId: true } } },
    });

    if (!video) {
      ws.close(4004, "Video not found");
      return;
    }

    // Verify ownership (only video owner can watch upload progress)
    if (video.channel.userId !== userId) {
      ws.close(4003, "Not authorized");
      return;
    }

    // Rate Limiting: Limit total connections per Video ID (e.g. 5 tabs max).
    // The user is the owner, so they are the only ones connecting.
    const MAX_CONNS_PER_VIDEO = 5;
    const currentConns = videoConnections.get(videoId)?.size || 0;
    
    if (currentConns >= MAX_CONNS_PER_VIDEO) {
        ws.close(4008, "Too many connections for this video");
        return;
    }

    // Add to connections map
    if (!videoConnections.has(videoId)) {
      videoConnections.set(videoId, new Set());
    }
    videoConnections.get(videoId)!.add(ws);

    // Subscribe to Redis channel for this video (if not already)
    const channel = REDIS_KEYS.videoWsChannel(videoId);
    if (!subscribedChannels.has(channel)) {
      redisSub.subscribe(channel);
      subscribedChannels.add(channel);
    }

    // Send current state
    const cachedStatus = await getCachedVideoStatus(videoId);
    if (cachedStatus) {
      ws.send(JSON.stringify({ type: "state", ...cachedStatus }));
    } else {
      ws.send(JSON.stringify({ 
        type: "state", 
        status: video.processingStatus.toLowerCase(),
      }));
    }

    // Handle client messages (optional)
    ws.on("message", (data: RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        // Could handle client-side upload progress here
        if (msg.type === "uploadProgress") {
          // Optionally broadcast to other connections
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle close
    ws.on("close", () => {
      const connections = videoConnections.get(videoId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          videoConnections.delete(videoId);
          // We could unsubscribe, but we keep the subscription relative to global set if we wanted
          // Ideally we unsubscribe from Redis if no one is listening on this instance
          if (subscribedChannels.has(channel)) {
             redisSub.unsubscribe(channel);
             subscribedChannels.delete(channel);
          }
        }
      }
    });

    ws.on("error", (err: Error) => {
      console.error("WebSocket error:", err);
    });
  });

  console.log("🔌 WebSocket server initialized");

  return {
    shutdown: async () => {
      console.log("🔌 Shutting down WebSocket server...");
      // Close all active connections
      for (const [_videoId, connections] of videoConnections) {
        for (const ws of connections) {
          ws.terminate();
        }
      }
      videoConnections.clear();
      
      return new Promise<void>((resolve, reject) => {
        wss.close((err) => {
          if (err) return reject(err);
          console.log("🔌 WebSocket server closed");
          resolve();
        });
      });
    }
  };
}