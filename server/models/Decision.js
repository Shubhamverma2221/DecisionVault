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
    _id: false // Embedded subdocuments do not need their own primary key
  }
);

// =========================================
// 2. Primary Decision Schema
// =========================================
const decisionSchema = new mongoose.Schema(
  {
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
        values: ['Technology', 'Career', 'Finance', 'Life', 'Product', 'Health', 'Other'],
        message: '{VALUE} is not a supported category'
      },
      default: 'Technology'
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
          // Verify that chosen option exists inside the options array
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
    tags: {
      type: [String],
      default: []
    },
    review: {
      type: reviewSchema,
      default: null
    }
  },
  {
    timestamps: true, // Automatically injects and updates createdAt and updatedAt
    toJSON: { virtuals: true }, // Ensure virtual properties (like status) are serialized to JSON
    toObject: { virtuals: true }
  }
);

// =========================================
// 3. Virtual Field: Dynamic Decision Lifecycle Status
// =========================================
// Status is dynamically computed based on current time and review presence.
// Eliminates brittle manual status updates in the database.
decisionSchema.virtual('status').get(function () {
  if (this.review && this.review.result) {
    return 'Reviewed';
  }
  const now = new Date();
  if (now >= new Date(this.reviewDate)) {
    return 'Review Due';
  }
  return 'Pending Review';
});

// =========================================
// 4. Performance Indexes
// =========================================
decisionSchema.index({ reviewDate: 1 });
decisionSchema.index({ createdAt: -1 });
decisionSchema.index({ category: 1 });

// =========================================
// 5. Compile Model
// =========================================
const Decision = mongoose.model('Decision', decisionSchema);

module.exports = Decision;
