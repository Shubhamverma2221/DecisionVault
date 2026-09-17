const mongoose = require('mongoose');

// =========================================
// 1. Embedded Review Subdocument Schema
// =========================================
const reviewSchema = new mongoose.Schema(
  {
    actualOutcome: {
      type: String,
      required: [true, 'Actual outcome description is required for review'],
      trim: true,
      minlength: [5, 'Actual outcome description must be at least 5 characters']
    },
    result: {
      type: String,
      required: [true, 'Result evaluation is required'],
      enum: {
        values: ['Achieved', 'Partially Achieved', 'Not Achieved'],
        message: '{VALUE} is not a valid result evaluation. Must be Achieved, Partially Achieved, or Not Achieved.'
      }
    },
    outcomeScore: {
      type: Number,
      min: [1, 'Outcome score must be at least 1/10'],
      max: [10, 'Outcome score cannot exceed 10/10'],
      default: null
    },
    lessonLearned: {
      type: String,
      required: [true, 'Lesson learned is required for review'],
      trim: true,
      minlength: [5, 'Lesson learned must be at least 5 characters']
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

// =========================================
// 2. Decision Criteria Subdocument Schema
// =========================================
const criterionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Criterion name is required'],
      trim: true
    },
    weight: {
      type: Number,
      required: [true, 'Criterion weight is required'],
      min: [1, 'Weight must be at least 1%'],
      max: [100, 'Weight cannot exceed 100%']
    },
    scores: [
      {
        option: { type: String, required: true },
        score: { type: Number, required: true, min: 1, max: 10 }
      }
    ]
  },
  {
    _id: false
  }
);

// =========================================
// 3. Audit History Subdocument Schema
// =========================================
const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true
    },
    details: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

// =========================================
// 4. Primary Decision Schema
// =========================================
const decisionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Decision must belong to a registered or guest user'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Decision title is required'],
      trim: true,
      maxlength: [150, 'Decision title cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Technology', 'Career', 'Finance', 'Education', 'Projects', 'Personal', 'Health', 'Other'],
        message: '{VALUE} is not a supported category'
      },
      default: 'Technology'
    },
    tags: {
      type: [String],
      default: []
    },
    options: {
      type: [String],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 2;
        },
        message: 'A decision requires considering at least 2 alternative options.'
      },
      required: [true, 'Options considered are required']
    },
    selectedOption: {
      type: String,
      required: [true, 'A chosen option must be selected'],
      trim: true,
      validate: {
        validator: function (val) {
          return this.options && this.options.includes(val);
        },
        message: 'Selected option "{VALUE}" must be one of the considered options.'
      }
    },
    reasoning: {
      type: String,
      required: [true, 'Reasoning is required to document why this choice was made'],
      trim: true,
      minlength: [10, 'Reasoning must be at least 10 characters long to provide meaningful context']
    },
    confidence: {
      type: Number,
      required: [true, 'Confidence level is required'],
      min: [0, 'Confidence cannot be less than 0%'],
      max: [100, 'Confidence cannot exceed 100%']
    },
    expectedOutcome: {
      type: String,
      required: [true, 'Expected outcome is required to benchmark the hypothesis'],
      trim: true,
      minlength: [5, 'Expected outcome must be at least 5 characters long']
    },
    reviewDate: {
      type: Date,
      required: [true, 'Target review date is required']
    },
    criteria: {
      type: [criterionSchema],
      default: []
    },
    calculatedScores: [
      {
        option: { type: String },
        totalScore: { type: Number }
      }
    ],
    isFavorite: {
      type: Boolean,
      default: false,
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    review: {
      type: reviewSchema,
      default: null
    },
    auditHistory: {
      type: [auditEntrySchema],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Dynamic lifecycle virtual getter for Status
decisionSchema.virtual('status').get(function () {
  if (this.isArchived) {
    return 'Archived';
  }
  if (this.review && this.review.result) {
    return 'Reviewed';
  }
  const now = new Date();
  if (now >= this.reviewDate) {
    return 'Review Due';
  }
  return 'Pending Review';
});

// Compound Indexes for User Scoping and High Performance Queries
decisionSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
decisionSchema.index({ userId: 1, reviewDate: 1 });
decisionSchema.index({ userId: 1, isFavorite: 1 });
decisionSchema.index({ userId: 1, category: 1 });
decisionSchema.index({ userId: 1, tags: 1 });

module.exports = mongoose.model('Decision', decisionSchema);
