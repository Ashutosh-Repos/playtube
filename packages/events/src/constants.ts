export const EXCHANGES = {
  USER: "user.events",
  VIDEO: "video.events",
  TRANSCODER: "transcoder.events",
  PLAYLIST: "playlist.events",
  CHANNEL: "channel.events",
} as const;

export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];

export const EVENTS = {
  USER_EMAIL_VERIFICATION_TOKEN_CREATED: "user.email-verification-token-created",
  USER_PASSWORD_RESET_TOKEN_CREATED: "user.password-reset-token-created",
  VIDEO_UPLOADED: "video.uploaded",
  VIDEO_DELETED: "video.deleted",
  VIDEO_UPDATED: "video.updated",
  
  TRANSCODER_PROGRESS: "transcode.progress",
  TRANSCODER_THUMBNAILS: "transcode.thumbnails",
  TRANSCODER_COMPLETED: "transcode.completed",
  TRANSCODER_FAILED: "transcode.failed",

  PLAYLIST_CREATED: "playlist.created",
  PLAYLIST_UPDATED: "playlist.updated",
  PLAYLIST_DELETED: "playlist.deleted",
  PLAYLIST_VIDEO_ADDED: "playlist.video-added",
  PLAYLIST_VIDEO_REMOVED: "playlist.video-removed",

  CHANNEL_CREATED: "channel.created",
  CHANNEL_UPDATED: "channel.updated",
  CHANNEL_DELETED: "channel.deleted",
} as const;

export const QUEUES = {
  EMAIL_VERIFICATION_QUEUE: "email-verification-queue",
  PASSWORD_RESET_QUEUE: "password-reset-queue",
  TRANSCODER_QUEUE: "transcoder-queue",
  VIDEO_STATUS_QUEUE: "video-status-queue",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
