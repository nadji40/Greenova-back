const mongoose = require('mongoose')

const rawMateriaLSchema = new mongoose.Schema({
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    materialCategory: {
        type: String,
        required: true
    },
    materialSubCategory: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    Shapes: {
        type: String,
    },
    industrialStandards: {
        type: String,
        required: true,
        enum: ["ISO", "ASTM"]
    },
    purityLevel: {
        type: Number,
        required: true
    },
    dimensions: {
        type: String,
    },
    quantity: {
        amount: {
            type: String,
            required: true
        },
        unit: {
            type: String,
            required: true,

        }
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
        amount: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            required: true
        }
    },
    currency: {
        type: String,
        required: true,
        default: 'DZD'
    },
    material_images: [
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
        enum: ['In Stock', 'Available on Order'],
        default: 'In Stock'
    },
    ratings: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    bulkDiscountsAvailable: {
        type: Boolean,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved'
    },
}, { timestamps: true }
)

module.exports = mongoose.model('RawMaterial', rawMateriaLSchema)
