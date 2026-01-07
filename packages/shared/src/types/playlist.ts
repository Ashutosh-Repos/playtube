import { PlaylistPayload, PlaylistListPayload } from "@repo/database";

/**
 * Shared Playlist Type for API responses
 */
export type PlaylistDetails = Omit<PlaylistPayload, "createdAt" | "updatedAt"> & {
    createdAt: string;
    updatedAt: string;
};

/**
 * Shared Playlist List Item
 */
export type PlaylistListItem = Omit<PlaylistListPayload, "updatedAt"> & {
    updatedAt: string;
};

// ============================================================================
// Input Types
// ============================================================================

export interface CreatePlaylistInput {
  title: string;
  description?: string;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED";
  thumbnailUrl?: string;
  channelId?: string;
}

export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED";
  thumbnailUrl?: string;
}
