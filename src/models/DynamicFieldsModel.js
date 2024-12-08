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
    },
    { timestamps: true }
);

module.exports = mongoose.model("DynamicField", dynamicFieldSchema);
