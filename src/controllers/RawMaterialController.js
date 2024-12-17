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

        // add dynamic fields to dynamic models
        let dynamicField = await DynamicField.findOne();
        if (!dynamicField) {
            // If DynamicField doesn't exist, create it with default certifications
            dynamicField = await DynamicField.create({
                rawMaterialCategory: [
                    "Metal", "Plastic", "Wood", "Chemicals",
                ],

            });
        }
        // default machinetpes 
        const defaultrawMaterialCategories = ["Metal", "Plastic", "Wood", "Chemicals"];
        defaultrawMaterialCategories.forEach((defaultrawMaterialCategory) => {
            if (!dynamicField.rawMaterialCategory.includes(defaultrawMaterialCategory)) {
                dynamicField.rawMaterialCategory.push(defaultrawMaterialCategory);
            }
        });

        // Add new machinetypes to DynamicField if they do not exist already
        if (!dynamicField.rawMaterialCategory.includes(rawMaterial.materialCategory)) {
            // If not, add the new category
            dynamicField.rawMaterialCategory.push(rawMaterial.materialCategory);
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
        // Parsing pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Initialize the aggregation pipeline
        const pipeline = [];

        // Initialize match filters
        const matchFilters = {};

        // 1. Material Type Filter (materialType corresponds to materialCategory in schema)
        if (req.query.materialType) {
            const materialTypes = Array.isArray(req.query.materialType)
                ? req.query.materialType
                : req.query.materialType.split(',').map(mt => mt.trim());
            matchFilters.materialCategory = { $in: materialTypes };
        }

        // 2. Form Filter
        if (req.query.form) {
            const materialTypes = Array.isArray(req.query.form)
                ? req.query.form
                : req.query.form.split(',').map(mt => mt.trim());
            matchFilters.form = { $in: materialTypes };
        }

        // 3. Availability Filter
        if (req.query.availability) {
            matchFilters.availability = req.query.availability;
        }
        // if (req.query.availability) {
        //     const availabilities = Array.isArray(req.query.availability)
        //         ? req.query.availability
        //         : Object.keys(req.query.availability).filter(key => req.query.availability[key]);
        //     matchFilters.availability = { $in: availabilities };
        // }

        // 4. Bulk Discounts Available Filter
        if (req.query.bulkDiscountsAvailable !== undefined) {
            const bulkDiscountAvailable = req.query.bulkDiscountsAvailable === 'true';
            matchFilters.bulkDiscountsAvailable = bulkDiscountAvailable;
        }

        // 5. Price Type Filter (Fixed, Negotiable)
        if (req.query.pricingType) {
            if (req.query.pricingType.toLowerCase() === 'fixed') {
                matchFilters.fixedPrice = true;
                matchFilters.negotiablePrice = false;
            } else if (req.query.pricingType.toLowerCase() === 'negotiable') {
                matchFilters.fixedPrice = false;
                matchFilters.negotiablePrice = true;
            }
            // If needed, handle multiple pricing types by using $in
            // else {
            //     const pricingTypes = Array.isArray(req.query.pricingType)
            //         ? req.query.pricingType
            //         : req.query.pricingType.split(',').map(pt => pt.trim());
            //     const priceConditions = [];
            //     pricingTypes.forEach(type => {
            //         if (type.toLowerCase() === 'fixed') {
            //             priceConditions.push({ fixedPrice: true, negotiablePrice: false });
            //         } else if (type.toLowerCase() === 'negotiable') {
            //             priceConditions.push({ fixedPrice: false, negotiablePrice: true });
            //         }
            //     });
            //     if (priceConditions.length > 0) {
            //         matchFilters.$or = priceConditions;
            //     }
            // }
        }

        // 6. Price Range Filter
        if (req.query.minPrice || req.query.maxPrice) {
            matchFilters['price.amount'] = {};
            if (req.query.minPrice) {
                matchFilters['price.amount'].$gte = parseFloat(req.query.minPrice);
            }
            if (req.query.maxPrice) {
                matchFilters['price.amount'].$lte = parseFloat(req.query.maxPrice);
            }
        }

        // 7. Volume Range Filter
        const minVolume = req.query.volumeMin ? parseFloat(req.query.volumeMin) : null;
        const maxVolume = req.query.volumeMax ? parseFloat(req.query.volumeMax) : null;

        if (minVolume !== null || maxVolume !== null) {
            matchFilters['volume.amount'] = {};
            if (minVolume !== null) {
                matchFilters['volume.amount'].$gte = minVolume;
            }
            if (maxVolume !== null) {
                matchFilters['volume.amount'].$lte = maxVolume;
            }
        }


        // 8. Location Filters (Country and City)
        if (req.query.locationCountry) {
            matchFilters.locationCountry = req.query.locationCountry;
        }
        if (req.query.locationCity) {
            matchFilters.locationCity = req.query.locationCity;
        }

        // 9. Bulk Purchase Filter (Bulk Quantity)
        if (req.query.quantityoptions) {
            const quantityOptions = Array.isArray(req.query.quantityoptions)
                ? req.query.quantityoptions
                : Object.keys(req.query.quantityoptions).filter(key => req.query.quantityoptions[key]);
            // Assuming 'Bulk Quantity' corresponds to a specific condition
            // Adjust the condition based on your schema and requirements
            if (quantityOptions.includes('Bulk Quantity')) {
                // Example: quantity.amount >= a certain value
                matchFilters['quantity.amount'] = { $gte: 6000 }; // Adjust the value as needed
            }
        }

        // Add the match stage to the pipeline if any filters are set
        if (Object.keys(matchFilters).length > 0) {
            pipeline.push({ $match: matchFilters });
        }

        // 10. Lookup for supplier details (populate)
        pipeline.push({
            $lookup: {
                from: 'businesses', // The collection name for Business
                localField: 'supplier', // Reference to supplier (ObjectId)
                foreignField: '_id', // Foreign field in the Business collection
                as: 'supplierDetails' // Alias for the result
            }
        });

        // 11. Unwind the supplierDetails array for easier filtering
        pipeline.push({ $unwind: '$supplierDetails' });

        // 12. Supplier Rating Filter
        if (req.query.supplierMinRating) {
            pipeline.push({
                $match: {
                    'supplierDetails.ratings': { $gte: parseFloat(req.query.supplierMinRating) }
                }
            });
        }

        // 13. Supplier Reviews Filter
        if (req.query.minReviews) {
            const minReviews = parseInt(req.query.minReviews);
            if (!isNaN(minReviews)) {
              pipeline.push({
                $match: {
                  $expr: {
                    $gte: [{ $size: '$supplierDetails.reviews' }, minReviews]
                  }
                }
              });
            }
          }

        // 14. Sorting by createdAt (desc)
        pipeline.push({ $sort: { createdAt: -1 } });

        // 15. Pagination
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        // 16. Project to clean up the output
        pipeline.push({
            $project: {
                supplier: {
                    _id: '$supplierDetails._id',
                    name: '$supplierDetails.name',
                    ratings: '$supplierDetails.ratings',
                    reviews: '$supplierDetails.reviews',
                    // Add other supplier fields as needed
                },
                materialCategory: 1,
                name: 1,
                description: 1,
                Form: 1,
                volume: 1,
                industrialStandards: 1,
                purityLevel: 1,
                quantity: 1,
                fixedPrice: 1,
                negotiablePrice: 1,
                price: 1,
                currency: 1,
                material_images: 1,
                locationCountry: 1,
                locationCity: 1,
                availability: 1,
                ratings: 1,
                bulkDiscountsAvailable: 1,
                bulkDiscounts: 1,
                status: 1,
                createdAt: 1
            }
        });

        // Execute the aggregation pipeline
        const [rawMaterials, total] = await Promise.all([
            RawMaterial.aggregate(pipeline),
            RawMaterial.aggregate([
                { $match: matchFilters },
                {
                    $lookup: {
                        from: 'businesses',
                        localField: 'supplier',
                        foreignField: '_id',
                        as: 'supplierDetails'
                    }
                },
                { $unwind: '$supplierDetails' },
                // Apply supplier filters if any
                ...(req.query.supplierRating
                    ? [
                        {
                            $match: {
                                'supplierDetails.ratings': { $gte: parseFloat(req.query.supplierRating) }
                            }
                        }
                    ]
                    : []),
                ...(req.query.supplierReviews
                    ? [
                        {
                            $match: {
                                'supplierDetails.reviews': { $gte: parseInt(req.query.supplierReviews) }
                            }
                        }
                    ]
                    : []),
                { $count: 'total' }
            ])
        ]);

        const totalCount = total[0] ? total[0].total : 0;

        res.status(200).json({
            success: true,
            data: rawMaterials,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
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
        const business = await Business.findOne({ user: req.user.userId })
        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }
        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                error: 'Raw Material not found'
            });
        }

        // Check if the machinery is associated with the business
        const isMaterialAssociated = business.rawMaterial.includes(req.params.id);

        if (!isMaterialAssociated) {
            return res.status(400).json({
                success: false,
                message: 'Material is not associated with this business.'
            });
        }

        // Remove the machinery ID from the business's machineries array
        business.rawMaterial = business.rawMaterial.filter(
            (id) => id.toString() !== req.params.id
        );
        await business.save();
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