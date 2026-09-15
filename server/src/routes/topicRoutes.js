const express = require("express");
const {
  createTopic,
  listTopics,
  listForYouTopics,
  getTopic,
  updateTopic,
  deleteTopic,
} = require("../controllers/topicController");
const {
  listTopicComments,
  createTopicComment,
} = require("../controllers/commentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", listTopics);
router.get("/for-you", protect, listForYouTopics);
router.get("/:id/comments", listTopicComments);
router.post("/:id/comments", protect, createTopicComment);
router.get("/:id", getTopic);
router.post("/", protect, createTopic);
router.put("/:id", protect, updateTopic);
router.delete("/:id", protect, deleteTopic);

module.exports = router;
