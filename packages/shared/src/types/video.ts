import { VideoDetailsPayload, VideoListPayload } from "@repo/database";

/**
 * Helper to represent a video after S3 keys have been transformed into full URLs
 */
export type TransformedVideo<T> = Omit<T, 
  "thumbnailUrl" | "hlsPlaylistUrl" | "previewSprite" | "thumbnailOptions" | "viewCount" |
  "createdAt" | "updatedAt" | "publishedAt" | "scheduledAt"
> & {
  viewCount: number;
  thumbnailUrl: string | null;
  hlsPlaylistUrl: string | null;
  previewSprite: string | null;
  thumbnailOptions: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
};

/**
 * Type for a single video detail response
 */
export type VideoDetails = TransformedVideo<VideoDetailsPayload>;

/**
 * Type for a video in a list (e.g. Studio Content table)
 */
export type VideoListItem = TransformedVideo<VideoListPayload>;

// ============================================================================
// Input Types
// ============================================================================

export interface InitiateUploadInput {
  fileName: string;
  channelId: string;
}

export interface UploadResponse {
  success: boolean;
  data: {
    videoId: string;
    uploadUrl: string; // For legacy or single-PUT fallback
    uploadId?: string; // For multipart
  };
}

export interface UpdateVideoInput {
  title?: string;
  description?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" | "SCHEDULED";
  thumbnailUrl?: string | null;
  tags?: string[];
  categoryId?: string | null;
  language?: string | null;
  allowComments?: boolean;
  allowEmbedding?: boolean;
  isAgeRestricted?: boolean;
  isPremiere?: boolean;
  scheduledAt?: string | null;
  premiereStartsAt?: string | null;
  chapters?: Array<{
    title: string;
    startTime: number;
  }>;
  cards?: Array<{
    type: "VIDEO" | "PLAYLIST" | "CHANNEL" | "LINK" | "POLL";
    title?: string | null;
    startTime: number;
    endTime?: number | null;
    targetVideoId?: string | null;
    targetPlaylistId?: string | null;
    targetChannelId?: string | null;
    targetUrl?: string | null;
    pollOptions?: string[] | null;
  }>;
}
