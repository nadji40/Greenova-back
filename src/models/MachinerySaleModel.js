const mongoose = require('mongoose');

const machinerySaleSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  machine_name: {
    type: String,
    required: true
  },
  machine_des: {
    type: String,
    required: true
  },
  machine_type: {
    type: String,
    required: true
  },
  condition: {
    type: String,
    enum: ['New', 'Used', 'Refurbished'],
    required: true
  },
  brand: String,
  model: String,
  model_year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear()
  },
  fixed_price: {
    type: Boolean,
    default: false
  },
  negotiable_price: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'DZD'
  },
  location_country: {
    type: String,
    required: true
  },
  machine_images: [
    {
      type: String,
      required: true
    }
  ],
  location_city: String,
  FuelType: String,
  power: {
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: "Watt",
      required: true
    }
  },
  dimensions: String,
  productionCapacity: {
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: "tons/hour",
      required: true
    }
  },
  weight: {
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: "kg",
      required: true
    }
  },
  availability: {
    type: String,
    enum: ['In Stock', 'Out of Stock', 'Available on Order'],
    default: 'In Stock'
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
  financingOptions: {
    type: String,
    enum: ["Bank Loans", "Leasing", "Supplier Credit", "Self-Financing", "Government Subsidies", "Investment Funds", "Islamic Financing", "Export Credit Agencies", "Commercial Credit Lines", "Crowdfunding", "Equipment Financing Programs", "Private Investors", "Joint Ventures", "Trade Agreements with Deferred Payment Options", "Factoring Services"]
  },
  after_sales_service: {
    type: Boolean,
  },
  accessories_included: {
    type: Boolean,
    default: false
  },
  spare_parts_available: {
    type: Boolean,
  },
  ratings: {
    type: Number,
    min: 0,
    max: 5,
    default: 0

  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
}, { timestamps: true });

module.exports = mongoose.model('MachinerySale', machinerySaleSchema);
