const MachinerySale = require('../models/MachinerySaleModel');
const uploadOnCloudinary = require('../utils/cloudinary');
const Business = require('../models/BusinessModel');
const DynamicField = require('../models/DynamicFieldsModel')

// Create machinery
const createMachinery = async (req, res) => {
    try {
        const { files, body } = req;

        if (req.user.userType != "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this"
            })
        }
        const businessFound = await Business.findOne({ user: req.user.userId })
        if (!businessFound) {
            return res.status(404).json({
                success: false,
                message: "Business Not found"
            });
        }
        const machinery = new MachinerySale({
            ...body,
            business: businessFound._id
        });
        if (files && files.length > 0) {
            const imageUrls = await Promise.all(
                files.map(async (file) => {
                    const uploadResult = await uploadOnCloudinary(file.buffer);
                    return uploadResult.url;
                })
            );
            machinery.machine_images = imageUrls;
        }

        // add dynamic fields to dynamic models
        let dynamicField = await DynamicField.findOne();
        if (!dynamicField) {
            // If DynamicField doesn't exist, create it with default certifications
            dynamicField = await DynamicField.create({
                machine_types: [
                    "Industrial",
                ],
                machine_brands: [
                    "Volvo", "Caterpillar", "John Deere", "Komatsu", "Komatsu"
                ],
                machine_models: []
            });
        }
        // default machinetpes 
        const defaultMachineTypes = ["Industrial"];
        defaultMachineTypes.forEach((defaultMachineType) => {
            if (!dynamicField.machine_types.includes(defaultMachineType)) {
                dynamicField.machine_types.push(defaultMachineType);
            }
        });

        // default machineBrands 
        const defaultmachineBrands = ["Volvo", "Caterpillar", "John Deere", "Komatsu", "Komatsu"];
        defaultmachineBrands.forEach((defaultmachineBrand) => {
            if (!dynamicField.machine_brands.includes(defaultmachineBrand)) {
                dynamicField.machine_brands.push(defaultmachineBrand);
            }
        });

        // Add new machinetypes to DynamicField if they do not exist already
        if (!dynamicField.machine_types.includes(machinery.machine_type)) {
            // If not, add the new category
            dynamicField.machine_types.push(machinery.machine_type);
        }

        // Add new MachineBrands to DynamicField if they do not exist already
        if (!dynamicField.machine_brands.includes(machinery.brand)) {
            // If not, add the new category
            dynamicField.machine_brands.push(machinery.brand);
        }

        // Add new MachineModels to DynamicField if they do not exist already
        if (!dynamicField.machine_models.includes(machinery.model)) {
            // If not, add the new category
            dynamicField.machine_models.push(machinery.model);
        }

        // Save the updated DynamicField document
        await dynamicField.save();

        const savedMachinery = await machinery.save();

        businessFound.machines.push(machinery._id);
        await businessFound.save();
        res.status(201).json({
            success: true,
            data: savedMachinery
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get all machinery with filters
const getAllMachinery = async (req, res) => {
    try {
        console.log("Received query:", req.query); // Log the query for debugging

        // Destructure query parameters with default values for pagination
        const {
            machine_name,
            machine_type,
            condition,
            brand,
            model,
            model_year_min,
            model_year_max,
            min_price,
            max_price,
            fixed_price,
            negotiable_price,
            location_country,
            productionCapacity_min,
            productionCapacity_max,
            location_city,
            power_min,
            power_max,
            weight_min,
            weight_max,
            availability,
            supplier_rating_min,
            customer_reviews,
            after_sales_service,
            warranty_min,
            warranty_max,
            accessories_included,
            spare_parts_available,
            financingOptions,
            keyword,
            page = 1,
            limit = 12,
            verified_suppliers, // Added for consistency with aggregationPipeline
        } = req.query;

        // Helper Functions
        const parseBoolean = (value) => {
            if (typeof value === 'string') {
                return value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
            }
            return Boolean(value);
        };

        const parseNumber = (value) => {
            const num = Number(value);
            return isNaN(num) ? null : num;
        };

        // Extract numeric values for warranty
        const warrantyMinNum = warranty_min ? parseNumber(warranty_min) : null;
        const warrantyMaxNum = warranty_max ? parseNumber(warranty_max) : null;

        // Initialize match stage
        let matchStage = {};

        // Function to handle multiple options
        const handleMultipleOptions = (field, value) => {
            if (value) {
                const options = value.split(',').map(opt => opt.trim());
                if (options.length > 1) {
                    matchStage[field] = { $in: options };
                } else {
                    matchStage[field] = { $regex: new RegExp(options[0], 'i') };
                }
            }
        };

        // Apply multiple options filters
        handleMultipleOptions('machine_type', machine_type);
        handleMultipleOptions('condition', condition);
        handleMultipleOptions('brand', brand);
        handleMultipleOptions('model', model);
        handleMultipleOptions('location_city', location_city);
        handleMultipleOptions('availability', availability);
        handleMultipleOptions('financingOptions', financingOptions);

        // Machine Name Filter (assuming single value)
        if (machine_name) {
            matchStage.machine_name = { $regex: new RegExp(machine_name, 'i') };
        }

        // Model Year Range Filter
        if (model_year_min || model_year_max) {
            matchStage.model_year = {};
            if (model_year_min) matchStage.model_year.$gte = parseNumber(model_year_min);
            if (model_year_max) matchStage.model_year.$lte = parseNumber(model_year_max);
        }

        // Price Range Filter
        if (min_price || max_price) {
            matchStage.price = {};
            if (min_price) matchStage.price.$gte = parseNumber(min_price); // Ensure min_price uses $gte
            if (max_price) matchStage.price.$lte = parseNumber(max_price); // Ensure max_price uses $lte
        }

        // Fixed Price or Negotiable Price Filter
        if (fixed_price) matchStage.fixed_price = parseBoolean(fixed_price);
        if (negotiable_price) matchStage.negotiable_price = parseBoolean(negotiable_price);

        // Geographic Location Filter (Country - assuming single value)
        if (location_country) {
            matchStage.location_country = { $regex: new RegExp(location_country, 'i') };
        }

        // Availability Filter is handled in handleMultipleOptions

        // Accessories and Spare Parts Filter
        if (accessories_included) {
            matchStage.accessories_included = parseBoolean(accessories_included);
        }
        if (spare_parts_available) {
            matchStage.spare_parts_available = parseBoolean(spare_parts_available);
        }

        // After-Sales Service Filter
        if (after_sales_service) {
            matchStage.after_sales_service = parseBoolean(after_sales_service);
        }

        // Keyword Search Filter
        if (keyword) {
            matchStage.$or = [
                { machine_name: { $regex: keyword, $options: 'i' } },
                { machine_description: { $regex: keyword, $options: 'i' } }, // Ensure correct field name
                { machine_type: { $regex: keyword, $options: 'i' } },
                { brand: { $regex: keyword, $options: 'i' } },
                { model: { $regex: keyword, $options: 'i' } }
            ];
        }

        // Debugging: Log the constructed matchStage
        console.log("Constructed matchStage:", JSON.stringify(matchStage, null, 2));

        // Initialize Aggregation Pipeline
        const aggregationPipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'business',
                    foreignField: '_id',
                    as: 'business'
                }
            },
            { $unwind: '$business' },
            // Supplier Verification Filter
            ...(verified_suppliers === 'true' ? [{
                $match: {
                    'business.verified': true
                }
            }] : []),
            // Supplier Rating Filter
            ...(supplier_rating_min ? [{
                $match: {
                    'business.ratings': { $gte: parseNumber(supplier_rating_min) }
                }
            }] : []),
            // Customer Reviews Filter
            ...(customer_reviews === 'true' ? [{
                $match: {
                    'reviews': { $exists: true, $ne: [] }
                }
            }] : []),
            // Power Range Filter
            ...(power_min || power_max ? [{
                $match: {
                    ...(power_min ? { 'power.amount': { $gte: parseNumber(power_min) } } : {}),
                    ...(power_max ? { 'power.amount': { $lte: parseNumber(power_max) } } : {})
                }
            }] : []),
            // Weight Range Filter
            ...(weight_min || weight_max ? [{
                $match: {
                    'weight.amount': {
                        ...(weight_min ? { $gte: parseNumber(weight_min) } : {}),
                        ...(weight_max ? { $lte: parseNumber(weight_max) } : {})
                    }
                }
            }] : []),
            // Production Capacity Range Filter
            ...(productionCapacity_min || productionCapacity_max ? [{
                $match: {
                    'productionCapacity.amount': {
                        ...(productionCapacity_min ? { $gte: parseNumber(productionCapacity_min) } : {}),
                        ...(productionCapacity_max ? { $lte: parseNumber(productionCapacity_max) } : {})
                    }
                }
            }] : []),
            // Warranty Range Filter
            ...(warrantyMinNum || warrantyMaxNum ? [{
                $match: {
                    'warranty.amount': {
                        ...(warrantyMinNum ? { $gte: warrantyMinNum } : {}),
                        ...(warrantyMaxNum ? { $lte: warrantyMaxNum } : {})
                    }
                }
            }] : []),
            // Financing Options Filter (handled earlier, but ensuring in aggregation)
            // Already handled via matchStage, but including if necessary
            // ...(financingOptions ? [{
            //     $match: {
            //         'financingOptions': { $in: Array.isArray(financingOptions) ? financingOptions : [financingOptions] }
            //     }
            // }] : []),
            // Sort Stage
            { $sort: { createdAt: -1 } },
            // Pagination Stages
            { $skip: (parseNumber(page) - 1) * parseNumber(limit) },
            { $limit: parseNumber(limit) }
        ];

        // Execute Aggregation Pipeline
        const machinery = await MachinerySale.aggregate(aggregationPipeline);

        // Count Total Documents for Pagination Metadata
        const countPipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'business',
                    foreignField: '_id',
                    as: 'business'
                }
            },
            { $unwind: '$business' },
            // Apply same filters as in aggregationPipeline before pagination
            ...(verified_suppliers === 'true' ? [{
                $match: {
                    'business.verified': true
                }
            }] : []),
            ...(supplier_rating_min ? [{
                $match: {
                    'business.ratings': { $gte: parseNumber(supplier_rating_min) }
                }
            }] : []),
            ...(customer_reviews === 'true' ? [{
                $match: {
                    'reviews': { $exists: true, $ne: [] }
                }
            }] : []),
            ...(power_min || power_max ? [{
                $match: {
                    'power.amount': {
                        ...(power_min ? { 'power.amount': { $gte: parseNumber(power_min) } } : {}),
                        ...(power_max ? { 'power.amount': { $lte: parseNumber(power_max) } } : {})
                    }
                }
            }] : []),
            ...(weight_min || weight_max ? [{
                $match: {
                    'weight.amount': {
                        ...(weight_min ? { $gte: parseNumber(weight_min) } : {}),
                        ...(weight_max ? { $lte: parseNumber(weight_max) } : {})
                    }
                }
            }] : []),
            ...(productionCapacity_min || productionCapacity_max ? [{
                $match: {
                    'productionCapacity.amount': {
                        ...(productionCapacity_min ? { $gte: parseNumber(productionCapacity_min) } : {}),
                        ...(productionCapacity_max ? { $lte: parseNumber(productionCapacity_max) } : {})
                    }
                }
            }] : []),
            ...(warrantyMinNum || warrantyMaxNum ? [{
                $match: {
                    'warranty.amount': {
                        ...(warrantyMinNum ? { $gte: warrantyMinNum } : {}),
                        ...(warrantyMaxNum ? { $lte: warrantyMaxNum } : {})
                    }
                }
            }] : []),
            ...(financingOptions ? [{
                $match: {
                    'financingOptions': { $in: Array.isArray(financingOptions) ? financingOptions : [financingOptions] }
                }
            }] : []),
            { $count: 'count' }
        ];

        const countResult = await MachinerySale.aggregate(countPipeline);
        const totalMachinery = countResult[0] ? countResult[0].count : 0;

        res.status(200).json({
            success: true,
            count: machinery.length,
            totalPages: Math.ceil(totalMachinery / parseNumber(limit)),
            currentPage: parseNumber(page),
            data: machinery
        });
    } catch (error) {
        console.error("Error fetching machinery:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get single machinery
const getMachinery = async (req, res) => {
    try {
        const machinery = await MachinerySale.findById(req.params.id).populate('business');
        if (!machinery) {
            return res.status(404).json({ success: false, message: 'Machinery not found' });
        }
        res.status(200).json({ success: true, data: machinery });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update machinery
const updateMachinery = async (req, res) => {
    try {
        const machinery = await MachinerySale.findById(req.params.id);
        if (!machinery) {
            return res.status(404).json({ success: false, message: 'Machinery not found' });
        }
        const updates = { ...req.body };
        if (req.files && req.files.length > 0) {
            const imageUrls = await Promise.all(
                req.files.map(async (file) => {
                    const uploadResult = await uploadOnCloudinary(file.buffer);
                    return uploadResult.url;
                })
            );
            updates.machine_images = imageUrls;
        }

        const updatedMachinery = await MachinerySale.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: updatedMachinery });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Delete machinery
const deleteMachinery = async (req, res) => {
    try {
        if (req.user.userType !== "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this."
            });
        }
        const machinery = await MachinerySale.findById(req.params.id);
        const business = await Business.findOne({ user: req.user.userId })
        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }
        if (!machinery) {
            return res.status(404).json({ success: false, message: 'Machinery not found' });
        }
        // Check if the machinery is associated with the business
        const isMachineryAssociated = business.machines.includes(req.params.id);

        if (!isMachineryAssociated) {
            return res.status(400).json({
                success: false,
                message: 'Machinery is not associated with this business.'
            });
        }

        // Remove the machinery ID from the business's machineries array
        business.machines = business.machines.filter(
            (id) => id.toString() !== req.params.id
        );
        await business.save();
        await machinery.deleteOne();

        res.status(200).json({ success: true, message: 'Machinery deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMachinesByBusiness = async (req, res) => {
    try {
        if (req.user.userType != "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this"
            })
        }

        const business = await Business.findOne({ user: req.user.userId })
        if (!business) {
            return res.status(404).json({
                success: false,
                error: "Business not found"
            });
        }

        console.log('Business ID:', business._id);
        const machines = await MachinerySale.find({
            business: business._id
        })
        if (!machines) {
            return res.status(404).json({
                success: false,
                message: "No Machines Found"
            })
        }
        return res.status(200).json({
            success: true,
            data: machines
        })

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = { createMachinery, getAllMachinery, getMachinery, updateMachinery, deleteMachinery, getMachinesByBusiness };
