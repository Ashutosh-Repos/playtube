# Schema Performance Analysis

## ✅ Performance Strengths

### 1. Denormalization Strategy (Excellent)
- `Video.channelHandle/channelName/channelImage` - Avoids joins in feed queries
- `Video.viewCount/likeCount/commentCount` - Avoids COUNT(*) aggregations
- `Channel.subscriberCount/videoCount` - Pre-computed counters
- `Comment.likeCount/replyCount` - Pre-computed

### 2. Feed Scoring (Excellent)
- `Video.hotScore/trendingScore/engagementScore` - Pre-computed for sorting
- Enables `ORDER BY hotScore DESC` instead of complex calculations

### 3. Index Coverage (Good)
- 70+ indexes defined
- Composite indexes for common query patterns
- Sorted indexes for pagination

---

## 🟡 Performance Concerns

### 1. High-Cardinality Tables (Watch Patterns)

**WatchHistory** - Will grow to billions of rows
```sql
-- Current query pattern (slow at scale):
SELECT * FROM watch_history 
WHERE user_id = ? 
ORDER BY last_watched_at DESC 
LIMIT 20;
```

**Recommendation:** Consider partitioning by `userId` hash or time-based partitioning.

---

### 2. Notification Table Growth

**Problem:** Notifications table grows unbounded.

**Current indexes are good, but:**
- Old notifications should be archived/deleted
- Consider TTL-based cleanup (delete > 90 days)

```sql
-- Add migration for cleanup job:
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days' 
AND is_read = true;
```

---

### 3. Missing Partial Indexes

PostgreSQL supports partial indexes (not in Prisma, need raw SQL):

```sql
-- Only index non-deleted videos (99% of queries)
CREATE INDEX idx_videos_active ON videos (visibility, published_at DESC) 
WHERE deleted_at IS NULL;

-- Only index unprocessed outbox events
CREATE INDEX idx_outbox_pending ON outbox_events (created_at) 
WHERE processed_at IS NULL;

-- Only index pending reports
CREATE INDEX idx_reports_pending ON reports (created_at DESC) 
WHERE status = 'PENDING';
```

---

### 4. Array Fields (tags) - Missing GIN Index

**Problem:** `Video.tags` and `LiveStream.tags` use `String[]` but need GIN indexes.

```sql
-- Add via migration:
CREATE INDEX idx_videos_tags ON videos USING GIN (tags);
CREATE INDEX idx_live_streams_tags ON live_streams USING GIN (tags);
```

---

### 5. LiveChat - High Write Volume

**Problem:** LiveChat gets thousands of inserts/second during streams.

**Recommendations:**
1. Use Redis for live chat, persist to DB in batches
2. If using DB directly, consider:
   - Unlogged tables (no WAL, faster writes, less durable)
   - Partitioning by `streamId`

---

## 🔴 Potential Bottlenecks at Scale

### 1. Subscription Feed Query
```sql
-- Gets all videos from all subscribed channels
SELECT v.* FROM videos v
JOIN subscriptions s ON v.channel_id = s.channel_id
WHERE s.subscriber_id = ?
  AND v.visibility = 'PUBLIC'
  AND v.deleted_at IS NULL
ORDER BY v.published_at DESC
LIMIT 50;
```

**At scale (user with 500 subscriptions):** This JOIN is expensive.

**Solution:** Use Redis to cache subscription feed, update via pub/sub.

---

### 2. Home Feed Personalization

**Problem:** Querying `UserInterest` + `Video` with complex scoring is slow.

**Solution:** Pre-compute personalized feeds in Redis using background jobs.

---

### 3. Counter Updates (Hot Spots)

**Problem:** `Video.viewCount` updated on every view = row lock contention.

**Solutions:**
1. **Redis counters** - Increment in Redis, flush to DB every 5 minutes
2. **Async writes** - Queue view events, batch update DB
3. **Sharded counters** - Multiple counter rows, sum on read

---

## 📊 Index Analysis Summary

| Table | Indexes | Status |
|-------|---------|--------|
| User | 3 | ✅ Good |
| Account | 2 | ✅ Good |
| Session | 2 | ✅ Good |
| Channel | 4 | ✅ Good |
| Subscription | 4 | ✅ Good |
| Video | 12 | ✅ Excellent |
| LiveStream | 7 | ✅ Good |
| LiveChat | 3 | ⚠️ May need sharding |
| Comment | 5 | ✅ Good |
| WatchHistory | 4 | ⚠️ May need partitioning |
| Notification | 4 | ⚠️ Needs cleanup strategy |
| Report | 10 | ✅ Good |

---

## 🚀 Production Recommendations

### Immediate (Before Launch)
1. Add GIN indexes for `tags` arrays (raw SQL migration)
2. Set up notification cleanup job

### Short-term (First 100K users)
3. Implement Redis caching for:
   - View counts (batch sync to DB)
   - Subscription feeds
   - Session data

### Long-term (1M+ users)
4. Partition high-growth tables:
   - `WatchHistory` (by user hash or monthly)
   - `Notification` (by month)
   - `LiveChat` (by stream)
5. Consider read replicas for feed queries
6. Move aggregations to ClickHouse/TimescaleDB

---

## Raw SQL Migrations Needed

```sql
-- migrations/add_performance_indexes.sql

-- GIN indexes for array searches
CREATE INDEX idx_videos_tags ON videos USING GIN (tags);
CREATE INDEX idx_live_streams_tags ON live_streams USING GIN (tags);

-- Partial indexes for common filters
CREATE INDEX idx_videos_public_active ON videos (published_at DESC) 
WHERE visibility = 'PUBLIC' AND deleted_at IS NULL;

CREATE INDEX idx_outbox_unprocessed ON outbox_events (created_at) 
WHERE processed_at IS NULL;

-- BRIN index for time-series data (very compact)
CREATE INDEX idx_notifications_created_brin ON notifications 
USING BRIN (created_at);
```
