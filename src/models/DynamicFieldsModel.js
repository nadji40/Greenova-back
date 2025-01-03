const mongoose = require("mongoose");

const sparePartCategorySchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
    },
    subCategories: {
        type: [String],
        default: [],
    },
    compatibleBrands: {
        type: [String],
        default: []
    },
    compatibleModels: {
        type: [String],
        default: []
    }
});

const dynamicFieldSchema = new mongoose.Schema(
    {
        serviceCategories: [
            {
                type: String,
                default: ["Maintenance", "Consulting", "Automation", "Installation", "Inspection", "Repair", "Training"], // Predefined categories
            },
        ],
        certifications: [
            {
                type: String,
                default: [
                    "ISO Certification",
                    "Safety Certifications",
                    "Quality Assurance Certifications",
                ], // Default certifications
            },
        ],
        machine_types: [
            {
                type: String,
                default: [
                    "Industrial",
                ],
            },
        ],
        machine_brands: [
            {
                type: String,
                default: [
                    "Volvo", "Caterpillar", "John Deere", "Komatsu", "Komatsu"
                ],
            },
        ],
        machine_models: [
            {
                type: String
            }
        ],
        sparePartCategories: {
            type: [sparePartCategorySchema],
            default: [
                {
                    category: "Engine",
                    subCategories: ["Pistons", "Crankshafts", "Valves", "Camshafts"],
                    compatibleBrands: ["Caterpillar"],
                    compatibleModels: ["Caterpillar 320"],
                },
                {
                    category: "Bearings",
                    subCategories: ["Ball Bearings", "Roller Bearings", "Thrust Bearings"],
                    compatibleBrands: ["Hyundai"],
                    compatibleModels: ["Hyundai HL770"],
                },
                {
                    category: "Belts",
                    subCategories: ["Timing Belts", "Serpentine Belts", "V-Belts"],
                    compatibleBrands: ["Massey Ferguson"],
                    compatibleModels: ["Massey Ferguson 260"],
                },
                {
                    category: "Filters",
                    subCategories: ["Oil Filters", "Air Filters", "Fuel Filters"],
                    compatibleBrands: ["John Deere"],
                    compatibleModels: ["John Deere 5055E"],
                },
                {
                    category: "Electronics Components",
                    subCategories: ["Sensors", "Control Modules", "Alternators", "Starters"],
                },
            ],
        },
        rawMaterialCategory: [
            {
                type: String,
                default: ["Metal", "Plastic", "Wood", "Chemicals"], // Predefined categories
            },
        ],
        // rawMaterialIndustrialStandards: [
        //     {
        //         type: String,
        //         default: ["ISO 9001", "ASTM"], // Predefined categories
        //     },
        // ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("DynamicField", dynamicFieldSchema);
