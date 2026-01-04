import { z } from "zod";

export const userEmailVerificationTokenCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export const userPasswordResetTokenCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export const transcodeProgressSchema = z.object({
    videoId: z.string(),
    progress: z.number(),
    stage: z.string(),
});

export const transcodeThumbnailsSchema = z.object({
    videoId: z.string(),
    thumbnailOptions: z.array(z.string()),
});

export const transcodeCompletedSchema = z.object({
    videoId: z.string(),
    hlsPlaylistUrl: z.string(),
    thumbnailOptions: z.array(z.string()),
    previewSprite: z.string().optional(),
    duration: z.number(),
    width: z.number(),
    height: z.number(),
    fps: z.number(),
    resolutions: z.array(z.string()),
});

export const transcodeFailedSchema = z.object({
    videoId: z.string(),
    error: z.string(),
    stage: z.string(),
    retryable: z.boolean(),
});
export const videoUploadedSchema = z.object({
  videoId: z.string(),
  channelId: z.string(),
  fileName: z.string(),
  size: z.number(),
  mimetype: z.string(),
});

export const videoUpdatedSchema = z.object({
  videoId: z.string(),
  channelId: z.string(),
  updates: z.array(z.string()),
  title: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED", "SCHEDULED"]).optional(),
  thumbnailUrl: z.string().optional().nullable(),
});

export const videoDeletedSchema = z.object({
  videoId: z.string(),
  channelId: z.string(),
});

export const playlistCreatedSchema = z.object({
  playlistId: z.string(),
  userId: z.string(),
  channelId: z.string().optional().nullable(),
  title: z.string(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
});

export const playlistUpdatedSchema = z.object({
  playlistId: z.string(),
  userId: z.string(),
  channelId: z.string().optional().nullable(),
  title: z.string(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
});

export const playlistDeletedSchema = z.object({
  playlistId: z.string(),
  userId: z.string(),
  channelId: z.string().optional().nullable(),
});

export const playlistVideoAddedSchema = z.object({
  playlistId: z.string(),
  videoId: z.string(),
  position: z.number(),
});

export const playlistVideoRemovedSchema = z.object({
  playlistId: z.string(),
  videoId: z.string(),
});

export const channelCreatedSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  name: z.string(),
  handle: z.string(),
  image: z.string().optional().nullable(),
});

export const channelUpdatedSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  updates: z.array(z.string()), // Fields that were updated
  name: z.string(),
  handle: z.string(), // Handle updates are rare but possible
  image: z.string().optional().nullable(),
});

export const channelDeletedSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
});
