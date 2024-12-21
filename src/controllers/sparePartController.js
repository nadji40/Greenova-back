const SparePart = require('../models/SparePartsModel');
const uploadOnCloudinary = require('../utils/cloudinary');
const Business = require('../models/BusinessModel')
const DynamicField = require("../models/DynamicFieldsModel")
const mongoose = require('mongoose');

exports.createSparePart = async (req, res) => {
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

    const sparePart = new SparePart({
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
      sparePart.spareParts_images = imageUrls;
    }

    // Handle dynamic fields for spare parts
    let dynamicField = await DynamicField.findOne();
    if (!dynamicField) {
      dynamicField = await DynamicField.create({
        sparePartCategories: []
      });
    }

    // Default categories and subcategories
    const defaultCategories = [
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
        compatibleBrands: [],
        compatibleModels: []
      }
    ];

    defaultCategories.forEach((defaultCategory) => {
      let existingCategory = dynamicField.sparePartCategories.find(
        (item) => item.category === defaultCategory.category
      );

      if (!existingCategory) {
        dynamicField.sparePartCategories.push(defaultCategory);
      } else {
        defaultCategory.subCategories.forEach((subCategory) => {
          if (!existingCategory.subCategories.includes(subCategory)) {
            existingCategory.subCategories.push(subCategory);
          }
        });
      }
    });

    // Check if the category exists
    let categoryEntry = dynamicField.sparePartCategories.find(
      (item) => item.category === sparePart.partCategory
    );

    if (!categoryEntry) {
      dynamicField.sparePartCategories.push({
        category: sparePart.partCategory,
        subCategories: [sparePart.subCategory],
        compatibleBrands: [...(sparePart.compatibleBrands || [])],
        compatibleModels: [...(sparePart.compatibleModels || [])]
      });
    } else {
      // Add subcategory if it does not exist
      if (!categoryEntry.subCategories.includes(sparePart.subCategory)) {
        categoryEntry.subCategories.push(sparePart.subCategory);
      }

      // Add compatible brands if they do not exist
      (sparePart.compatibleBrands || []).forEach((brand) => {
        if (!categoryEntry.compatibleBrands.includes(brand)) {
          categoryEntry.compatibleBrands.push(brand);
        }
      });

      // Add compatible models if they do not exist
      (sparePart.compatibleModels || []).forEach((model) => {
        if (!categoryEntry.compatibleModels.includes(model)) {
          categoryEntry.compatibleModels.push(model);
        }
      });
    }

    // Save the updated dynamic fields
    await dynamicField.save();

    const savedSpareParts = await sparePart.save();

    supplierFound.spareParts.push(sparePart._id);
    await supplierFound.save();

    res.status(201).json({
      success: true,
      data: savedSpareParts,
      message: "Spare part registered successfully."
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getAllSpareParts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    console.log("Received Query", req.query);

    // Initialize the aggregation pipeline
    const pipeline = [];

    // Match filters
    const matchFilters = {};

    // PartType filter (multiple categories)
    if (req.query.partType) {
      const categories = req.query.partType.split(',').map(cat => cat.trim());
      matchFilters.partCategory = { $in: categories };
    }

    // SubCategory filter (multiple subcategories)
    if (req.query.subCategory) {
      const subCategories = req.query.subCategory.split(',').map(cat => cat.trim());
      matchFilters.subCategory = { $in: subCategories };
    }

    // Condition filter (multiple conditions)
    if (req.query.condition) {
      const conditions = req.query.condition.split(',').map(cond => cond.trim());
      matchFilters.condition = { $in: conditions };  // Match any of the selected conditions
    }

    // MachineType filter
    if (req.query.machineType) {
      const machineTypes = req.query.machineType.split(',').map(mt => mt.trim());
      matchFilters.machineType = { $in: machineTypes };
    }

    // Location filters (Country and City) - Multiple cities allowed
    if (req.query.locationCountry) {
      matchFilters.locationCountry = req.query.locationCountry;
    }
    if (req.query.locationCity) {
      const cities = req.query.locationCity.split(',').map(city => city.trim());
      matchFilters.locationCity = { $in: cities };  // Match any of the selected cities
    }

    // Availability filter (multiple availability options)
    if (req.query.availability) {
      const availabilityOptions = req.query.availability.split(',').map(avail => avail.trim());
      matchFilters.availability = { $in: availabilityOptions };  // Match any of the selected availability options
    }

    // Compatible Brands filter (multiple brands)
    if (req.query.compatibleBrands) {
      const brands = req.query.compatibleBrands.split(',').map(brand => brand.trim());
      matchFilters.compatibleBrands = { $in: brands };  // Match any of the selected compatible brands
    }

    // Compatible Models filter (multiple models)
    if (req.query.compatibleModels) {
      const models = req.query.compatibleModels.split(',').map(model => model.trim());
      matchFilters.compatibleModels = { $in: models };  // Match any of the selected compatible models
    }

    // Price Range filter
    if (req.query.minPrice || req.query.maxPrice) {
      matchFilters.price = {};
      if (req.query.minPrice) matchFilters.price.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice) matchFilters.price.$lte = parseInt(req.query.maxPrice);
    }

    // Price Type filter (Fixed or Negotiable)
    if (req.query.priceType) {
      const priceType = req.query.priceType.toLowerCase();
      if (priceType === 'fixed price') {
        matchFilters.fixedPrice = true;
        matchFilters.negotiablePrice = false;
      } else if (priceType === 'negotiable price') {
        matchFilters.fixedPrice = false;
        matchFilters.negotiablePrice = true;
      } else {
        // If the priceType is neither 'fixed price' nor 'negotiable price', return an empty result
        matchFilters.price = { $lt: 0 }; // This ensures no results will match the invalid priceType
      }
    }

    // Warranty filter (range)
    if (req.query.warrantyMin || req.query.warrantyMax) {
      const warrantyFilter = {};

      if (req.query.warrantyMin) {
        const warrantyMin = parseInt(req.query.warrantyMin);
        if (!isNaN(warrantyMin)) {
          warrantyFilter.$gte = warrantyMin;
        }
      }

      if (req.query.warrantyMax) {
        const warrantyMax = parseInt(req.query.warrantyMax);
        if (!isNaN(warrantyMax)) {
          warrantyFilter.$lte = warrantyMax;
        }
      }

      // Only add the warranty.amount filter if at least one condition is met
      if (Object.keys(warrantyFilter).length > 0) {
        matchFilters['warranty.amount'] = warrantyFilter;
      }
    }

    // Bulk discount filter
    if (req.query.bulkDiscountsAvailable !== undefined) {
      const bulkDiscount = req.query.bulkDiscountsAvailable === 'true'; // Convert string to boolean
      matchFilters.bulkDiscountsAvailable = bulkDiscount; // Add filter for bulk discount availability
    }

    // Keyword Search Filter
    if (req.query.keyword) {
      const keyword = req.query.keyword.trim();
      matchFilters.$or = [
        {
          partCategory: { $regex: keyword, $options: 'i' }
        },
        {
          subCategory: { $regex: keyword, $options: 'i' }
        },
        {
          description: { $regex: keyword, $options: 'i' }
        },
      ];
      console.log("Keyword Filter Applied:", matchFilters.$or);
    }

    // Add match stage to aggregation pipeline if any filters are provided
    if (Object.keys(matchFilters).length > 0) {
      pipeline.push({ $match: matchFilters });
    }

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
    // **New: Add minReviews filter**
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

    // Project to clean up the output (optional)
    pipeline.push({
      $project: {
        supplier: { $arrayElemAt: ['$supplierDetails', 0] }, // Get only the first element of the array (since $lookup returns an array)
        partCategory: 1,
        subCategory: 1,
        compatibleBrands: 1,
        compatibleModels: 1,
        machineType: 1,
        description: 1,
        condition: 1,
        price: 1,
        currency: 1,
        spareParts_images: 1,
        locationCountry: 1,
        locationCity: 1,
        availability: 1,
        ratings: 1,
        warranty: 1,
        bulkDiscountsAvailable: 1,
        status: 1,
        createdAt: 1
      }
    });

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Execute the aggregation
    const spareParts = await SparePart.aggregate(pipeline);

    // Get the total count of matching documents (without pagination)
    const total = await SparePart.countDocuments(matchFilters);

    res.status(200).json({
      success: true,
      data: spareParts,
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

exports.getSparePart = async (req, res) => {
  try {
    const sparePart = await SparePart.findById(req.params.id)
      .populate('supplier');

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        error: 'Spare part not found'
      });
    }

    res.status(200).json({
      success: true,
      data: sparePart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.updateSparePart = async (req, res) => {
  try {
    const sparePart = await SparePart.findById(req.params.id);
    if (!sparePart) {
      return res.status(404).json({ success: false, message: 'Spare Part not found' });
    }
    const updates = { ...req.body };
    if (req.files && req.files.length > 0) {
      const imageUrls = await Promise.all(
        req.files.map(async (file) => {
          const uploadResult = await uploadOnCloudinary(file.buffer);
          return uploadResult.url;
        })
      );
      updates.spareParts_images = imageUrls;
    }

    const updatedSparePart = await SparePart.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: updatedSparePart, message: "Spare part updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteSparePart = async (req, res) => {
  try {
    if (req.user.userType !== "serviceProvider") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only service providers can access this."
      });
    }
    const sparePart = await SparePart.findById(req.params.id);
    const business = await Business.findOne({ user: req.user.userId })
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        error: 'Spare part not found'
      });
    }

    // Debug logs
    console.log('Spare Part Supplier:', sparePart.supplier);
    console.log('Current User:', req.user.userId);

    // Check if the machinery is associated with the business
    const isSparePartsAssociated = business.spareParts.includes(req.params.id);

    if (!isSparePartsAssociated) {
      return res.status(400).json({
        success: false,
        message: 'Machinery is not associated with this business.'
      });
    }

    // Remove the machinery ID from the business's machineries array
    business.spareParts = business.spareParts.filter(
      (id) => id.toString() !== req.params.id
    );
    await business.save();
    await SparePart.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
      message: "Spare part deleted successfully"
    });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.getSparePartsBySupplier = async (req, res) => {
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
    const spareParts = await SparePart.find({
      supplier: supplier._id
    })
    if (!spareParts) {
      return res.status(404).json({
        success: false,
        message: "No Spare parts Found"
      })
    }
    return res.status(200).json({
      success: true,
      data: spareParts
    })

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}