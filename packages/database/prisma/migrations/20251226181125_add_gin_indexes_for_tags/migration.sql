-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'PROVISIONED');

-- CreateEnum
CREATE TYPE "VideoVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'HELD', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_VIDEO', 'NEW_SUBSCRIBER', 'VIDEO_LIKE', 'COMMENT', 'COMMENT_REPLY', 'COMMENT_LIKE', 'MENTION', 'LIVE_STARTED', 'LIVE_SCHEDULED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SubscriptionNotificationLevel" AS ENUM ('ALL', 'PERSONALIZED', 'NONE');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('CATEGORY', 'TAG', 'CHANNEL');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'VIOLENCE', 'SEXUAL_CONTENT', 'MISINFORMATION', 'COPYRIGHT', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LiveStreamStatus" AS ENUM ('SCHEDULED', 'WAITING', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveChatMessageType" AS ENUM ('TEXT', 'SUPER_CHAT', 'MEMBERSHIP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlaylistSystemType" AS ENUM ('WATCH_LATER', 'LIKED_VIDEOS', 'HISTORY');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('VIDEO', 'PLAYLIST', 'CHANNEL', 'LINK', 'POLL');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('TEXT', 'IMAGE', 'POLL', 'VIDEO_TEASER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" VARCHAR(50),
    "image" TEXT,
    "bio" TEXT,
    "bannerUrl" TEXT,
    "websiteUrl" VARCHAR(200),
    "location" VARCHAR(100),
    "primaryChannelId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedUntil" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" VARCHAR(30) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "bannerUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "links" JSONB,
    "location" TEXT,
    "contactEmail" TEXT,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "totalViews" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "notificationLevel" "SubscriptionNotificationLevel" NOT NULL DEFAULT 'PERSONALIZED',
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "categoryId" TEXT,
    "language" VARCHAR(10),
    "channelHandle" TEXT,
    "channelName" TEXT,
    "channelImage" TEXT,
    "visibility" "VideoVisibility" NOT NULL DEFAULT 'PRIVATE',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "processingProgress" INTEGER,
    "originalFileName" TEXT,
    "originalFileSize" BIGINT,
    "originalFilePath" TEXT,
    "originalMimeType" TEXT,
    "uploadId" TEXT,
    "uploadExpiresAt" TIMESTAMP(3),
    "uploadStartedAt" TIMESTAMP(3),
    "uploadCompletedAt" TIMESTAMP(3),
    "uploadAttempts" INTEGER NOT NULL DEFAULT 0,
    "hlsPlaylistUrl" TEXT,
    "thumbnailUrl" TEXT,
    "thumbnailOptions" TEXT[],
    "previewSprite" TEXT,
    "duration" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "fps" INTEGER,
    "resolutions" TEXT[],
    "viewCount" BIGINT NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "dislikeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastScoredAt" TIMESTAMP(3),
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowEmbedding" BOOLEAN NOT NULL DEFAULT true,
    "isAgeRestricted" BOOLEAN NOT NULL DEFAULT false,
    "isShort" BOOLEAN NOT NULL DEFAULT false,
    "isPremiere" BOOLEAN NOT NULL DEFAULT false,
    "premiereStartsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_chapters" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "startTime" INTEGER NOT NULL,

    CONSTRAINT "video_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_cards" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "title" VARCHAR(100),
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER,
    "targetVideoId" TEXT,
    "targetPlaylistId" TEXT,
    "targetChannelId" TEXT,
    "targetUrl" TEXT,
    "pollOptions" JSONB,
    "pollResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_streams" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "categoryId" TEXT,
    "tags" TEXT[],
    "streamKey" TEXT NOT NULL,
    "rtmpUrl" TEXT,
    "playbackUrl" TEXT,
    "status" "LiveStreamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "visibility" "VideoVisibility" NOT NULL DEFAULT 'PUBLIC',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "currentViewers" INTEGER NOT NULL DEFAULT 0,
    "totalViews" BIGINT NOT NULL DEFAULT 0,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatSlowMode" INTEGER NOT NULL DEFAULT 0,
    "chatSubsOnly" BOOLEAN NOT NULL DEFAULT false,
    "dvrEnabled" BOOLEAN NOT NULL DEFAULT true,
    "saveVod" BOOLEAN NOT NULL DEFAULT true,
    "vodVideoId" TEXT,
    "channelHandle" TEXT,
    "channelName" TEXT,
    "channelImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "live_streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_chat" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "type" "LiveChatMessageType" NOT NULL DEFAULT 'TEXT',
    "amount" INTEGER,
    "currency" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_stats" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "views24h" INTEGER NOT NULL DEFAULT 0,
    "likes24h" INTEGER NOT NULL DEFAULT 0,
    "comments24h" INTEGER NOT NULL DEFAULT 0,
    "shares24h" INTEGER NOT NULL DEFAULT 0,
    "views7d" INTEGER NOT NULL DEFAULT 0,
    "likes7d" INTEGER NOT NULL DEFAULT 0,
    "views30d" INTEGER NOT NULL DEFAULT 0,
    "avgWatchPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestType" "InterestType" NOT NULL,
    "interestId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "watchTime" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "visibility" "VideoVisibility" NOT NULL DEFAULT 'PUBLIC',
    "thumbnailUrl" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemType" "PlaylistSystemType",
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_videos" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_reactions" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHearted" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "videoDuration" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "watchCount" INTEGER NOT NULL DEFAULT 1,
    "firstWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watch_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newVideos" BOOLEAN NOT NULL DEFAULT true,
    "liveStreams" BOOLEAN NOT NULL DEFAULT true,
    "comments" BOOLEAN NOT NULL DEFAULT true,
    "replies" BOOLEAN NOT NULL DEFAULT true,
    "likes" BOOLEAN NOT NULL DEFAULT false,
    "subscribers" BOOLEAN NOT NULL DEFAULT true,
    "mentions" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "actionUrl" TEXT,
    "actorId" TEXT,
    "videoId" TEXT,
    "channelId" TEXT,
    "commentId" TEXT,
    "liveStreamId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "targetUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "videoId" TEXT,
    "commentId" TEXT,
    "reportedUserId" TEXT,
    "liveStreamId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "PostType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "pollOptions" JSONB,
    "pollResults" JSONB,
    "pollEndsAt" TIMESTAMP(3),
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "channelHandle" TEXT,
    "channelName" TEXT,
    "channelImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_revokedAt_idx" ON "refresh_tokens"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "channels_handle_key" ON "channels"("handle");

-- CreateIndex
CREATE INDEX "channels_userId_idx" ON "channels"("userId");

-- CreateIndex
CREATE INDEX "channels_subscriberCount_idx" ON "channels"("subscriberCount" DESC);

-- CreateIndex
CREATE INDEX "channels_createdAt_idx" ON "channels"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "channels_deletedAt_idx" ON "channels"("deletedAt");

-- CreateIndex
CREATE INDEX "subscriptions_subscriberId_idx" ON "subscriptions"("subscriberId");

-- CreateIndex
CREATE INDEX "subscriptions_channelId_idx" ON "subscriptions"("channelId");

-- CreateIndex
CREATE INDEX "subscriptions_subscriberId_subscribedAt_idx" ON "subscriptions"("subscriberId", "subscribedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_subscriberId_channelId_key" ON "subscriptions"("subscriberId", "channelId");

-- CreateIndex
CREATE INDEX "videos_channelId_idx" ON "videos"("channelId");

-- CreateIndex
CREATE INDEX "videos_visibility_publishedAt_idx" ON "videos"("visibility", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "videos_visibility_hotScore_idx" ON "videos"("visibility", "hotScore" DESC);

-- CreateIndex
CREATE INDEX "videos_visibility_trendingScore_idx" ON "videos"("visibility", "trendingScore" DESC);

-- CreateIndex
CREATE INDEX "videos_visibility_viewCount_idx" ON "videos"("visibility", "viewCount" DESC);

-- CreateIndex
CREATE INDEX "videos_categoryId_visibility_publishedAt_idx" ON "videos"("categoryId", "visibility", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "videos_categoryId_visibility_hotScore_idx" ON "videos"("categoryId", "visibility", "hotScore" DESC);

-- CreateIndex
CREATE INDEX "videos_channelId_visibility_publishedAt_idx" ON "videos"("channelId", "visibility", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "videos_processingStatus_idx" ON "videos"("processingStatus");

-- CreateIndex
CREATE INDEX "videos_uploadId_idx" ON "videos"("uploadId");

-- CreateIndex
CREATE INDEX "videos_scheduledAt_idx" ON "videos"("scheduledAt");

-- CreateIndex
CREATE INDEX "videos_visibility_isShort_publishedAt_idx" ON "videos"("visibility", "isShort", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "videos_deletedAt_idx" ON "videos"("deletedAt");

-- CreateIndex
CREATE INDEX "videos_tags_idx" ON "videos" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "video_chapters_videoId_idx" ON "video_chapters"("videoId");

-- CreateIndex
CREATE INDEX "video_cards_videoId_idx" ON "video_cards"("videoId");

-- CreateIndex
CREATE INDEX "video_cards_videoId_startTime_idx" ON "video_cards"("videoId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_streamKey_key" ON "live_streams"("streamKey");

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_vodVideoId_key" ON "live_streams"("vodVideoId");

-- CreateIndex
CREATE INDEX "live_streams_channelId_idx" ON "live_streams"("channelId");

-- CreateIndex
CREATE INDEX "live_streams_status_idx" ON "live_streams"("status");

-- CreateIndex
CREATE INDEX "live_streams_status_scheduledAt_idx" ON "live_streams"("status", "scheduledAt" ASC);

-- CreateIndex
CREATE INDEX "live_streams_status_startedAt_idx" ON "live_streams"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "live_streams_visibility_status_idx" ON "live_streams"("visibility", "status");

-- CreateIndex
CREATE INDEX "live_streams_categoryId_idx" ON "live_streams"("categoryId");

-- CreateIndex
CREATE INDEX "live_streams_deletedAt_idx" ON "live_streams"("deletedAt");

-- CreateIndex
CREATE INDEX "live_streams_tags_idx" ON "live_streams" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "live_chat_streamId_createdAt_idx" ON "live_chat"("streamId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "live_chat_streamId_isDeleted_idx" ON "live_chat"("streamId", "isDeleted");

-- CreateIndex
CREATE INDEX "live_chat_userId_idx" ON "live_chat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sortOrder_idx" ON "categories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "video_stats_videoId_key" ON "video_stats"("videoId");

-- CreateIndex
CREATE INDEX "video_stats_views24h_idx" ON "video_stats"("views24h" DESC);

-- CreateIndex
CREATE INDEX "video_stats_views7d_idx" ON "video_stats"("views7d" DESC);

-- CreateIndex
CREATE INDEX "video_stats_calculatedAt_idx" ON "video_stats"("calculatedAt");

-- CreateIndex
CREATE INDEX "user_interests_userId_score_idx" ON "user_interests"("userId", "score" DESC);

-- CreateIndex
CREATE INDEX "user_interests_userId_interestType_score_idx" ON "user_interests"("userId", "interestType", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_interests_userId_interestType_interestId_key" ON "user_interests"("userId", "interestType", "interestId");

-- CreateIndex
CREATE INDEX "playlists_userId_idx" ON "playlists"("userId");

-- CreateIndex
CREATE INDEX "playlists_visibility_idx" ON "playlists"("visibility");

-- CreateIndex
CREATE INDEX "playlists_userId_createdAt_idx" ON "playlists"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "playlists_userId_systemType_key" ON "playlists"("userId", "systemType");

-- CreateIndex
CREATE INDEX "playlist_videos_playlistId_position_idx" ON "playlist_videos"("playlistId", "position");

-- CreateIndex
CREATE INDEX "playlist_videos_videoId_idx" ON "playlist_videos"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_videos_playlistId_videoId_key" ON "playlist_videos"("playlistId", "videoId");

-- CreateIndex
CREATE INDEX "video_reactions_videoId_type_idx" ON "video_reactions"("videoId", "type");

-- CreateIndex
CREATE INDEX "video_reactions_createdAt_idx" ON "video_reactions"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "video_reactions_videoId_userId_key" ON "video_reactions"("videoId", "userId");

-- CreateIndex
CREATE INDEX "comments_videoId_status_isPinned_createdAt_idx" ON "comments"("videoId", "status", "isPinned" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "comments_videoId_parentId_createdAt_idx" ON "comments"("videoId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comments_likeCount_idx" ON "comments"("likeCount" DESC);

-- CreateIndex
CREATE INDEX "comments_deletedAt_idx" ON "comments"("deletedAt");

-- CreateIndex
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_commentId_userId_key" ON "comment_reactions"("commentId", "userId");

-- CreateIndex
CREATE INDEX "watch_history_userId_lastWatchedAt_idx" ON "watch_history"("userId", "lastWatchedAt" DESC);

-- CreateIndex
CREATE INDEX "watch_history_userId_completed_idx" ON "watch_history"("userId", "completed");

-- CreateIndex
CREATE INDEX "watch_history_lastWatchedAt_idx" ON "watch_history"("lastWatchedAt" DESC);

-- CreateIndex
CREATE INDEX "watch_history_videoId_idx" ON "watch_history"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "watch_history_userId_videoId_key" ON "watch_history"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_type_createdAt_idx" ON "notifications"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_actorId_idx" ON "notifications"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_videoId_idx" ON "reports"("videoId");

-- CreateIndex
CREATE INDEX "reports_commentId_idx" ON "reports"("commentId");

-- CreateIndex
CREATE INDEX "reports_reportedUserId_idx" ON "reports"("reportedUserId");

-- CreateIndex
CREATE INDEX "reports_liveStreamId_idx" ON "reports"("liveStreamId");

-- CreateIndex
CREATE INDEX "reports_reviewedById_idx" ON "reports"("reviewedById");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_reason_status_idx" ON "reports"("reason", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_videoId_key" ON "reports"("reporterId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_commentId_key" ON "reports"("reporterId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_reportedUserId_key" ON "reports"("reporterId", "reportedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_liveStreamId_key" ON "reports"("reporterId", "liveStreamId");

-- CreateIndex
CREATE INDEX "outbox_events_processedAt_createdAt_idx" ON "outbox_events"("processedAt", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_retryCount_idx" ON "outbox_events"("retryCount");

-- CreateIndex
CREATE INDEX "community_posts_channelId_createdAt_idx" ON "community_posts"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_posts_deletedAt_idx" ON "community_posts"("deletedAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_chapters" ADD CONSTRAINT "video_chapters_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_cards" ADD CONSTRAINT "video_cards_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_vodVideoId_fkey" FOREIGN KEY ("vodVideoId") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat" ADD CONSTRAINT "live_chat_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "live_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat" ADD CONSTRAINT "live_chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_stats" ADD CONSTRAINT "video_stats_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_reactions" ADD CONSTRAINT "video_reactions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_reactions" ADD CONSTRAINT "video_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "live_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
