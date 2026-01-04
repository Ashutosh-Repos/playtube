/**
 * Typed API Client for Video Service
 * 
 * All write operations (create, update, delete) go through this client
 * to ensure events are triggered and side effects are handled correctly.
 */

import { cookies } from "next/headers";
import { AUTH_TOKEN } from "@/lib/auth/cookie";

// Environment validation
const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || "http://localhost:4003";

if (!process.env.VIDEO_SERVICE_URL && process.env.NODE_ENV === "production") {
  console.error("⚠️ VIDEO_SERVICE_URL is not set in production!");
}

// Error class for service errors
export class ServiceError extends Error {
  code: string;
  status: number;

  constructor(response: { error?: { code?: string; message?: string } }, status = 500) {
    super(response.error?.message || "Service request failed");
    this.code = response.error?.code || "UNKNOWN_ERROR";
    this.status = status;
  }
}

// Get auth token from cookies
async function getAuthToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN)?.value;
  if (!token) throw new ServiceError({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
  return token;
}

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError({ error: { code: "TIMEOUT", message: "Request timed out" } }, 408);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

// Core client function (authenticated)
async function client<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const res = await fetchWithTimeout(`${VIDEO_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store", // Disable caching for API calls
  });

  if (res.status === 401) {
    throw new ServiceError({ error: { code: "SESSION_EXPIRED", message: "Session expired, please login again" } }, 401);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    console.error("VideoService: Backend Error", errorBody);
    throw new ServiceError(errorBody, res.status);
  }

  return res.json();
}

// Public client function (no auth required)
async function publicClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetchWithTimeout(`${VIDEO_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ServiceError(errorBody, res.status);
  }

  return res.json();
}

// ============================================================================
// Video Operations
// ============================================================================

export interface InitiateUploadInput {
  fileName: string;
  channelId: string;
}

export interface UploadResponse {
  success: boolean;
  data: {
    videoId: string;
    uploadUrl: string;
    wsUrl: string;
    expiresAt: string;
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
}

export interface VideoListResponse {
  success: boolean;
  data: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    visibility: string;
    processingStatus: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    duration: number;
    publishedAt: string | null;
    createdAt: string;
    // Optional fields (returned when ?fields=full)
    description?: string | null;
    scheduledAt?: string | null;
    dislikeCount?: number;
    isAgeRestricted?: boolean;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ============================================================================
// Playlist Operations
// ============================================================================

export interface CreatePlaylistInput {
  title: string;
  description?: string;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED";
  channelId?: string;
}

export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED";
}

// ============================================================================
// Channel Operations
// ============================================================================

export interface CreateChannelInput {
  name: string;
  handle: string;
  description?: string;
  image?: string;
  bannerUrl?: string;
  contactEmail?: string;
  links?: Array<{ title: string; url: string }>;
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
  image?: string;
  bannerUrl?: string;
  contactEmail?: string;
  links?: Array<{ title: string; url: string }>;
}

// ============================================================================
// Exported Service Methods
// ============================================================================

export const videoService = {
  // Videos
  initiateUpload: (data: InitiateUploadInput) =>
    client<UploadResponse>("/videos/upload", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  retryUpload: (videoId: string) =>
    client<UploadResponse>(`/videos/upload/${videoId}/retry`, {
      method: "POST",
    }),

  listVideos: (params: { channelId: string; page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams({
      channelId: params.channelId,
      page: String(params.page || 1),
      limit: String(params.limit || 10),
      ...(params.status && { status: params.status }),
    });
    return client<VideoListResponse>(`/videos?${query}`);
  },

  // Fetch video details (Authenticated - for owner interactions)
  getVideo: (id: string) => client<{ success: boolean; data: any }>(`/videos/${id}`),

  // Fetch video details (Public - for playback)
  getPublicVideo: (id: string) => publicClient<{ success: boolean; data: any }>(`/videos/${id}`),

  updateVideo: (id: string, data: UpdateVideoInput) =>
    client<{ success: boolean; data: any }>(`/videos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteVideo: (id: string) =>
    client<{ success: boolean; data: { deleted: boolean } }>(`/videos/${id}`, {
      method: "DELETE",
    }),

  // Playlists
  createPlaylist: (data: CreatePlaylistInput) =>
    client<{ success: boolean; data: any }>("/playlists", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPlaylists: (params: { channelId?: string; scope?: "personal" }) => {
    const query = new URLSearchParams();
    if (params.channelId) query.set("channelId", params.channelId);
    if (params.scope) query.set("scope", params.scope);
    return client<{ success: boolean; data: any[] }>(`/playlists?${query}`);
  },

  getPlaylist: (id: string) => client<{ success: boolean; data: any }>(`/playlists/${id}`),

  updatePlaylist: (id: string, data: UpdatePlaylistInput) =>
    client<{ success: boolean; data: any }>(`/playlists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePlaylist: (id: string) =>
    client<{ success: boolean; data: { deleted: boolean } }>(`/playlists/${id}`, {
      method: "DELETE",
    }),

  // Note: Position is calculated server-side (always appends to end)
  addVideoToPlaylist: (playlistId: string, videoId: string) =>
    client<{ success: boolean; data: { added: boolean; position: number } }>(`/playlists/${playlistId}/videos`, {
      method: "POST",
      body: JSON.stringify({ videoId }),
    }),

  removeVideoFromPlaylist: (playlistId: string, videoId: string) =>
    client<{ success: boolean }>(`/playlists/${playlistId}/videos/${videoId}`, {
      method: "DELETE",
    }),

  reorderPlaylistVideos: (playlistId: string, videoId: string, newPosition: number) =>
    client<{ success: boolean }>(`/playlists/${playlistId}/videos/${videoId}/order`, {
      method: "PUT",
      body: JSON.stringify({ newPosition }),
    }),

  // Channels
  createChannel: (data: CreateChannelInput) =>
    client<{ success: boolean; data: any }>("/channels", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateChannel: (id: string, data: UpdateChannelInput) =>
    client<{ success: boolean; data: any }>(`/channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteChannel: (id: string) =>
    client<{ success: boolean; data: { deleted: boolean } }>(`/channels/${id}`, {
      method: "DELETE",
    }),

  // Public route - no auth required
  checkHandleAvailability: (handle: string) =>
    publicClient<{ success: boolean; available: boolean }>(`/channels/check-handle/${handle}`),

  // Categories
  getCategories: () =>
    client<{ success: boolean; data: Array<{ id: string; name: string; slug: string; iconUrl?: string }> }>("/categories"),
};
