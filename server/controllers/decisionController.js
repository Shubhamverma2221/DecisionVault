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

/**
 * @desc    Get single decision by ID
 * @route   GET /api/decisions/:id
 * @access  Public
 */
const getDecisionById = async (req, res, next) => {
  try {
    const decision = await Decision.findById(req.params.id);

    // If no document was found with this valid ObjectId
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: `Decision not found with ID: ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: decision
    });
  } catch (error) {
    // If req.params.id is an invalid ObjectId format, Mongoose throws CastError,
    // which errorHandler intercepts and cleanly returns 404
    next(error);
  }
};

/**
 * @desc    Update decision details (allowed only before review is submitted)
 * @route   PUT /api/decisions/:id
 * @access  Public
 */
const updateDecision = async (req, res, next) => {
  try {
    const decision = await Decision.findById(req.params.id);

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: `Decision not found with ID: ${req.params.id}`
      });
    }

    // Business Logic / Immutability Rule:
    // Once a decision has been reviewed, its original premises, confidence,
    // and expected outcome are permanently locked to preserve historical truth.
    if (decision.review && decision.review.result) {
      return res.status(400).json({
        success: false,
        error: 'Reviewed decisions cannot be modified. Historical integrity must be preserved.'
      });
    }

    // Prevent direct manipulation of review object through standard PUT route
    if (req.body.review !== undefined) {
      delete req.body.review;
    }

    // Update with new: true (returns updated doc) and runValidators: true (enforces schema checks on updates)
    const updatedDecision = await Decision.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: updatedDecision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a decision
 * @route   DELETE /api/decisions/:id
 * @access  Public
 */
const deleteDecision = async (req, res, next) => {
  try {
    const decision = await Decision.findById(req.params.id);

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: `Decision not found with ID: ${req.params.id}`
      });
    }

    await Decision.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Decision deleted successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit retrospective review for a decision
 * @route   POST /api/decisions/:id/review
 * @access  Public
 */
const reviewDecision = async (req, res, next) => {
  try {
    const { actualOutcome, result, lessonLearned } = req.body;

    const decision = await Decision.findById(req.params.id);

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: `Decision not found with ID: ${req.params.id}`
      });
    }

    // Business Logic Rule: Duplicate Review Prevention
    // A decision can only be reviewed once. Once reviewed, it is permanently locked.
    if (decision.review && decision.review.result) {
      return res.status(400).json({
        success: false,
        error: 'This decision has already been reviewed and evaluated. Reviews cannot be overwritten.'
      });
    }

    // Explicit payload validation before attaching
    if (!actualOutcome || !actualOutcome.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide what actually happened (actualOutcome is required).'
      });
    }

    if (!result) {
      return res.status(400).json({
        success: false,
        error: 'Please evaluate whether the expected outcome was Achieved, Partially Achieved, or Not Achieved.'
      });
    }

    if (!lessonLearned || !lessonLearned.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please document what you learned from this decision (lessonLearned is required).'
      });
    }

    // Attach embedded review subdocument
    decision.review = {
      actualOutcome: actualOutcome.trim(),
      result,
      lessonLearned: lessonLearned.trim(),
      reviewedAt: new Date()
    };

    // Save document to trigger Mongoose embedded schema validation
    await decision.save();

    res.status(200).json({
      success: true,
      message: 'Decision review recorded successfully',
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDecision,
  getDecisions,
  getDecisionById,
  updateDecision,
  deleteDecision,
  reviewDecision
};
