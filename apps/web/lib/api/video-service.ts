/**
 * Typed API Client for Video Service
 * 
 * All write operations (create, update, delete) go through this client
 * to ensure events are triggered and side effects are handled correctly.
 */
import { cookies } from "next/headers";
import { AUTH_TOKEN } from "@/lib/auth/cookie";
import { 
  VideoDetails, 
  VideoListItem, 
  InitiateUploadInput, 
  UploadResponse, 
  UpdateVideoInput,
  ChannelDetails,
  PlaylistDetails,
  PlaylistListItem,
  CreateChannelInput,
  UpdateChannelInput,
  CreatePlaylistInput,
  UpdatePlaylistInput
} from "@repo/shared";

export type { 
  VideoDetails, 
  VideoListItem, 
  InitiateUploadInput, 
  UploadResponse, 
  UpdateVideoInput,
  ChannelDetails,
  PlaylistDetails,
  PlaylistListItem,
  CreateChannelInput,
  UpdateChannelInput,
  CreatePlaylistInput,
  UpdatePlaylistInput
};

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

// Types are now imported from @repo/shared

export interface VideoListResponse {
  success: boolean;
  data: VideoListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export type GetVideoByIdResponse =  {
  success: true;
  data: VideoDetails;
} | {
  success: false;
  error: string;
}

export interface PlaylistListResponse {
  success: boolean;
  data: PlaylistListItem[];
}

export type GetPlaylistByIdResponse = {
  success: true;
  data: PlaylistDetails;
} | {
  success: false;
  error: string;
}

export type GetChannelByIdResponse = {
  success: true;
  data: ChannelDetails;
} | {
  success: false;
  error: string;
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

  // Multipart Uploads
  getMultipartPartUrl: (videoId: string, uploadId: string, partNumber: number) =>
    client<{ success: boolean; data: { url: string } }>(`/videos/upload/${videoId}/multipart/part`, {
      method: "POST",
      body: JSON.stringify({ uploadId, partNumber }),
    }),

  completeMultipartUpload: (videoId: string, uploadId: string, parts: Array<{ ETag: string; PartNumber: number }>) =>
    client<{ success: boolean }>(`/videos/upload/${videoId}/multipart/complete`, {
      method: "POST",
      body: JSON.stringify({ uploadId, parts }),
    }),

  getMultipartStatus: (videoId: string) =>
    client<{ success: boolean; data: { parts: Array<{ ETag: string; PartNumber: number; Size: number }> } }>(`/videos/upload/${videoId}/multipart`),

  abortMultipartUpload: (videoId: string) =>
    client<{ success: boolean }>(`/videos/upload/${videoId}/multipart`, {
      method: "DELETE",
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
  getVideo: (id: string) => client<GetVideoByIdResponse>(`/videos/${id}`),

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

  getThumbnailUploadUrl: (videoId: string, contentType: string) =>
    client<{ success: boolean; data: { uploadUrl: string; key: string } }>(`/videos/${videoId}/thumbnail`, {
      method: "POST",
      body: JSON.stringify({ contentType }),
    }),

  // Playlists
  createPlaylist: (data: CreatePlaylistInput) =>
    client<{ success: boolean; data: PlaylistDetails }>("/playlists", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPlaylists: (params: { channelId?: string; scope?: "personal" }) => {
    const query = new URLSearchParams();
    if (params.channelId) query.set("channelId", params.channelId);
    if (params.scope) query.set("scope", params.scope);
    return client<PlaylistListResponse>(`/playlists?${query}`);
  },

  getPlaylist: (id: string) => client<GetPlaylistByIdResponse>(`/playlists/${id}`),

  updatePlaylist: (id: string, data: UpdatePlaylistInput) =>
    client<{ success: boolean; data: PlaylistDetails }>(`/playlists/${id}`, {
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
    client<{ success: boolean; data: ChannelDetails }>("/channels", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateChannel: (id: string, data: UpdateChannelInput) =>
    client<{ success: boolean; data: ChannelDetails }>(`/channels/${id}`, {
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
