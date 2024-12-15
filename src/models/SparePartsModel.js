const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  partCategory: {
    type: String,
    required: true
  },
  subCategory: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  compatibleBrands: [{
    type: String,
    required: true
  }],
  compatibleModels: [{
    type: String,
    required: true
  }],
  condition: {
    type: String,
    enum: ['New', 'Used', 'Refurbished'],
    required: true
  },
  fixedPrice: {
    type: Boolean,
    default: true
  },
  negotiablePrice: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'DZD'
  },
  spareParts_images: [
    {
      type: String,
      required: true
    }
  ],
  locationCountry: {
    type: String,
    required: true
  },
  locationCity: {
    type: String,
    required: true
  },
  availability: {
    type: String,
    enum: ['In Stock', 'Out of Stock', 'Available on Order'],
    default: 'In Stock'
  },
  ratings: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  warranty: {
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: "years",
      required: true
    }
  },
  bulkDiscountsAvailable: {
    type: Boolean,
    required: true
  },
  bulkDiscounts: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('SparePart', sparePartSchema); 