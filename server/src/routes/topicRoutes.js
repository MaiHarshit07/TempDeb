const express = require("express");
const {
  createTopic,
  listTopics,
  getTopic,
  updateTopic,
  deleteTopic,
} = require("../controllers/topicController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", listTopics);
router.get("/:id", getTopic);
router.post("/", protect, createTopic);
router.put("/:id", protect, updateTopic);
router.delete("/:id", protect, deleteTopic);

module.exports = router;
