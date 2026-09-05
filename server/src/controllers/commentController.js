const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const createComment = async (req, res, next) => {
  try {
    const { content, topicId, parentCommentId } = req.body;

    if (!content || !topicId) {
      return res
        .status(400)
        .json({ success: false, message: "Content and topicId are required" });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        authorId: req.user.id,
        topicId,
        parentCommentId: parentCommentId || null,
      },
      include: { author: true, parentComment: true },
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
      return res
        .status(403)
        .json({
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
      return res
        .status(403)
        .json({
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

module.exports = { createComment, updateComment, deleteComment };
