import { Prisma } from "@prisma/client";

/**
 * Shared Video Select for full details
 * Use this for getVideoById routes
 */
export const videoSelect = {
  id: true,
  title: true,
  description: true,
  tags: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconUrl: true,
    }
  },
  language: true,
  channelHandle: true,
  channelName: true,
  channelImage: true,
  visibility: true,
  scheduledAt: true,
  publishedAt: true,
  adminStatus: true,
  adminNote: true,
  processingStatus: true,
  processingError: true,
  processingProgress: true,
  hlsPlaylistUrl: true,
  thumbnailUrl: true,
  thumbnailOptions: true,
  previewSprite: true,
  duration: true,
  width: true,
  height: true,
  fps: true,
  resolutions: true,
  viewCount: true,
  likeCount: true,
  dislikeCount: true,
  commentCount: true,
  allowComments: true,
  allowEmbedding: true,
  isAgeRestricted: true,
  createdAt: true,
  updatedAt: true,
  chapters: {
    select: {
      title: true,
      startTime: true,
    }
  },
  cards: {
    select: {
      type: true,
      startTime: true,
      endTime: true,
      targetChannelId: true,
      targetPlaylistId: true,
      targetVideoId: true,
      targetUrl: true,
    }
  },
  channel: {
    select: {
      id: true,
      name: true,
      handle: true,
      image: true,
      subscriberCount: true,
    }
  },
  deletedAt: true,
} satisfies Prisma.VideoSelect;

/**
 * Shared Video Select for lists (Studio Table)
 * Optimized for performance
 */
export const videoListSelect = {
  id: true,
  title: true,
  thumbnailUrl: true,
  visibility: true,
  processingStatus: true,
  viewCount: true,
  likeCount: true,
  commentCount: true,
  duration: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  channel: {
    select: {
      id: true,
      name: true,
      handle: true,
    }
  },
  deletedAt: true,
} satisfies Prisma.VideoSelect;

/**
 * Shared Channel Select
 */
export const channelSelect = {
  id: true,
  name: true,
  handle: true,
  description: true,
  image: true,
  bannerUrl: true,
  subscriberCount: true,
  videoCount: true,
  totalViews: true,
  createdAt: true,
  links: true,
  isVerified: true,
  status: true,
  contactEmail: true, // Only for internal/authorized use
  userId: true,
  deletedAt: true,
} satisfies Prisma.ChannelSelect;

/**
 * Shared Playlist Select (Single)
 */
export const playlistSelect = {
  id: true,
  title: true,
  description: true,
  visibility: true,
  thumbnailUrl: true,
  isSystem: true,
  systemType: true,
  videoCount: true,
  createdAt: true,
  updatedAt: true,
  channel: {
    select: {
      id: true,
      name: true,
      handle: true,
    }
  },
  userId: true,
  channelId: true,
  deletedAt: true,
} satisfies Prisma.PlaylistSelect;

/**
 * Shared Playlist Select (List)
 */
export const playlistListSelect = {
  id: true,
  title: true,
  thumbnailUrl: true,
  videoCount: true,
  visibility: true,
  updatedAt: true,
  userId: true,
  channelId: true,
} satisfies Prisma.PlaylistSelect;

/**
 * Types helper
 */
export type VideoDetailsPayload = Prisma.VideoGetPayload<{ select: typeof videoSelect }>;
export type VideoListPayload = Prisma.VideoGetPayload<{ select: typeof videoListSelect }>;
export type ChannelPayload = Prisma.ChannelGetPayload<{ select: typeof channelSelect }>;
export type PlaylistPayload = Prisma.PlaylistGetPayload<{ select: typeof playlistSelect }>;
export type PlaylistListPayload = Prisma.PlaylistGetPayload<{ select: typeof playlistListSelect }>;
