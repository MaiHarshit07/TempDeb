const express = require('express');
const { getForYouFeed } = require('../controllers/feedController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/for-you', protect, getForYouFeed);

module.exports = router;
