const express = require("express");
const { voteOnTopic, voteOnComment } = require("../controllers/voteController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/topics", protect, voteOnTopic);
router.post("/comments", protect, voteOnComment);

module.exports = router;
