const mongoose = require("mongoose");

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
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model("DynamicField", dynamicFieldSchema);
