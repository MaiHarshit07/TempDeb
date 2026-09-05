const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getForYouFeed = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const userInteractions = await prisma.vote.findMany({
    where: { userId: req.user?.id || "" },
    select: { topicId: true, commentId: true },
  });

  const topics = await prisma.topic.findMany({
    where: { status: "ACTIVE" },
    include: { author: true, category: true, comments: true, votes: true },
    skip,
    take: Number(limit),
    orderBy: { createdAt: "desc" },
  });

  const recommendations = topics.map((topic) => {
    let score = 0;
    const categoryAffinity = req.user && topic.category ? 20 : 0;
    score += categoryAffinity;
    score += Math.min(topic.comments.length * 3, 30);
    score += Math.min(
      topic.votes.filter((vote) => vote.type === "UP").length * 2,
      25,
    );
    score += Math.max(
      0,
      10 - Math.abs(new Date() - new Date(topic.createdAt)) / 86400000,
    );
    return { ...topic, score: Number(score.toFixed(2)) };
  });

  const sorted = recommendations.sort((a, b) => b.score - a.score);

  return res.json({
    success: true,
    data: { topics: sorted, page: Number(page), limit: Number(limit) },
  });
};

module.exports = { getForYouFeed };
