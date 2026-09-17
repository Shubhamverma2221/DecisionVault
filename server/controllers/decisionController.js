const Decision = require('../models/Decision');

/**
 * @desc    Create a new decision
 * @route   POST /api/decisions
 * @access  Public
 */
const createDecision = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      options,
      selectedOption,
      reasoning,
      confidence,
      expectedOutcome,
      reviewDate,
      tags
    } = req.body;

    // Validate review date format
    if (reviewDate && isNaN(Date.parse(reviewDate))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review date format. Must be a valid parseable date.'
      });
    }

    // Persist new decision document to MongoDB
    const decision = await Decision.create({
      title,
      description,
      category,
      options,
      selectedOption,
      reasoning,
      confidence,
      expectedOutcome,
      reviewDate,
      tags
    });

    // Return 201 Created with the saved document (including virtuals)
    res.status(201).json({
      success: true,
      data: decision
    });
  } catch (error) {
    // Pass validation errors or unexpected exceptions to centralized error middleware
    next(error);
  }
};

/**
 * @desc    Get all decisions with support for filtering, search, and sorting
 * @route   GET /api/decisions
 * @access  Public
 */
const getDecisions = async (req, res, next) => {
  try {
    const { category, status, search, sort } = req.query;

    // Initialize dynamic MongoDB query filter object
    const query = {};

    // 1. Category Filter (e.g. Technology, Career, Finance)
    if (category && category !== 'All') {
      query.category = category;
    }

    // 2. Status Filter
    // Because 'status' is a dynamic virtual getter (not a persisted column),
    // we translate the virtual status request into equivalent MongoDB query conditions:
    if (status) {
      const now = new Date();
      if (status === 'Reviewed') {
        query['review.result'] = { $exists: true, $ne: null };
      } else if (status === 'Review Due') {
        query.review = null;
        query.reviewDate = { $lte: now };
      } else if (status === 'Pending Review') {
        query.review = null;
        query.reviewDate = { $gt: now };
      }
    }

    // 3. Text Search (Case-insensitive regex across title, description, and reasoning)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reasoning: { $regex: search, $options: 'i' } }
      ];
    }

    // 4. Dynamic Sorting (Defaults to newest first)
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'confidence_high') {
      sortOption = { confidence: -1 };
    } else if (sort === 'confidence_low') {
      sortOption = { confidence: 1 };
    } else if (sort === 'review_date') {
      sortOption = { reviewDate: 1 };
    }

    // Execute query with sorting
    const decisions = await Decision.find(query).sort(sortOption);

    res.status(200).json({
      success: true,
      count: decisions.length,
      data: decisions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDecision,
  getDecisions
};
