const { PrismaClient } = require("@prisma/client");
const { formatApiResponse } = require("../utils/helpers");

const prisma = new PrismaClient();
const TREND_WINDOW_HOURS = 6;
const TREND_STABILITY_THRESHOLD = 0.05;
const MIN_VOTES_FOR_LEAN = 10;

const getTopicVoteMetrics = async (topicId) => {
  const now = Date.now();
  const currentStart = new Date(now - TREND_WINDOW_HOURS * 60 * 60 * 1000);
  const previousStart = new Date(now - TREND_WINDOW_HOURS * 2 * 60 * 60 * 1000);
  const [
    forVotes,
    againstVotes,
    currentFor,
    currentAgainst,
    previousFor,
    previousAgainst,
  ] = await Promise.all([
    prisma.vote.count({ where: { topicId, type: "UP" } }),
    prisma.vote.count({ where: { topicId, type: "DOWN" } }),
    prisma.vote.count({
      where: { topicId, type: "UP", createdAt: { gte: currentStart } },
    }),
    prisma.vote.count({
      where: { topicId, type: "DOWN", createdAt: { gte: currentStart } },
    }),
    prisma.vote.count({
      where: {
        topicId,
        type: "UP",
        createdAt: { gte: previousStart, lt: currentStart },
      },
    }),
    prisma.vote.count({
      where: {
        topicId,
        type: "DOWN",
        createdAt: { gte: previousStart, lt: currentStart },
      },
    }),
  ]);
  const totalVotes = forVotes + againstVotes;
  const currentTotal = currentFor + currentAgainst;
  const previousTotal = previousFor + previousAgainst;
  const leanPercent =
    totalVotes >= MIN_VOTES_FOR_LEAN
      ? Math.round((forVotes / totalVotes) * 100)
      : null;
  let trend = "insufficient_data";
  if (currentTotal + previousTotal >= 2) {
    const currentForVelocity = currentFor / TREND_WINDOW_HOURS;
    const currentAgainstVelocity = currentAgainst / TREND_WINDOW_HOURS;
    const previousForVelocity = previousFor / TREND_WINDOW_HOURS;
    const previousAgainstVelocity = previousAgainst / TREND_WINDOW_HOURS;
    const directionalChange =
      currentForVelocity -
      previousForVelocity -
      (currentAgainstVelocity - previousAgainstVelocity);
    const baseline = Math.max(
      previousForVelocity + previousAgainstVelocity,
      1 / TREND_WINDOW_HOURS,
    );
    if (Math.abs(directionalChange) / baseline >= TREND_STABILITY_THRESHOLD) {
      trend = directionalChange > 0 ? "toward_for" : "toward_against";
    } else {
      trend = "stable";
    }
  }
  return {
    leanPercent,
    insufficientVotes: totalVotes < MIN_VOTES_FOR_LEAN,
    trend,
  };
};

const createTopic = async (req, res, next) => {
  try {
    const { title, description, categoryId } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    const topic = await prisma.topic.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        authorId: req.user.id,
        categoryId: categoryId || null,
      },
      include: { category: true, author: true },
    });

    await prisma.activity.create({
      data: {
        userId: req.user.id,
        type: "TOPIC_CREATED",
        amount: 10,
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { activityTokens: { increment: 10 } },
    });

    return res.status(201).json({ success: true, data: topic });
  } catch (error) {
    next(error);
  }
};

const listTopics = async (req, res) => {
  const { page = 1, limit = 20, category, sort = "newest" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let orderBy = { createdAt: "desc" };
  if (sort === "popular") orderBy = { votes: { _count: "desc" } };
  if (sort === "discussed") orderBy = { comments: { _count: "desc" } };

  const where = {
    status: "ACTIVE",
    ...(category ? { category: { slug: category } } : {}),
  };

  const [topics, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy,
      include: {
        author: true,
        category: true,
        comments: true,
        votes: true,
      },
    }),
    prisma.topic.count({ where }),
  ]);

  return res.json({
    success: true,
    data: { topics, page: Number(page), total, limit: Number(limit) },
  });
};

const listForYouTopics = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;
    const where = { userId: req.user.id, topic: { status: "ACTIVE" } };

    const [scores, total] = await Promise.all([
      prisma.userTopicScore.findMany({
        where,
        skip,
        take: limit,
        orderBy: { score: "desc" },
        include: {
          topic: {
            include: {
              author: true,
              category: true,
              comments: true,
              votes: true,
            },
          },
        },
      }),
      prisma.userTopicScore.count({ where }),
    ]);

    if (total > 0) {
      return res.json({
        success: true,
        data: { topics: scores.map(({ topic }) => topic), page, total, limit },
      });
    }

    const trendingWhere = { status: "ACTIVE" };
    const [topics, trendingTotal] = await Promise.all([
      prisma.topic.findMany({
        where: trendingWhere,
        skip,
        take: limit,
        orderBy: [
          { votes: { _count: "desc" } },
          { comments: { _count: "desc" } },
          { createdAt: "desc" },
        ],
        include: { author: true, category: true, comments: true, votes: true },
      }),
      prisma.topic.count({ where: trendingWhere }),
    ]);

    return res.json({
      success: true,
      data: { topics, page, total: trendingTotal, limit },
    });
  } catch (error) {
    next(error);
  }
};

const getTopic = async (req, res) => {
  const topic = await prisma.topic.findUnique({
    where: { id: req.params.id },
    include: {
      author: true,
      category: true,
      comments: {
        include: {
          author: true,
          replies: { include: { author: true } },
          votes: true,
        },
        orderBy: { createdAt: "asc" },
      },
      votes: true,
    },
  });

  if (!topic) {
    return res.status(404).json({ success: false, message: "Topic not found" });
  }

  const voteMetrics = await getTopicVoteMetrics(topic.id);
  return res.json({ success: true, data: { ...topic, ...voteMetrics } });
};

const updateTopic = async (req, res, next) => {
  try {
    const { title, description, categoryId } = req.body;
    const topic = await prisma.topic.findUnique({
      where: { id: req.params.id },
    });

    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    if (topic.authorId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "You can only edit your own topic" });
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: req.params.id },
      data: {
        title: title || undefined,
        description: description || undefined,
        categoryId: categoryId || undefined,
      },
    });

    return res.json({ success: true, data: updatedTopic });
  } catch (error) {
    next(error);
  }
};

const deleteTopic = async (req, res, next) => {
  try {
    const topic = await prisma.topic.findUnique({
      where: { id: req.params.id },
    });

    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    if (topic.authorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own topic",
      });
    }

    await prisma.topic.delete({ where: { id: req.params.id } });

    return res.json({ success: true, data: { message: "Topic deleted" } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTopic,
  listTopics,
  listForYouTopics,
  getTopic,
  updateTopic,
  deleteTopic,
};
