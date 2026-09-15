-- CreateEnum
CREATE TYPE "CommentStance" AS ENUM ('FOR', 'AGAINST');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "stance" "CommentStance" NOT NULL DEFAULT 'FOR';

-- CreateIndex
CREATE INDEX "Comment_topicId_stance_idx" ON "Comment"("topicId", "stance");

-- CreateIndex
CREATE INDEX "Comment_parentCommentId_idx" ON "Comment"("parentCommentId");

-- CreateIndex
CREATE INDEX "Vote_topicId_createdAt_idx" ON "Vote"("topicId", "createdAt");