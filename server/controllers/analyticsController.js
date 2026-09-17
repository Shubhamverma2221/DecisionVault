const mongoose = require('mongoose');
const Decision = require('../models/Decision');

/**
 * @desc    Get comprehensive dashboard overview metrics & calibration gap
 * @route   GET /api/analytics/overview
 * @access  Private (Protected)
 */
const getOverviewStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const statsPipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId), isArchived: false } },
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                totalDecisions: { $sum: 1 },
                avgConfidence: { $avg: '$confidence' },
                reviewedCount: {
                  $sum: { $cond: [{ $ifNull: ['$review.result', false] }, 1, 0] }
                },
                pendingCount: {
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
                dueCount: {
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
                achievedCount: {
                  $sum: { $cond: [{ $eq: ['$review.result', 'Achieved'] }, 1, 0] }
                },
                partiallyAchievedCount: {
                  $sum: { $cond: [{ $eq: ['$review.result', 'Partially Achieved'] }, 1, 0] }
                },
                notAchievedCount: {
                  $sum: { $cond: [{ $eq: ['$review.result', 'Not Achieved'] }, 1, 0] }
                },
                avgOutcomeScore: { $avg: '$review.outcomeScore' }
              }
            }
          ],
          categories: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ];

    const result = await Decision.aggregate(statsPipeline);
    const metrics = result[0].metrics[0] || {
      totalDecisions: 0,
      avgConfidence: 0,
      reviewedCount: 0,
      pendingCount: 0,
      dueCount: 0,
      achievedCount: 0,
      partiallyAchievedCount: 0,
      notAchievedCount: 0,
      avgOutcomeScore: 0
    };

    // Calculate empirical success rate
    const reviewed = metrics.reviewedCount || 0;
    const achieved = metrics.achievedCount || 0;
    const successRate = reviewed > 0 ? Math.round((achieved / reviewed) * 100) : 0;
    const avgConfidence = metrics.avgConfidence ? Math.round(metrics.avgConfidence) : 0;
    const calibrationGap = reviewed > 0 ? avgConfidence - successRate : 0;

    // Upcoming reviews in the next 7 days
    const upcomingReviews = await Decision.find({
      userId,
      isArchived: false,
      'review.result': null,
      reviewDate: { $gte: now, $lte: oneWeekFromNow }
    })
      .select('title category reviewDate confidence')
      .sort({ reviewDate: 1 })
      .limit(5);

    // Overdue reviews needing attention
    const overdueReviews = await Decision.find({
      userId,
      isArchived: false,
      'review.result': null,
      reviewDate: { $lt: now }
    })
      .select('title category reviewDate confidence')
      .sort({ reviewDate: 1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalDecisions: metrics.totalDecisions || 0,
        reviewedCount: metrics.reviewedCount || 0,
        pendingCount: metrics.pendingCount || 0,
        dueCount: metrics.dueCount || 0,
        achievedCount: metrics.achievedCount || 0,
        partiallyAchievedCount: metrics.partiallyAchievedCount || 0,
        notAchievedCount: metrics.notAchievedCount || 0,
        avgConfidence,
        avgOutcomeScore: metrics.avgOutcomeScore ? Math.round(metrics.avgOutcomeScore * 10) / 10 : 0,
        successRate,
        calibrationGap,
        categories: result[0].categories || [],
        upcomingReviews,
        overdueReviews
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get calibration analysis binned by confidence ranges
 * @route   GET /api/analytics/confidence
 * @access  Private (Protected)
 */
const getConfidenceAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          'review.result': { $ne: null }
        }
      },
      {
        $project: {
          confidence: 1,
          result: '$review.result',
          range: {
            $switch: {
              branches: [
                { case: { $gte: ['$confidence', 90] }, then: '90–100%' },
                { case: { $gte: ['$confidence', 80] }, then: '80–89%' },
                { case: { $gte: ['$confidence', 70] }, then: '70–79%' },
                { case: { $gte: ['$confidence', 60] }, then: '60–69%' }
              ],
              default: 'Below 60%'
            }
          }
        }
      },
      {
        $group: {
          _id: '$range',
          total: { $sum: 1 },
          achieved: {
            $sum: { $cond: [{ $eq: ['$result', 'Achieved'] }, 1, 0] }
          }
        }
      }
    ];

    const ranges = await Decision.aggregate(pipeline);
    const rangeOrder = ['90–100%', '80–89%', '70–79%', '60–69%', 'Below 60%'];

    const formatted = rangeOrder.map((rangeLabel) => {
      const found = ranges.find((r) => r._id === rangeLabel);
      if (!found) {
        return { range: rangeLabel, total: 0, achieved: 0, successRate: null };
      }
      return {
        range: rangeLabel,
        total: found.total,
        achieved: found.achieved,
        successRate: Math.round((found.achieved / found.total) * 100)
      };
    });

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverviewStats,
  getConfidenceAnalytics
};
