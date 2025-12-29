/**
 * RabbitMQ Queue Definitions
 */

export const EXCHANGES = {
  USER: "user.events",
  // VIDEO: "video.events", // Uncomment when needed
} as const;

export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];

export const EVENTS = {
  USER_EMAIL_VERIFICATION_TOKEN_CREATED: "user.email-verification-token-created",
  USER_PASSWORD_RESET_TOKEN_CREATED: "user.password-reset-token-created",
} as const;

export const QUEUES = {
  EMAIL_QUEUE: "email-queue",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
