const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/profile/:username", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    include: {
      topics: { orderBy: { createdAt: "desc" } },
      comments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
      activityTokens: user.activityTokens,
      createdAt: user.createdAt,
      topics: user.topics,
      comments: user.comments,
    },
  });
});

router.patch("/me", protect, async (req, res) => {
  const { displayName, bio, avatar } = req.body;

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      displayName: displayName || undefined,
      bio: bio || undefined,
      avatar: avatar || undefined,
    },
  });

  return res.json({ success: true, data: updated });
});

module.exports = router;
