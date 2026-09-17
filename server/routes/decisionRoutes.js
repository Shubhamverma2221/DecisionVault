const express = require('express');
const router = express.Router();

const {
  createDecision,
  getDecisions,
  getDecisionById,
  updateDecision,
  deleteDecision,
  reviewDecision
} = require('../controllers/decisionController');

// =========================================
// Decision Routes Mapping
// =========================================

// Root collection routes: /api/decisions
router
  .route('/')
  .get(getDecisions)
  .post(createDecision);

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
