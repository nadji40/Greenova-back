const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema({
  partType: {
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
    enum: ['new', 'used', 'refurbished'],
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
  minPrice: {
    type: Number,
    required: true
  },
  maxPrice: {
    type: Number
  },
  currency: {
    type: String,
    required: true,
    default: 'DZD'
  },
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
    enum: ['in_stock', 'out_of_stock', 'available_on_order'],
    default: 'in_stock'
  },
  verifiedSupplier: {
    type: Boolean,
    default: false
  },
  supplierRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  warranty: {
    type: String
  },
  bulkDiscount: {
    type: Boolean,
    default: false
  },
  minOrderQuantity: {
    type: Number,
    default: 1
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SparePart', sparePartSchema); 