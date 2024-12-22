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
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    form: {
        type: String,
        required: true,
        enum: ["Tubes", "Bars", "Sheets", "Plates", "Wires", "Coils", "Pellets", "Granules", "Rods", "Films", "Foams", "Logs", "Planks", "Boards", "Veneers", "Chips", "Sawdust", "Powders", "Fabrics", "Yarns", "Threads", "Liquids", "Ores", "Aggregates", "Bricks", "Blocks", "Cement","Concrete"]
    },
    volume: {
        amount: {
            type: Number,
            required: true
        },
        unit: {
            type: String,
            required: true,
        }
    },
    industrialStandards: {
        type: String,
        required: true,
    },
    purityLevel: {
        type: Number,
        required: true
    },
    quantity: {
        amount: {
            type: Number,
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
    },
    
    bulkDiscountsAvailable: {
        type: Boolean,
        required: true
    },
    bulkDiscounts: {
        type: String,
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
}, { timestamps: true }
)

module.exports = mongoose.model('RawMaterial', rawMateriaLSchema)
