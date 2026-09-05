const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { protect, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/dashboard', protect, requireRole('MODERATOR', 'ADMIN'), async (req, res) => {
  const [topics, comments, reports] = await Promise.all([
    prisma.topic.count(),
    prisma.comment.count(),
    prisma.report.count(),
  ]);

  return res.json({ success: true, data: { topics, comments, reports } });
});

router.patch('/topics/:id/lock', protect, requireRole('MODERATOR', 'ADMIN'), async (req, res) => {
  const topic = await prisma.topic.update({
    where: { id: req.params.id },
    data: { status: 'LOCKED' },
  });

  return res.json({ success: true, data: topic });
});

router.patch('/topics/:id/unlock', protect, requireRole('MODERATOR', 'ADMIN'), async (req, res) => {
  const topic = await prisma.topic.update({
    where: { id: req.params.id },
    data: { status: 'ACTIVE' },
  });

  return res.json({ success: true, data: topic });
});

module.exports = router;
