const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const createReport = async (req, res, next) => {
  try {
    const { topicId, commentId, reason, details } = req.body;

    if (!reason || (!topicId && !commentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Reason and target are required" });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        topicId: topicId || null,
        commentId: commentId || null,
        reason,
        details: details || null,
      },
    });

    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

const listReports = async (req, res) => {
  const reports = await prisma.report.findMany({
    include: { reporter: true, topic: true, comment: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ success: true, data: reports });
};

module.exports = { createReport, listReports };
