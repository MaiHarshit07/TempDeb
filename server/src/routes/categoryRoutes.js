const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { topics: true } } },
    });

    return res.json({ success: true, data: categories });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
