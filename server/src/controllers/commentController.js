const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const VALID_STANCES = ["FOR", "AGAINST"];
const MAX_REPLY_FETCH_DEPTH = 5;

const notifyCommentAdded = async ({ recipientId, actorId, topicId, commentId }) => {
  if (recipientId === actorId) return;
  await prisma.notification.create({
    data: { recipientId, actorId, topicId, commentId, type: "COMMENT_ADDED" },
  });
};

const commentInclude = {
  author: {
    select: { id: true, username: true, displayName: true, avatar: true },
  },
  votes: {
    select: { userId: true, type: true },
  },
};

const loadReplies = async (comment, depth = 0) => {
  if (depth >= MAX_REPLY_FETCH_DEPTH) return comment;
  const replies = await prisma.comment.findMany({
    where: { parentCommentId: comment.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: commentInclude,
  });
  return {
    ...comment,
    replies: await Promise.all(
      replies.map((reply) => loadReplies(reply, depth + 1)),
    ),
  };
};

const listTopicComments = async (req, res, next) => {
  try {
    const { stance, commentId } = req.query;
    if (stance && !VALID_STANCES.includes(stance)) {
      return res
        .status(400)
        .json({ success: false, message: "Stance must be FOR or AGAINST" });
    }

    const topic = await prisma.topic.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!topic)
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });

    const comments = await prisma.comment.findMany({
      where: {
        topicId: topic.id,
        status: "ACTIVE",
        ...(commentId ? { id: commentId } : { parentCommentId: null }),
        ...(stance ? { stance } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: commentInclude,
    });

    return res.json({
      success: true,
      data: await Promise.all(comments.map((comment) => loadReplies(comment))),
    });
  } catch (error) {
    next(error);
  }
};

const createTopicComment = async (req, res, next) => {
  try {
    const { content, stance, parentId, parentCommentId } = req.body;
    const replyParentId = parentId || parentCommentId || null;
    const normalizedContent = typeof content === "string" ? content.trim() : "";
    if (!normalizedContent)
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    if (!replyParentId && !VALID_STANCES.includes(stance)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Stance must be FOR or AGAINST for top-level comments",
        });
    }

    const topic = await prisma.topic.findUnique({
      where: { id: req.params.id },
    });
    if (!topic)
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });

    let inheritedStance = stance;
    let parent = null;
    if (replyParentId) {
      parent = await prisma.comment.findUnique({
        where: { id: replyParentId },
      });
      if (!parent || parent.topicId !== topic.id)
        return res
          .status(404)
          .json({ success: false, message: "Parent comment not found" });
      inheritedStance = parent.stance;
    }

    const comment = await prisma.comment.create({
      data: {
        content: normalizedContent,
        stance: inheritedStance,
        authorId: req.user.id,
        topicId: topic.id,
        parentCommentId: replyParentId,
      },
      include: commentInclude,
    });

    await prisma.activity.create({
      data: {
        userId: req.user.id,
        type: "COMMENT_CREATED",
        amount: 5,
        topicId: topic.id,
      },
    });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { activityTokens: { increment: 5 } },
    });
    await notifyCommentAdded({
      recipientId: parent?.authorId || topic.authorId,
      actorId: req.user.id,
      topicId: topic.id,
      commentId: comment.id,
    });
    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
};

const createComment = async (req, res, next) => {
  try {
    const { content, topicId, parentCommentId, stance } = req.body;

    if (!content || !topicId) {
      return res
        .status(400)
        .json({ success: false, message: "Content and topicId are required" });
    }

    if (!parentCommentId && !VALID_STANCES.includes(stance)) {
      return res
        .status(400)
        .json({ success: false, message: "Stance must be FOR or AGAINST" });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    let commentStance = stance;
    let parent = null;
    if (parentCommentId) {
      parent = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });
      if (!parent || parent.topicId !== topicId)
        return res
          .status(404)
          .json({ success: false, message: "Parent comment not found" });
      commentStance = parent.stance;
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        stance: commentStance,
        authorId: req.user.id,
        topicId,
        parentCommentId: parentCommentId || null,
      },
      include: { author: true, parentComment: true },
    });

    await notifyCommentAdded({
      recipientId: parent?.authorId || topic.authorId,
      actorId: req.user.id,
      topicId: topic.id,
      commentId: comment.id,
    });

    await prisma.activity.create({
      data: {
        userId: req.user.id,
        type: "COMMENT_CREATED",
        amount: 5,
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { activityTokens: { increment: 5 } },
    });

    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
};

const updateComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    if (comment.authorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comment",
      });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { content: content.trim() },
    });

    return res.json({ success: true, data: updatedComment });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    if (comment.authorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comment",
      });
    }

    await prisma.comment.delete({ where: { id: req.params.id } });

    return res.json({ success: true, data: { message: "Comment deleted" } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTopicComments,
  createTopicComment,
  createComment,
  updateComment,
  deleteComment,
};
