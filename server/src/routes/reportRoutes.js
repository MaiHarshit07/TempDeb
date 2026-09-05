const express = require("express");
const {
  createReport,
  listReports,
} = require("../controllers/reportController");
const { protect, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createReport);
router.get("/", protect, requireRole("MODERATOR", "ADMIN"), listReports);

module.exports = router;
