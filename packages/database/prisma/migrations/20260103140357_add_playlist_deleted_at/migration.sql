-- AlterTable
ALTER TABLE "playlists" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "playlists_deletedAt_idx" ON "playlists"("deletedAt");
