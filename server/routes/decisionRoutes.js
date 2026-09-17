const express = require('express');
const router = express.Router();

const {
  createDecision,
  getDecisions,
  getDecisionById,
  updateDecision,
  deleteDecision,
  reviewDecision,
  getDecisionStats
} = require('../controllers/decisionController');

// =========================================
// Decision Routes Mapping
// =========================================

// Root collection routes: /api/decisions
router
  .route('/')
  .get(getDecisions)
  .post(createDecision);

// Aggregate Statistics Route: /api/decisions/stats
// CRITICAL ORDERING RULE:
// This specific route MUST be defined BEFORE the parameter route '/:id'.
// Otherwise, Express will capture '/stats' as req.params.id and fail with a CastError!
router
  .route('/stats')
  .get(getDecisionStats);

// Individual resource routes: /api/decisions/:id
router
  .route('/:id')
  .get(getDecisionById)
  .put(updateDecision)
  .delete(deleteDecision);

// Specialized review endpoint: /api/decisions/:id/review
router
  .route('/:id/review')
  .post(reviewDecision);

module.exports = router;
