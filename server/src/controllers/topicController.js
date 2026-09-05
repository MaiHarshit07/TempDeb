const { PrismaClient } = require("@prisma/client");
const { formatApiResponse } = require("../utils/helpers");

const prisma = new PrismaClient();

const createTopic = async (req, res, next) => {
  try {
    const { title, description, categoryId } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({
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

  const where = category ? { category: { slug: category } } : {};

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

  return res.json({ success: true, data: topic });
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
      return res
        .status(403)
        .json({
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
  getTopic,
  updateTopic,
  deleteTopic,
};
