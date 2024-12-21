const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  services: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    }
  ],
  machines: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MachinerySale'
    }
  ],
  spareParts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SparePart'
    }
  ],
  rawMaterial: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawMaterial'
    }
  ],
  businessName: String,
  businessType: {
    type: String,
    enum: ["SARL", "EURL", "SPA", "SNC", "SCS", "GIE", "Independent Contractor", "Auto - Entrepreneurs", "Freelancers", "Cooperatives", "EPIC", "Public Establishments"]
  },
  years_of_experience: {
    type: Number,
    required: true
  },
  expertise_level: {
    type: String,
  },
  description: String,
  logo: {
    type: String,
    required: true
  },
  banner: {
    type: String,
    required: true
  },
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number]
  },
  contact_info: {
    phoneNumbers: [
      {
        type: String,
        required: true
      },
    ],
    website: {
      type: String,
    },
    businessEmail: {
      type: String,
    },
    facebook: {
      type: String,
    },
    instagram: {
      type: String,
    },
    linkedin: {
      type: String,
    },
    youtube: {
      type: String,
    },
  },
  certifications: [
    {
      type: String,
    }
  ],
  workingHours: String,
  subscriptionPlan: {
    type: String,
    enum: ["Basic", "Premium", "Advance"],
    default: "Basic"
  },
  ratings: {
    type: Number,
    min: 0,
    max: 5,
    default: 1
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      ratings: {
        type: Number,
        min: 0,
        max: 5
      },
      comment: {
        type: String
      }
    }
  ],
  noOfOrders: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Define Indexes
businessSchema.index({ location: '2dsphere' });
businessSchema.index({ years_of_experience: 1 });
businessSchema.index({ certifications: 1 });
businessSchema.index({ businessType: 1 });
businessSchema.index({ businessType: 1, years_of_experience: 1 });
businessSchema.index({ certifications: 1, businessType: 1 });
businessSchema.index({ 'contact_info.businessEmail': 1 }, {
  unique:
    true
});
businessSchema.index({
  businessName: 'text',
  businessType: 'text',
  description: 'text',
  'services.title': 'text',
  'services.description': 'text',
  'services.category': 'text'
});

module.exports = mongoose.model('Business', businessSchema);
