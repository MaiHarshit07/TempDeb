-- CreateTable
CREATE TABLE "UserTopicScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTopicScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTopicScore_userId_topicId_key" ON "UserTopicScore"("userId", "topicId");

-- CreateIndex
CREATE INDEX "UserTopicScore_userId_score_idx" ON "UserTopicScore"("userId", "score");

-- CreateIndex
CREATE INDEX "UserTopicScore_userId_idx" ON "UserTopicScore"("userId");

-- AddForeignKey
ALTER TABLE "UserTopicScore" ADD CONSTRAINT "UserTopicScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopicScore" ADD CONSTRAINT "UserTopicScore_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;