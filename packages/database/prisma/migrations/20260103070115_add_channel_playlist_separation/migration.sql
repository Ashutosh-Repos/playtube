-- AlterTable
ALTER TABLE "playlists" ADD COLUMN     "channelId" TEXT;

-- CreateIndex
CREATE INDEX "playlists_channelId_idx" ON "playlists"("channelId");

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
