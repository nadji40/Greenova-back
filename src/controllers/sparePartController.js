const SparePart = require('../models/SparePartsModel');
const uploadOnCloudinary = require('../utils/cloudinary');
const Business = require('../models/BusinessModel')
const mongoose = require('mongoose');

exports.createSparePart = async (req, res) => {
  try {
    const { files, body } = req;
    if (req.user.userType != "serviceProvider") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only service providers can access this"
      })
    }
    const supplierFound = await Business.findOne({ user: req.user.userId })
    if (!supplierFound) {
      return res.status(404).json({
        success: false,
        message: "Supplier Not found"
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

    const savedSpareParts = await sparePart.save();

    supplierFound.spareParts.push(sparePart._id);
    await supplierFound.save();
    res.status(201).json({
      success: true,
      data: savedSpareParts,
      message: "Spare Parts registered successfully"
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

    // Initialize the aggregation pipeline
    const pipeline = [];

    // Match filters
    const matchFilters = {};

    // PartType filter
    if (req.query.partType) {
      matchFilters.partCategory = req.query.partType;
    }
    if (req.query.partName) {
      matchFilters.name = req.query.partName;
    }

    // Condition filter
    if (req.query.condition) {
      matchFilters.condition = req.query.condition;
    }
    if (req.query.machineType) {
      matchFilters.machineType = req.query.machineType;
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

    // Compatible Brands filter (assumes the compatibleBrands field is an array)
    if (req.query.compatibleBrands) {
      matchFilters.compatibleBrands = { $in: req.query.compatibleBrands.split(',') }; // Assumes brands are passed as comma-separated string
    }

    if (req.query.compatibleModels) {
      matchFilters.compatibleModels = { $in: req.query.compatibleModels.split(',') }; // Assumes models are passed as comma-separated string
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


    if (req.query.warrantyMin || req.query.warrantyMax) {
      // Ensure that matchFilters.warranty exists
      matchFilters.warranty = matchFilters.warranty || {};

      // Ensure that matchFilters.warranty.amount exists
      matchFilters.warranty.amount = matchFilters.warranty.amount || {};

      if (req.query.warrantyMin) {
        const warrantyMin = parseInt(req.query.warrantyMin);
        if (!isNaN(warrantyMin)) {
          matchFilters.warranty.amount.$gte = warrantyMin;
        }
      }

      if (req.query.warrantyMax) {
        const warrantyMax = parseInt(req.query.warrantyMax);
        if (!isNaN(warrantyMax)) {
          matchFilters.warranty.amount.$lte = warrantyMax;
        }
      }
    }

    // bulk discount filter
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
        partCategory: 1,
        name: 1,
        compatibleBrands: 1,
        compatibleModels: 1,
        machineType: 1,
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
    const sparePart = await SparePart.findById(req.params.id);

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        error: 'Spare part not found'
      });
    }

    // Debug logs
    console.log('Spare Part Supplier:', sparePart.supplier);
    console.log('Current User:', req.user.userId);

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