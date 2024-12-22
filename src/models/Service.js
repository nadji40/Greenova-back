const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  pricing: {
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true
    }
  },
  pricingType: {
    type: String,
    enum: ["Fixed Price", "Hourly Rate", "Project Based"]
  },
  workingHours: {
    days: {
      type: String
    },
    time: {
      type: String
    }
  },
  images: [String],
  ratings: {
    type: Number,
    min: 0,
    max: 5
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      comment: {
        type: String
      }
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  }
}, { timestamps: true });

// Define Indexes
serviceSchema.index({ location: '2dsphere' });
serviceSchema.index({ category: 1 });
serviceSchema.index({ 'pricing.amount': 1 });
serviceSchema.index({ ratings: -1 });
serviceSchema.index({ createdAt: -1 });
serviceSchema.index({ category: 1, 'pricing.amount': 1 });
serviceSchema.index({ category: 1, ratings: -1 });

module.exports = mongoose.model('Service', serviceSchema);
