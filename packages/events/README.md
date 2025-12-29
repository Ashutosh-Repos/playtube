# @repo/events: Event-Driven Architecture

A production-grade, type-safe RabbitMQ abstraction for the PlayTube monorepo.

## � Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Setup & Configuration](#-setup--configuration)
3. [The Development Cycle](#-the-development-cycle-adding-a-new-event)
4. [Publishing Events (Producers)](#-publishing-events)
5. [Consuming Events (Workers)](#-consuming-events)
6. [Resilience & Recovery](#-resilience--recovery)
7. [API Reference](#-api-reference)

---

## 🏗 Architecture Overview

This package implements a robust **Pub/Sub** model using RabbitMQ **Topic Exchanges**.

*   **Exchanges**: We group events by domain (e.g., `video.events`, `user.events`).
*   **Routing Keys**: Events are routed explicitly (e.g., `video.uploaded`, `user.created`).
*   **Queues**: Services bind their own **Queues** to listen for specific events.
    *   *Example*: `video-transcode-queue` listens to `video.uploaded`.
    *   *Example*: `notifications-queue` **also** listens to `video.uploaded` (Fan-out).
*   **Dead Letter Queues (DLQ)**: If a consumer fails to process a message (and runs out of retries or encounters a validation error), the message is moved to a `.dlq` queue for manual inspection.

---

## 🛠 Setup & Connection Guide

### 1. Prerequisites: Running RabbitMQ
You need a running RabbitMQ instance. The easiest way is via Docker.

**Start RabbitMQ (with Management UI):**
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```
*   **5672**: Default port for the client connection.
*   **15672**: Web UI (http://localhost:15672) - login with `guest` / `guest`.

### 2. Configure Environment
Add the connection string to your service's `.env` file (e.g., `apps/web/.env`). This package uses `@repo/env` to validate it.

```env
# Default local connection
RABBITMQ_URL="amqp://guest:guest@localhost:5672"
```

### 3. Automatic Connection
You **do not** need to write any connection code.
*   The `RabbitMQClient` is a singleton instantiated automatically when you import `@repo/events`.
*   It establishes the connection **lazily** (only when you first call `publishMessage` or `consumeMessage`).
*   It handles **Reconnection** automatically if the server restarts.

---

##  The Development Cycle: Adding a New Event

To add a new feature (e.g., "User Subscribe"), follow these 4 steps to ensure Type Safety across the monorepo.

### Step 1: Define Constants (`constants.ts`)

Define the **Routing Key** (Event Name) and **Queue Name** (if a new consumer is needed).

```typescript
// packages/events/src/constants.ts

export const EVENTS = {
  // ...
  USER_SUBSCRIBED: "user.subscribed", // Routing Key
} as const;

export const QUEUES = {
  // ...
  ANALYTICS_PROCESSING: "analytics-processing-queue", // Unique Queue Name
} as const;
```

### Step 2: Define Payload Type (`types/index.ts`)

Define the shape of the data and register it in the `EventPayloads` map for TypeScript enforcement.

```typescript
// packages/events/src/types/index.ts

// 1. Define Interface
export interface UserSubscribedEvent {
  subscriberId: string;
  channelId: string;
  timestamp: string;
}

// 2. Map Payload
import { EVENTS } from "../constants";

export type EventPayloads = {
  // ... 
  [EVENTS.USER_SUBSCRIBED]: UserSubscribedEvent; // <--- Critical for Type Safety
};
```

### Step 3: Define Validation Schema (`schemas.ts`)

Define the Zod schema for runtime validation (protects consumers from "poison pill" bad data).

```typescript
// packages/events/src/schemas.ts
import { z } from "zod";

export const userSubscribedSchema = z.object({
  subscriberId: z.string(),
  channelId: z.string(),
  timestamp: z.string().datetime(),
});
```

### Step 4: Build
Run the build to make types available to other packages.
```bash
pnpm --filter "@repo/events" build
```

---

## 📤 Publishing Events

Use `publishMessage` in your API routes or services. It uses a **Shared ConfirmChannel** for high-performance, low-overhead publishing.

```typescript
import { publishMessage, EXCHANGES, EVENTS } from "@repo/events";

// Next.js API Route Example
export async function POST(req: Request) {
  // ... perform action ...

  // Publish Event
  await publishMessage(EXCHANGES.USER, EVENTS.USER_SUBSCRIBED, {
    subscriberId: "user_123",
    channelId: "channel_abc",
    timestamp: new Date().toISOString(),
  });
  
  // NOTE: TypeScript enforces the payload matches UserSubscribedEvent!
}
```

*   **Reliability**: The promise resolves only when RabbitMQ **Acknowledges** (Persists) the message.
*   **Durability**: Messages are marked `persistent: true`.

---

## 🎧 Consuming Events

Use `consumeMessage` in your Worker services. This creates a **Dedicated Channel** per consumer, ensuring that a slow task in one consumer doesn't block others (isolated prefetch).

```typescript
import { consumeMessage, QUEUES, EXCHANGES, EVENTS } from "@repo/events";
import { userSubscribedSchema } from "@repo/events/schemas";

async function startAnalyticsWorker() {
  await consumeMessage(
    QUEUES.ANALYTICS_PROCESSING, // Queue Name
    EXCHANGES.USER,              // Input Exchange
    EVENTS.USER_SUBSCRIBED,      // Routing Key filter
    userSubscribedSchema,        // Schema
    async (data) => {
      // 'data' is typed as UserSubscribedEvent
      console.log(`User ${data.subscriberId} subscribed!`);
      
      // Perform work using DB...
      // await db.analytics.insert(...)
      
      // If this function throws, message is Nack'd -> DLQ unless handled.
      // If it returns, message is Ack'd.
    },
    { prefetch: 20 } // Process 20 messages in parallel
  );
}
```

---

## � Resilience & Recovery

### Connection Loss
*   The client automatically attempts to **Reconnect** (Exponential Backoff).
*   **Publishers**: Will throw errors if disconnected, allowing your API to handle it (e.g., return 503).
*   **Consumers**: Automatically **Recover** and Resubscribe once connection is restored. You do not need to restart the worker.

### Bad Data (Poison Pills)
*   If a message is **Invalid JSON** or fails **Zod Validation**, it is immediately rejected to the **Dead Letter Queue (DLQ)**. It does NOT crash the worker.

### Application Crashes
*   If your worker crashes while processing a message (but before Ack), RabbitMQ will Re-queue it to be processed by another instance.

---

## 🔌 API Reference

### `publishMessage`
```typescript
publishMessage(exchange, routingKey, payload) => Promise<void>
```

### `consumeMessage`
```typescript
consumeMessage(queue, exchange, routingKey, schema, onMessage, options?) => Promise<{ close: () => Promise<void> }>
```
**Options**:
*   `prefetch`: Number of concurrent messages (default: 10).
*   `requeueOnFailure`: Bool. If true, retries indefinitely on error (Dangerous). Default: `false` (DLQ).

### `raw client`
Basic access via `import { rabbit } from "@repo/events"`.
