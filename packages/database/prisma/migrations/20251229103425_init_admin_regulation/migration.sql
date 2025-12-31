/*
  Warnings:

  - You are about to drop the column `replacedBy` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - The required column `familyId` was added to the `refresh_tokens` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AdminContentStatus" AS ENUM ('NORMAL', 'AGE_RESTRICTED', 'SENSITIVE_CONTENT', 'TAKEN_DOWN', 'COPYRIGHT_BLOCKED');

-- CreateEnum
CREATE TYPE "StrikeType" AS ENUM ('WARNING', 'COMMUNITY_GUIDELINE', 'COPYRIGHT');

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "featureFlags" JSONB,
ADD COLUMN     "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "isAdminRemoved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "community_posts" ADD COLUMN     "adminStatus" "AdminContentStatus" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "live_streams" ADD COLUMN     "adminStatus" "AdminContentStatus" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "forcedEndedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "replacedBy",
ADD COLUMN     "familyId" TEXT NOT NULL,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "strikeId" TEXT;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "adminStatus" "AdminContentStatus" NOT NULL DEFAULT 'NORMAL';

-- DropTable
DROP TABLE "sessions";

-- CreateTable
CREATE TABLE "strikes" (
    "id" TEXT NOT NULL,
    "channelId" TEXT,
    "userId" TEXT,
    "type" "StrikeType" NOT NULL,
    "severity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "internalNote" TEXT,
    "videoId" TEXT,
    "commentId" TEXT,
    "postId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "appealed" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "adminId" TEXT,

    CONSTRAINT "strikes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strikes_channelId_idx" ON "strikes"("channelId");

-- CreateIndex
CREATE INDEX "strikes_userId_idx" ON "strikes"("userId");

-- CreateIndex
CREATE INDEX "strikes_expiresAt_idx" ON "strikes"("expiresAt");

-- CreateIndex
CREATE INDEX "channels_status_idx" ON "channels"("status");

-- CreateIndex
CREATE INDEX "channels_featureFlags_idx" ON "channels" USING GIN ("featureFlags");

-- CreateIndex
CREATE INDEX "channels_tags_idx" ON "channels" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "reports_strikeId_idx" ON "reports"("strikeId");

-- CreateIndex
CREATE INDEX "user_interests_interestType_interestId_score_idx" ON "user_interests"("interestType", "interestId", "score" DESC);

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_strikeId_fkey" FOREIGN KEY ("strikeId") REFERENCES "strikes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
