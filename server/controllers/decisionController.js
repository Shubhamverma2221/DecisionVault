const Decision = require('../models/Decision');

/**
 * Helper to compute weighted scores for criteria
 */
function calculateWeightedScores(options, criteria) {
  if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
    return [];
  }

  const optionTotals = {};
  options.forEach((opt) => {
    optionTotals[opt] = 0;
  });

  criteria.forEach((crit) => {
    const weightFactor = (crit.weight || 0) / 100;
    if (Array.isArray(crit.scores)) {
      crit.scores.forEach((s) => {
        if (optionTotals[s.option] !== undefined) {
          optionTotals[s.option] += (s.score || 0) * weightFactor;
        }
      });
    }
  });

  return Object.keys(optionTotals).map((opt) => ({
    option: opt,
    totalScore: Math.round(optionTotals[opt] * 100) / 100
  }));
}

/**
 * @desc    Create a new decision record
 * @route   POST /api/decisions
 * @access  Private (Protected)
 */
const createDecision = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      options,
      selectedOption,
      reasoning,
      confidence,
      expectedOutcome,
      reviewDate,
      criteria
    } = req.body;

    const calculatedScores = calculateWeightedScores(options, criteria);

    const initialAudit = [
      {
        action: 'Decision Created',
        details: `Created with ${confidence}% confidence for review on ${new Date(reviewDate).toLocaleDateString()}`,
        timestamp: new Date()
      }
    ];

    const decision = await Decision.create({
      userId: req.user._id,
      title,
      description,
      category,
      tags: Array.isArray(tags) ? tags : [],
      options,
      selectedOption,
      reasoning,
      confidence,
      expectedOutcome,
      reviewDate,
      criteria: Array.isArray(criteria) ? criteria : [],
      calculatedScores,
      auditHistory: initialAudit
    });

    res.status(201).json({
      success: true,
      message: 'Decision recorded successfully',
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch decisions belonging to authenticated user with filters & search
 * @route   GET /api/decisions
 * @access  Private (Protected)
 */
const getDecisions = async (req, res, next) => {
  try {
    const {
      category,
      status,
      search,
      sort,
      favorite,
      archived,
      tag,
      outcome
    } = req.query;

    // Strict user scoping
    const query = { userId: req.user._id };

    // Archive filter: default to non-archived decisions unless explicitly requested
    if (archived === 'true') {
      query.isArchived = true;
    } else {
      query.isArchived = false;
    }

    // Favorite filter
    if (favorite === 'true') {
      query.isFavorite = true;
    }

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Tag filter
    if (tag) {
      query.tags = tag;
    }

    // Outcome filter (Achieved, Partially Achieved, Not Achieved)
    if (outcome) {
      query['review.result'] = outcome;
    }

    // Dynamic Status filter translation
    const now = new Date();
    if (status === 'Reviewed') {
      query['review.result'] = { $ne: null };
    } else if (status === 'Review Due') {
      query['review.result'] = null;
      query.reviewDate = { $lte: now };
    } else if (status === 'Pending Review') {
      query['review.result'] = null;
      query.reviewDate = { $gt: now };
    }

    // Search filter across text fields
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { reasoning: searchRegex },
        { expectedOutcome: searchRegex },
        { tags: searchRegex },
        { 'review.actualOutcome': searchRegex },
        { 'review.lessonLearned': searchRegex }
      ];
    }

    // Dynamic sorting
    let sortOption = { createdAt: -1 }; // Default: Newest first
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'reviewDate') {
      sortOption = { reviewDate: 1 };
    } else if (sort === 'confidence-desc') {
      sortOption = { confidence: -1 };
    } else if (sort === 'confidence-asc') {
      sortOption = { confidence: 1 };
    } else if (sort === 'recentlyReviewed') {
      sortOption = { 'review.reviewedAt': -1 };
    }

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
 * @desc    Fetch single decision by ID with ownership enforcement
 * @route   GET /api/decisions/:id
 * @access  Private (Protected)
 */
const getDecisionById = async (req, res, next) => {
  try {
    const decision = await Decision.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found or you do not have permission to view it'
      });
    }

    res.status(200).json({
      success: true,
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update unreviewed decision
 * @route   PUT /api/decisions/:id
 * @access  Private (Protected)
 */
const updateDecision = async (req, res, next) => {
  try {
    const decision = await Decision.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found'
      });
    }

    // Historical Immutability Invariant: Reviewed decisions cannot be edited!
    if (decision.review && decision.review.result) {
      return res.status(400).json({
        success: false,
        error: 'Reviewed decisions cannot be modified. Historical integrity must be preserved.'
      });
    }

    // Prevent direct modification of review subdocument via PUT
    delete req.body.review;
    delete req.body.userId; // Prevent transferring ownership

    // Recalculate criteria if updated
    if (req.body.criteria || req.body.options) {
      const opts = req.body.options || decision.options;
      const crits = req.body.criteria || decision.criteria;
      req.body.calculatedScores = calculateWeightedScores(opts, crits);
    }

    // Audit entry
    const changes = Object.keys(req.body).filter(k => k !== 'auditHistory');
    decision.auditHistory.push({
      action: 'Decision Updated',
      details: `Updated fields: ${changes.join(', ')}`,
      timestamp: new Date()
    });

    Object.assign(decision, req.body);
    await decision.save();

    res.status(200).json({
      success: true,
      message: 'Decision updated successfully',
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle favorite status
 * @route   PATCH /api/decisions/:id/favorite
 * @access  Private (Protected)
 */
const toggleFavorite = async (req, res, next) => {
  try {
    const decision = await Decision.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found'
      });
    }

    decision.isFavorite = !decision.isFavorite;
    decision.auditHistory.push({
      action: decision.isFavorite ? 'Marked as Favorite' : 'Removed from Favorites',
      timestamp: new Date()
    });

    await decision.save();

    res.status(200).json({
      success: true,
      message: decision.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle archive status
 * @route   PATCH /api/decisions/:id/archive
 * @access  Private (Protected)
 */
const toggleArchive = async (req, res, next) => {
  try {
    const decision = await Decision.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found'
      });
    }

    decision.isArchived = !decision.isArchived;
    decision.auditHistory.push({
      action: decision.isArchived ? 'Archived Decision' : 'Restored from Archive',
      timestamp: new Date()
    });

    await decision.save();

    res.status(200).json({
      success: true,
      message: decision.isArchived ? 'Decision archived' : 'Decision restored',
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a decision
 * @route   DELETE /api/decisions/:id
 * @access  Private (Protected)
 */
const deleteDecision = async (req, res, next) => {
  try {
    const decision = await Decision.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Decision deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit retrospective review & permanently seal decision
 * @route   POST /api/decisions/:id/review
 * @access  Private (Protected)
 */
const reviewDecision = async (req, res, next) => {
  try {
    const { actualOutcome, result, outcomeScore, lessonLearned } = req.body;

    const decision = await Decision.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: 'Decision not found'
      });
    }

    // Duplicate review guard
    if (decision.review && decision.review.result) {
      return res.status(400).json({
        success: false,
        error: 'This decision has already been reviewed and evaluated. Reviews cannot be overwritten.'
      });
    }

    decision.review = {
      actualOutcome,
      result,
      outcomeScore: outcomeScore ? Number(outcomeScore) : null,
      lessonLearned,
      reviewedAt: new Date()
    };

    decision.auditHistory.push({
      action: 'Retrospective Review Completed',
      details: `Evaluation: ${result} ${outcomeScore ? `(${outcomeScore}/10)` : ''}`,
      timestamp: new Date()
    });

    await decision.save();

    res.status(200).json({
      success: true,
      message: 'Retrospective review recorded successfully. Decision is now permanently sealed.',
      data: decision
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch all lessons learned from reviewed decisions
 * @route   GET /api/decisions/lessons
 * @access  Private (Protected)
 */
const getLessons = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const query = {
      userId: req.user._id,
      'review.result': { $ne: null }
    };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { 'review.lessonLearned': searchRegex },
        { tags: searchRegex }
      ];
    }

    const reviewed = await Decision.find(query)
      .select('title category review createdAt reviewDate tags confidence')
      .sort({ 'review.reviewedAt': -1 });

    const lessons = reviewed.map((d) => ({
      decisionId: d._id,
      title: d.title,
      category: d.category,
      tags: d.tags,
      confidence: d.confidence,
      result: d.review.result,
      outcomeScore: d.review.outcomeScore,
      lessonLearned: d.review.lessonLearned,
      actualOutcome: d.review.actualOutcome,
      reviewedAt: d.review.reviewedAt
    }));

    res.status(200).json({
      success: true,
      count: lessons.length,
      data: lessons
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fetch decision calendar timeline events
 * @route   GET /api/decisions/calendar
 * @access  Private (Protected)
 */
const getCalendarEvents = async (req, res, next) => {
  try {
    const decisions = await Decision.find({ userId: req.user._id }).select(
      'title category reviewDate createdAt review status isFavorite'
    );

    const events = [];
    decisions.forEach((d) => {
      // Event 1: Creation
      events.push({
        id: `${d._id}_created`,
        decisionId: d._id,
        title: `Decided: ${d.title}`,
        category: d.category,
        date: d.createdAt,
        type: 'created',
        status: d.status
      });

      // Event 2: Target Review Date
      events.push({
        id: `${d._id}_due`,
        decisionId: d._id,
        title: `Review: ${d.title}`,
        category: d.category,
        date: d.reviewDate,
        type: 'due',
        status: d.status
      });

      // Event 3: Reviewed (if completed)
      if (d.review && d.review.reviewedAt) {
        events.push({
          id: `${d._id}_reviewed`,
          decisionId: d._id,
          title: `Reviewed [${d.review.result}]: ${d.title}`,
          category: d.category,
          date: d.review.reviewedAt,
          type: 'reviewed',
          result: d.review.result,
          status: d.status
        });
      }
    });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export user decisions as JSON or CSV
 * @route   GET /api/decisions/export
 * @access  Private (Protected)
 */
const exportDecisions = async (req, res, next) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const decisions = await Decision.find({ userId: req.user._id }).sort({ createdAt: -1 });

    if (format === 'csv') {
      const headers = [
        'ID',
        'Title',
        'Category',
        'Confidence',
        'Selected Option',
        'Status',
        'Created Date',
        'Review Date',
        'Result',
        'Outcome Score',
        'Actual Outcome',
        'Lesson Learned'
      ];

      const rows = decisions.map((d) => [
        `"${d._id}"`,
        `"${(d.title || '').replace(/"/g, '""')}"`,
        `"${d.category}"`,
        d.confidence,
        `"${(d.selectedOption || '').replace(/"/g, '""')}"`,
        `"${d.status}"`,
        `"${new Date(d.createdAt).toISOString()}"`,
        `"${new Date(d.reviewDate).toISOString()}"`,
        `"${(d.review?.result || '').replace(/"/g, '""')}"`,
        d.review?.outcomeScore || '',
        `"${(d.review?.actualOutcome || '').replace(/"/g, '""')}"`,
        `"${(d.review?.lessonLearned || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="decisionvault_export.csv"');
      return res.status(200).send(csvContent);
    }

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
};
