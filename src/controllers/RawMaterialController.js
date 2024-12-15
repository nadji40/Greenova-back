const RawMaterial = require('../models/rawMaterialModel');
const uploadOnCloudinary = require('../utils/cloudinary');
const Business = require('../models/BusinessModel')
const DynamicField = require("../models/DynamicFieldsModel")
const mongoose = require('mongoose');

exports.createRawMaterial = async (req, res) => {
    try {
        const { files, body } = req;
        if (req.user.userType !== "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this."
            });
        }

        const supplierFound = await Business.findOne({ user: req.user.userId });
        if (!supplierFound) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        const rawMaterial = new RawMaterial({
            ...body,
            supplier: supplierFound._id
        });

        if (files && files.length > 0) {
            const imageUrls = await Promise.all(
                files.map(async (file) => {
                    const uploadResult = await uploadOnCloudinary(file.buffer);
                    return uploadResult.url;
                })
            );
            rawMaterial.material_images = imageUrls;
        }

        // Handle dynamic fields for spare parts
        let dynamicField = await DynamicField.findOne();
        if (!dynamicField) {
            dynamicField = await DynamicField.create({
                rawMaterialCategories: []
            });
        }

        // Default categories and subcategories
        const defaultCategories = [
            {
                category: "Metal",
                subCategories: ["Steel", "Aluminum", "Copper", "Brass", "Titanium"],
            },
            {
                category: "Plastic",
                subCategories: ["Polyethylene", "Polycarbonate", "PVC", "Acrylic", "Nylon"],
            },
            {
                category: "Wood",
                subCategories: ["Pine", "Oak", "Maple", "Birch", "Walnut"],
            },
            {
                category: "Chemicals",
                subCategories: ["Acids", "Bases", "Solvents", "Polymers", "Catalysts"],
            },
        ];

        defaultCategories.forEach((defaultCategory) => {
            let existingCategory = dynamicField.rawMaterialCategories.find(
                (item) => item.category === defaultCategory.category
            );

            if (!existingCategory) {
                dynamicField.rawMaterialCategories.push(defaultCategory);
            } else {
                defaultCategory.subCategories.forEach((subCategory) => {
                    if (!existingCategory.subCategories.includes(subCategory)) {
                        existingCategory.subCategories.push(subCategory);
                    }
                });
            }
        });

        // Check if the category exists
        let categoryEntry = dynamicField.rawMaterialCategories.find(
            (item) => item.category === rawMaterial.materialCategory
        );

        if (!categoryEntry) {
            dynamicField.rawMaterialCategories.push({
                category: rawMaterial.materialCategory,
                subCategories: [rawMaterial.materialSubCategory],
            });
        } else {
            // Add subcategory if it does not exist
            if (!categoryEntry.subCategories.includes(rawMaterial.materialSubCategory)) {
                categoryEntry.subCategories.push(rawMaterial.materialSubCategory);
            }
        }

        // Save the updated dynamic fields
        await dynamicField.save();

        const savedRawMaterial = await rawMaterial.save();

        supplierFound.rawMaterial.push(rawMaterial._id);
        await supplierFound.save();

        res.status(201).json({
            success: true,
            data: savedRawMaterial,
            message: "Raw Material registered successfully."
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error
        });
    }
};

exports.getAllRawMaterials = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Initialize the aggregation pipeline
        const pipeline = [];

        // Match filters
        const matchFilters = {};

        // PartType filter (multiple categories)
        if (req.query.category) {
            const categories = req.query.category.split(',').map(cat => cat.trim());
            matchFilters.materialCategory = { $in: categories }; 
        }
        if (req.query.subCategory) {
            const subCategories = req.query.subCategory.split(',').map(subCat => subCat.trim());
            matchFilters.materialSubCategory = { $in: subCategories };  // Match any of the selected subcategories
        }

        // Location filters (Country and City)
        if (req.query.locationCountry) {
            matchFilters.locationCountry = req.query.locationCountry;
        }
        if (req.query.locationCity) {
            matchFilters.locationCity = req.query.locationCity;
        }

        // Availability filter
        if (req.query.availability) {
            matchFilters.availability = req.query.availability;
        }

        // Price Range filter
        if (req.query.minPrice || req.query.maxPrice) {
            matchFilters.price = {};
            if (req.query.minPrice) matchFilters.price.$gte = parseInt(req.query.minPrice);
            if (req.query.maxPrice) matchFilters.price.$lte = parseInt(req.query.maxPrice);
        }

        // Price Type filter (Fixed or Negotiable)
        if (req.query.priceType) {
            if (req.query.priceType === 'fixed') {
                matchFilters.fixedPrice = true;
                matchFilters.negotiablePrice = false;
            } else if (req.query.priceType === 'negotiable') {
                matchFilters.fixedPrice = false;
                matchFilters.negotiablePrice = true;
            } else {
                // If the priceType is neither 'fixed' nor 'negotiable', return an empty result
                matchFilters.price = { $lt: 0 }; // This ensures no results will match the invalid priceType
            }
        }

        // Bulk discount filter
        if (req.query.bulkDiscountsAvailable !== undefined) {
            const bulkDiscount = req.query.bulkDiscountsAvailable === 'true'; // Convert string to boolean
            matchFilters.bulkDiscountsAvailable = bulkDiscount; // Add filter for bulk discount availability
        }

        // Supplier Minimum Rating filter (added)
        if (req.query.supplierMinRating) {
            const minRating = parseFloat(req.query.supplierMinRating);
            if (!isNaN(minRating) && minRating >= 0 && minRating <= 5) {
                matchFilters.ratings = { $gte: minRating }; // Add supplier rating filter
            }
        }

        // Add match stage to aggregation pipeline if any filters are provided
        if (Object.keys(matchFilters).length > 0) {
            pipeline.push({ $match: matchFilters });
        }

        // Pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        // Sorting by createdAt (desc)
        pipeline.push({ $sort: { createdAt: -1 } });

        // Lookup for supplier details (populate)
        pipeline.push({
            $lookup: {
                from: 'businesses', // The collection name for Business
                localField: 'supplier', // Reference to supplier (ObjectId)
                foreignField: '_id', // Foreign field in the Business collection
                as: 'supplierDetails' // Alias for the result
            }
        });

        // Match suppliers' rating based on the supplierMinRating filter
        if (req.query.supplierMinRating) {
            pipeline.push({
                $match: {
                    'supplierDetails.ratings': { $gte: parseFloat(req.query.supplierMinRating) }
                }
            });
        }

        // Project to clean up the output (optional)
        pipeline.push({
            $project: {
                supplier: { $arrayElemAt: ['$supplierDetails', 0] }, // Get only the first element of the array (since $lookup returns an array)
                materialCategory: 1,
                materialSubCategory: 1,
                description: 1,
                price: 1,
                currency: 1,
                material_images: 1,
                locationCountry: 1,
                locationCity: 1,
                availability: 1,
                ratings: 1,
                bulkDiscountsAvailable: 1,
                status: 1,
                createdAt: 1
            }
        });

        // Execute the aggregation
        const rawMaterial = await RawMaterial.aggregate(pipeline);

        // Get the total count of matching documents (without pagination)
        const total = await RawMaterial.countDocuments(matchFilters);

        res.status(200).json({
            success: true,
            data: rawMaterial,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error(error); // Log error for debugging
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

exports.getRawMaterial = async (req, res) => {
    try {
        const rawMaterial = await RawMaterial.findById(req.params.id)
            .populate('supplier');

        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                error: 'Raw Material not found'
            });
        }

        res.status(200).json({
            success: true,
            data: rawMaterial
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error
        });
    }
};

exports.updateRawMaterial = async (req, res) => {
    try {
        const rawMaterial = await RawMaterial.findById(req.params.id);
        if (!rawMaterial) {
            return res.status(404).json({ success: false, message: 'Raw Material not found' });
        }
        const updates = { ...req.body };
        if (req.files && req.files.length > 0) {
            const imageUrls = await Promise.all(
                req.files.map(async (file) => {
                    const uploadResult = await uploadOnCloudinary(file.buffer);
                    return uploadResult.url;
                })
            );
            updates.material_images = imageUrls;
        }

        const updatedRawMaterial = await RawMaterial.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: updatedRawMaterial, message: "Raw Material updated successfully" });
    } catch (error) {
        res.status(400).json({ success: false, message: error });
    }
};

exports.deleteRawMaterial = async (req, res) => {
    try {
        if (req.user.userType !== "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this."
            });
        }
        const rawMaterial = await RawMaterial.findById(req.params.id);
        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                error: 'Raw Material not found'
            });
        }

        await RawMaterial.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            data: {},
            message: "Raw Material deleted successfully"
        });
    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

exports.getRawMaterialBySupplier = async (req, res) => {
    try {
        if (req.user.userType != "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this"
            })
        }

        const supplier = await Business.findOne({ user: req.user.userId })
        if (!supplier) {
            return res.status(404).json({
                success: false,
                error: "supplier not found"
            });
        }

        console.log('supplier ID:', supplier._id);
        const rawMaterial = await RawMaterial.find({
            supplier: supplier._id
        })
        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                message: "No Raw Material Found"
            })
        }
        return res.status(200).json({
            success: true,
            data: rawMaterial
        })

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error
        });
    }
}