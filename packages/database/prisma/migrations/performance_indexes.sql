-- Performance Indexes Migration
-- Run this after prisma migrate to add PostgreSQL-specific performance indexes

-- =============================================================================
-- GIN INDEXES FOR ARRAY SEARCHES
-- =============================================================================
-- These enable fast tag-based filtering like: WHERE 'gaming' = ANY(tags)

CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_live_streams_tags ON live_streams USING GIN (tags);

-- =============================================================================
-- PARTIAL INDEXES (Only index relevant subset of data)
-- =============================================================================
-- Much smaller than full indexes, faster queries

-- Only index public, non-deleted videos (99% of feed queries)
CREATE INDEX IF NOT EXISTS idx_videos_public_active 
ON videos (published_at DESC) 
WHERE visibility = 'PUBLIC' AND deleted_at IS NULL;

-- Only index unprocessed outbox events (usually < 100 rows)
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed 
ON outbox_events (created_at) 
WHERE processed_at IS NULL;

-- Only index pending reports (moderation queue)
CREATE INDEX IF NOT EXISTS idx_reports_pending 
ON reports (created_at DESC) 
WHERE status = 'PENDING';

-- Only index active sessions (not expired)
CREATE INDEX IF NOT EXISTS idx_sessions_active 
ON sessions (user_id) 
WHERE expires > NOW();

-- =============================================================================
-- BRIN INDEX FOR TIME-SERIES DATA
-- =============================================================================
-- Very compact index for time-ordered data (notifications, audit logs)
-- Works well when data is inserted in time order

CREATE INDEX IF NOT EXISTS idx_notifications_created_brin 
ON notifications USING BRIN (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin 
ON audit_logs USING BRIN (created_at);

CREATE INDEX IF NOT EXISTS idx_watch_history_last_watched_brin 
ON watch_history USING BRIN (last_watched_at);

-- =============================================================================
-- FULL-TEXT SEARCH INDEXES (if using pg_trgm extension)
-- =============================================================================
-- Uncomment if you want to enable LIKE '%search%' queries on titles
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CREATE INDEX IF NOT EXISTS idx_videos_title_trgm 
-- ON videos USING GIN (title gin_trgm_ops);

-- CREATE INDEX IF NOT EXISTS idx_channels_name_trgm 
-- ON channels USING GIN (name gin_trgm_ops);
