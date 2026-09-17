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

/**
 * @desc    Calculate aggregate statistics and calibration metrics directly in MongoDB
 * @route   GET /api/decisions/stats
 * @access  Public
 */
const getDecisionStats = async (req, res, next) => {
  try {
    const now = new Date();

    // MongoDB Aggregation Pipeline: Calculates all metrics natively in database engine
    const statsResult = await Decision.aggregate([
      {
        $facet: {
          // 1. Total count and average confidence across all decisions
          totalSummary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                avgConfidenceAll: { $avg: '$confidence' }
              }
            }
          ],
          // 2. Counts categorized by lifecycle status and review outcome
          statusSummary: [
            {
              $group: {
                _id: null,
                reviewed: {
                  $sum: {
                    $cond: [{ $ifNull: ['$review.result', false] }, 1, 0]
                  }
                },
                pending: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: [{ $ifNull: ['$review.result', null] }, null] },
                          { $gt: ['$reviewDate', now] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                reviewDue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: [{ $ifNull: ['$review.result', null] }, null] },
                          { $lte: ['$reviewDate', now] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                achieved: {
                  $sum: {
                    $cond: [{ $eq: ['$review.result', 'Achieved'] }, 1, 0]
                  }
                },
                partiallyAchieved: {
                  $sum: {
                    $cond: [{ $eq: ['$review.result', 'Partially Achieved'] }, 1, 0]
                  }
                },
                notAchieved: {
                  $sum: {
                    $cond: [{ $eq: ['$review.result', 'Not Achieved'] }, 1, 0]
                  }
                }
              }
            }
          ],
          // 3. Average confidence specifically for Achieved decisions
          achievedConfidence: [
            { $match: { 'review.result': 'Achieved' } },
            { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
          ],
          // 4. Average confidence specifically for Not Achieved decisions
          failedConfidence: [
            { $match: { 'review.result': 'Not Achieved' } },
            { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
          ],
          // 5. Category breakdown
          categoryBreakdown: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
                achievedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$review.result', 'Achieved'] }, 1, 0]
                  }
                }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    const facet = statsResult[0];

    const total = facet.totalSummary[0]?.total || 0;
    const avgConfidenceAll = Math.round(facet.totalSummary[0]?.avgConfidenceAll || 0);

    const status = facet.statusSummary[0] || {
      reviewed: 0,
      pending: 0,
      reviewDue: 0,
      achieved: 0,
      partiallyAchieved: 0,
      notAchieved: 0
    };

    const avgConfidenceAchieved = Math.round(facet.achievedConfidence[0]?.avgConfidence || 0);
    const avgConfidenceFailed = Math.round(facet.failedConfidence[0]?.avgConfidence || 0);

    // Calculate percentage hit rate
    const successRate = status.reviewed > 0
      ? Math.round((status.achieved / status.reviewed) * 100)
      : 0;

    // Calibration Gap: Difference between overall confidence and actual success rate
    // Positive gap indicates overconfidence; negative indicates humility/underconfidence
    const calibrationGap = status.reviewed > 0
      ? avgConfidenceAll - successRate
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalDecisions: total,
        reviewedCount: status.reviewed,
        pendingCount: status.pending,
        dueCount: status.reviewDue,
        achievedCount: status.achieved,
        partiallyAchievedCount: status.partiallyAchieved,
        notAchievedCount: status.notAchieved,
        successRate,
        avgConfidenceAll,
        avgConfidenceAchieved,
        avgConfidenceFailed,
        calibrationGap,
        categoryBreakdown: (facet.categoryBreakdown || []).map((cat) => ({
          category: cat._id,
          count: cat.count,
          achievedCount: cat.achievedCount
        }))
      }
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
  reviewDecision,
  getDecisionStats
};
