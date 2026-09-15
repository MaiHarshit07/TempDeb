const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const notifyVote = async ({ recipientId, actorId, type, topicId, commentId }) => {
  if (recipientId === actorId) return;
  await prisma.notification.create({
    data: {
      recipientId,
      actorId,
      type: commentId ? (type === "UP" ? "COMMENT_UPVOTED" : "COMMENT_DOWNVOTED") : (type === "UP" ? "TOPIC_UPVOTED" : "TOPIC_DOWNVOTED"),
      topicId,
      commentId,
    },
  });
};

const voteOnTopic = async (req, res, next) => {
  try {
    const { topicId, type } = req.body;

    if (!topicId || !["UP", "DOWN"].includes(type)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Valid topicId and vote type are required",
        });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    const existingVote = await prisma.vote.findFirst({
      where: { userId: req.user.id, topicId },
    });

    if (existingVote && existingVote.type === type) {
      await prisma.vote.delete({ where: { id: existingVote.id } });
      return res.json({
        success: true,
        data: { message: "Vote removed", vote: null },
      });
    }

    if (existingVote) {
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { type },
      });
      await notifyVote({ recipientId: topic.authorId, actorId: req.user.id, type, topicId });
      return res.json({
        success: true,
        data: { message: "Vote switched", vote: { type } },
      });
    }

    const vote = await prisma.vote.create({
      data: {
        userId: req.user.id,
        topicId,
        type,
      },
    });
    await notifyVote({ recipientId: topic.authorId, actorId: req.user.id, type, topicId });

    return res
      .status(201)
      .json({ success: true, data: { message: "Vote added", vote } });
  } catch (error) {
    next(error);
  }
};

const voteOnComment = async (req, res, next) => {
  try {
    const { commentId, type } = req.body;

    if (!commentId || !["UP", "DOWN"].includes(type)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Valid commentId and vote type are required",
        });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const existingVote = await prisma.vote.findFirst({
      where: { userId: req.user.id, commentId },
    });

    if (existingVote && existingVote.type === type) {
      await prisma.vote.delete({ where: { id: existingVote.id } });
      return res.json({
        success: true,
        data: { message: "Vote removed", vote: null },
      });
    }

    if (existingVote) {
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { type },
      });
      await notifyVote({ recipientId: comment.authorId, actorId: req.user.id, type, topicId: comment.topicId, commentId });
      return res.json({
        success: true,
        data: { message: "Vote switched", vote: { type } },
      });
    }

    const vote = await prisma.vote.create({
      data: {
        userId: req.user.id,
        commentId,
        type,
      },
    });
    await notifyVote({ recipientId: comment.authorId, actorId: req.user.id, type, topicId: comment.topicId, commentId });

    return res
      .status(201)
      .json({ success: true, data: { message: "Vote added", vote } });
  } catch (error) {
    next(error);
  }
};

module.exports = { voteOnTopic, voteOnComment };
