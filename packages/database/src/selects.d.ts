import { Prisma } from "@prisma/client";
/**
 * Shared Video Select for full details
 * Use this for getVideoById routes
 */
export declare const videoSelect: {
    id: true;
    title: true;
    description: true;
    tags: true;
    category: {
        select: {
            id: true;
            name: true;
            slug: true;
            description: true;
            iconUrl: true;
        };
    };
    language: true;
    visibility: true;
    scheduledAt: true;
    publishedAt: true;
    adminStatus: true;
    adminNote: true;
    processingStatus: true;
    processingError: true;
    processingProgress: true;
    hlsPlaylistUrl: true;
    thumbnailUrl: true;
    thumbnailOptions: true;
    previewSprite: true;
    duration: true;
    width: true;
    height: true;
    fps: true;
    resolutions: true;
    viewCount: true;
    likeCount: true;
    dislikeCount: true;
    commentCount: true;
    allowComments: true;
    allowEmbedding: true;
    isAgeRestricted: true;
    createdAt: true;
    updatedAt: true;
    chapters: {
        select: {
            title: true;
            startTime: true;
        };
    };
    cards: {
        select: {
            type: true;
            startTime: true;
            endTime: true;
            targetChannelId: true;
            targetPlaylistId: true;
            targetVideoId: true;
            targetUrl: true;
        };
    };
    channel: {
        select: {
            id: true;
            name: true;
            handle: true;
            image: true;
            subscriberCount: true;
        };
    };
};
/**
 * Shared Video Select for lists (Studio Table)
 * Optimized for performance
 */
export declare const videoListSelect: {
    id: true;
    title: true;
    thumbnailUrl: true;
    visibility: true;
    processingStatus: true;
    viewCount: true;
    likeCount: true;
    commentCount: true;
    duration: true;
    publishedAt: true;
    createdAt: true;
    updatedAt: true;
    channel: {
        select: {
            id: true;
            name: true;
            handle: true;
        };
    };
};
/**
 * Types helper
 */
export type VideoDetailsPayload = Prisma.VideoGetPayload<{
    select: typeof videoSelect;
}>;
export type VideoListPayload = Prisma.VideoGetPayload<{
    select: typeof videoListSelect;
}>;
//# sourceMappingURL=selects.d.ts.map