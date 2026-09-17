const express = require('express');
const router = express.Router();
const {
  getOverviewStats,
  getConfidenceAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All analytics endpoints require authentication

router.get('/overview', getOverviewStats);
router.get('/confidence', getConfidenceAnalytics);

module.exports = router;
