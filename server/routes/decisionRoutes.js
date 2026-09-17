const express = require('express');
const router = express.Router();
const {
  createDecision,
  getDecisions,
  getDecisionById,
  updateDecision,
  deleteDecision,
  toggleFavorite,
  toggleArchive,
  reviewDecision,
  getLessons,
  getCalendarEvents,
  exportDecisions
} = require('../controllers/decisionController');
const { protect } = require('../middleware/authMiddleware');

// Enforce authentication on all decision routes
router.use(protect);

// Specific static sub-resource endpoints (must precede parameterized /:id)
router.get('/lessons', getLessons);
router.get('/calendar', getCalendarEvents);
router.get('/export', exportDecisions);

// Primary collection routes
router
  .route('/')
  .get(getDecisions)
  .post(createDecision);

// Specific document actions
router.post('/:id/review', reviewDecision);
router.patch('/:id/favorite', toggleFavorite);
router.patch('/:id/archive', toggleArchive);

// Primary document CRUD routes
router
  .route('/:id')
  .get(getDecisionById)
  .put(updateDecision)
  .delete(deleteDecision);

module.exports = router;
