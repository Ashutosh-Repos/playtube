import { z } from "zod";

// Validation
export const UploadTypeSchema = z.enum([
    "avatar", // User avatar
    "banner", // User banner
    "channel-logo", // Channel logo (1:1)
    "channel-banner", // Channel banner (2560x1440)
    "thumbnail", 
    "playlist-thumbnail"
]);

export const ContentTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export type UploadType = z.infer<typeof UploadTypeSchema>;

export const MaxSizes = {
    avatar: 5 * 1024 * 1024,
    banner: 10 * 1024 * 1024,
    "channel-logo": 5 * 1024 * 1024,
    "channel-banner": 10 * 1024 * 1024,
    thumbnail: 5 * 1024 * 1024,
    "playlist-thumbnail": 5 * 1024 * 1024,
};
