const Business = require('../models/BusinessModel');
const Service = require('../models/Service');
const SparePart = require('../models/SparePartsModel');
const RawMaterial = require('../models/rawMaterialModel');
const MachinerySale = require('../models/MachinerySaleModel');
const uploadOnCloudinary = require('../utils/cloudinary');
const DynamicField = require("../models/DynamicFieldsModel")

exports.createBusiness = async (req, res) => {
  try {
    const { files, body, user } = req;
    console.log(body);

    if (user.userType != "serviceProvider") {
      return res.status(403).json({
        success: false,
        message: "Only Service providers can register their businesses"
      })
    }
    // Check if logo file is present
    if (!files || !files.logo) {
      return res.status(400).json({
        success: false,
        message: "Logo is required to create a business"
      });
    }

    console.log('Files:', files); // Log to confirm if the file is received

    const business = new Business({
      ...body,
      user: user.userId
    });

    // Upload the logo file to Cloudinary
    try {
      const logoUploadResult = await uploadOnCloudinary(files.logo[0].buffer);
      business.logo = logoUploadResult.url;
      console.log("Logo uploaded to Cloudinary:", logoUploadResult.url);
    } catch (uploadError) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload logo",
        error: uploadError.message
      });
    }

    // Upload the banner file to Cloudinary if provided
    if (files && files.banner) {
      try {
        const bannerUploadResult = await uploadOnCloudinary(files.banner[0].buffer);
        business.banner = bannerUploadResult.url;
        console.log("Banner uploaded to Cloudinary:", bannerUploadResult.url);
      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload banner",
          error: uploadError.message
        });
      }
    }

    let dynamicField = await DynamicField.findOne();
    if (!dynamicField) {
      // If DynamicField doesn't exist, create it with default certifications
      dynamicField = await DynamicField.create({
        certifications: [
          "ISO Certification",
          "Safety Certifications",
          "Quality Assurance Certifications",
        ]
      });
    }
    const defaultCertifications = ["ISO Certification",
      "Safety Certifications",
      "Quality Assurance Certifications",];
    defaultCertifications.forEach((defaultCertification) => {
      if (!dynamicField.certifications.includes(defaultCertification)) {
        dynamicField.certifications.push(defaultCertification);
      }
    });
    // Add new certifications to DynamicField if they do not exist already
    const newCertifications = business.certifications || [];
    for (const certification of newCertifications) {
      if (!dynamicField.certifications.includes(certification)) {
        dynamicField.certifications.push(certification);
      }
    }

    // Save the updated DynamicField document
    await dynamicField.save();

    // Save the business
    await business.save();

    res.status(201).json({
      success: true,
      data: business,
      message: "Business Registered Successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getAllBusiness = async (req, res) => {
  try {
    console.log("Received Query:", req.query);

    // Destructure and parse query parameters
    let {
      priceRange, // Expected as object: { min: '100', max: '500' }
      selectedCategories,
      selectedRating,
      radius, // Expected as object: { min: '5', max: '50' }
      expertiseLevel, // **Now can be multiple**
      availabilityOption, // **Now can be multiple**
      minReviews,
      pricingType, // **Now can be multiple**
      selectedProviders,
      selectedCertifications,
      experienceRange,
      sortingOption,
      serviceName,
      businessName,
      longitude,
      latitude,
      keyword, // **New: Keyword Parameter**
      page = 1,
      limit = 20
    } = req.query;

    // Helper function to parse comma-separated strings into arrays
    const parseToArray = (param) => {
      if (Array.isArray(param)) {
        return param;
      } else if (typeof param === 'string') {
        return param.split(',').map(item => item.trim());
      } else {
        return [];
      }
    };

    // Parse array parameters
    selectedCategories = parseToArray(selectedCategories);
    selectedProviders = parseToArray(selectedProviders);
    selectedCertifications = parseToArray(selectedCertifications);
    expertiseLevel = parseToArray(expertiseLevel); // **Parsed as array**
    pricingType = parseToArray(pricingType); // **Parsed as array**
    availabilityOption = parseToArray(availabilityOption); // **Parsed as array**

    // Parse priceRange
    let parsedPriceRange = {};
    if (priceRange) {
      const { min, max } = priceRange;
      if (min !== undefined && !isNaN(parseFloat(min))) parsedPriceRange.min = parseFloat(min);
      if (max !== undefined && !isNaN(parseFloat(max))) parsedPriceRange.max = parseFloat(max);
    }

    // Parse radius
    let parsedRadius = {};
    if (radius) {
      const { min, max } = radius;
      if (min !== undefined && !isNaN(parseFloat(min))) parsedRadius.min = parseFloat(min);
      if (max !== undefined && !isNaN(parseFloat(max))) parsedRadius.max = parseFloat(max);
    }

    // Determine if we have filters that would restrict the result set
    const hasFilters =
      (longitude && latitude && parsedRadius.max) ||
      (businessName && businessName.trim() !== "") ||
      (selectedCertifications && selectedCertifications.length > 0) ||
      experienceRange ||
      (selectedProviders && selectedProviders.length > 0) ||
      selectedRating ||
      (expertiseLevel && expertiseLevel.length > 0) || // **Updated**
      (availabilityOption && availabilityOption.length > 0) || // **Updated**
      serviceName ||
      (selectedCategories && selectedCategories.length > 0) ||
      (pricingType && pricingType.length > 0) || // **Updated**
      parsedPriceRange.min !== undefined ||
      parsedPriceRange.max !== undefined ||
      minReviews ||
      (keyword && keyword !== ""); // **Include Keyword in hasFilters**

    // If no filters, return all businesses directly
    if (!hasFilters) {
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 20;
      const skip = (pageNumber - 1) * limitNumber;

      const businesses = await Business.find({})
        .populate('services')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .exec();

      const totalCount = await Business.countDocuments({});
      return res.status(200).json({
        success: true,
        count: businesses.length,
        totalPages: Math.ceil(totalCount / limitNumber),
        currentPage: pageNumber,
        data: businesses
      });
    }

    // Initialize aggregation pipeline
    let aggregationPipeline = [];

    // 1: Geospatial Filtering (optional)
    if (longitude && latitude && parsedRadius.max) {
      aggregationPipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          distanceField: "distance",
          maxDistance: parsedRadius.max * 1000, // Convert km to meters
          spherical: true
        }
      });
    }

    // 2: Basic Business-Level Filters (only fields that exist directly in the Business collection)
    const businessMatch = {};

    // Business Name Filter
    if (businessName) {
      businessMatch.businessName = { $regex: businessName, $options: "i" };
    }

    // Certifications Filter
    if (selectedCertifications.length > 0) {
      businessMatch.certifications = { $in: selectedCertifications };
    }

    // Experience Range Filter
    if (experienceRange) {
      const [minExp, maxExp] = experienceRange.split('-').map(exp => parseInt(exp.trim()));
      if (!isNaN(minExp)) {
        businessMatch.years_of_experience = { ...businessMatch.years_of_experience, $gte: minExp };
      }
      if (!isNaN(maxExp)) {
        businessMatch.years_of_experience = { ...businessMatch.years_of_experience, $lte: maxExp };
      }
    }

    // Provider Types Filter
    if (selectedProviders.length > 0) {
      businessMatch.businessType = { $in: selectedProviders };
    }

    // Business Rating Filter
    if (selectedRating) {
      businessMatch.ratings = { $gte: Number(selectedRating) };
    }

    // Expertise Level Filter (using $in)
    if (expertiseLevel.length > 0) {
      businessMatch.expertise_level = { $in: expertiseLevel };
    }

    if (Object.keys(businessMatch).length > 0) {
      aggregationPipeline.push({ $match: businessMatch });
    }

    // 3: Lookup Services
    aggregationPipeline.push({
      $lookup: {
        from: "services",
        localField: "services",
        foreignField: "_id",
        as: "services"
      }
    });

    // 4: Unwind Services
    aggregationPipeline.push({
      $unwind: {
        path: "$services",
        preserveNullAndEmptyArrays: false // Only include businesses with at least one service
      }
    });

    // 5: Service-Level Filters
    const serviceMatch = { "services.status": "approved" };

    // Availability Option Filter (now that services are looked up and unwound)
    if (availabilityOption.length > 0) {
      const now = new Date();
      const availabilityOrConditions = [];

      availabilityOption.forEach(option => {
        let condition = {};
        switch (option.toLowerCase()) {
          case 'immediate':
            // Immediate availability: current date within the availability range
            condition = {
              "services.availability.start": { $lte: now },
              "services.availability.end": { $gte: now }
            };
            break;
          case 'within a week':
            // Availability within a week
            const nextWeek = new Date();
            nextWeek.setDate(now.getDate() + 7);
            condition = {
              "services.availability.start": { $lte: nextWeek },
              "services.availability.end": { $gte: now }
            };
            break;
          default:
            // Custom date range from startDate and endDate
            const { startDate, endDate } = req.query; // Make sure these are passed as query params
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              if (start && end) {
                condition = {
                  "services.availability.start": { $gte: start },
                  "services.availability.end": { $lte: end }
                };
              }
            }
            break;
        }

        if (Object.keys(condition).length > 0) {
          availabilityOrConditions.push(condition);
        }
      });

      if (availabilityOrConditions.length > 0) {
        serviceMatch["$or"] = availabilityOrConditions;
      }
    }

    // Service Name Filter
    if (serviceName) {
      serviceMatch["services.title"] = { $regex: serviceName, $options: "i" };
    }

    // Service Category Filter
    if (selectedCategories.length > 0) {
      serviceMatch["services.category"] = { $in: selectedCategories };
    }

    // Price Range Filter
    if (parsedPriceRange.min !== undefined || parsedPriceRange.max !== undefined) {
      serviceMatch["services.pricing.amount"] = {};
      if (parsedPriceRange.min !== undefined) {
        serviceMatch["services.pricing.amount"].$gte = parsedPriceRange.min;
      }
      if (parsedPriceRange.max !== undefined) {
        serviceMatch["services.pricing.amount"].$lte = parsedPriceRange.max;
      }
      // If no conditions applied, remove empty object
      if (Object.keys(serviceMatch["services.pricing.amount"]).length === 0) {
        delete serviceMatch["services.pricing.amount"];
      }
    }

    // Pricing Type Filter (using $in)
    if (pricingType.length > 0) {
      serviceMatch["services.pricingType"] = { $in: pricingType };
    }

    // Apply Service-Level Filters
    if (Object.keys(serviceMatch).length > 0) {
      aggregationPipeline.push({ $match: serviceMatch });
    }

    // **New: Keyword Search Filter**
    if (keyword) {
      aggregationPipeline.push({
        $match: {
          $or: [
            { businessName: { $regex: keyword, $options: 'i' } },
            { businessType: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
            { "services.title": { $regex: keyword, $options: 'i' } },
            { "services.description": { $regex: keyword, $options: 'i' } },
            { "services.category": { $regex: keyword, $options: 'i' } },
          ]
        }
      });
    }

    // 6: Group Businesses back with filtered services
    aggregationPipeline.push({
      $group: {
        _id: "$_id",
        user: { $first: "$user" },
        businessName: { $first: "$businessName" },
        businessType: { $first: "$businessType" },
        years_of_experience: { $first: "$years_of_experience" },
        ratings: { $first: "$ratings" },
        expertise_level: { $first: "$expertise_level" },
        description: { $first: "$description" },
        logo: { $first: "$logo" },
        banner: { $first: "$banner" },
        location: { $first: "$location" },
        contact_info: { $first: "$contact_info" },
        certifications: { $first: "$certifications" },
        workingHours: { $first: "$workingHours" },
        subscriptionPlan: { $first: "$subscriptionPlan" },
        reviews: { $first: "$reviews" },
        noOfOrders: { $first: "$noOfOrders" },
        services: { $push: "$services" },
        machines: { $first: "$machines" },
        distance: { $first: "$distance" }
      }
    });

    // 7: Add numberOfReviews Field
    aggregationPipeline.push({
      $addFields: {
        numberOfReviews: { $size: { $ifNull: ["$reviews", []] } }
      }
    });

    // 8: Apply Post-Group Filters (Rating, minReviews)
    const postGroupMatch = {};
    if (selectedRating) {
      postGroupMatch["ratings"] = { $gte: Number(selectedRating) };
    }
    if (minReviews) {
      postGroupMatch["numberOfReviews"] = { $gte: Number(minReviews) };
    }
    if (Object.keys(postGroupMatch).length > 0) {
      aggregationPipeline.push({ $match: postGroupMatch });
    }

    // 9: Sorting Options
    const sortOptions = {
      "Highest Rating": { ratings: -1 },
      "Most Reviewed": { numberOfReviews: -1 },
      "Newest": { createdAt: -1 },
      "Lowest Price": { "services.pricing.amount": 1 },
      "Highest Price": { "services.pricing.amount": -1 }
    };

    if (sortingOption && sortOptions[sortingOption]) {
      aggregationPipeline.push({ $sort: sortOptions[sortingOption] });
    } else {
      // Default sorting
      aggregationPipeline.push({ $sort: { createdAt: -1 } });
    }

    // 10: Pagination
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: limitNumber });

    // Log the final aggregation pipeline for debugging
    console.log("Final Aggregation Pipeline:", JSON.stringify(aggregationPipeline, null, 2));

    // Execute Aggregation Pipeline
    const businesses = await Business.aggregate(aggregationPipeline).exec();

    // Count Total Documents for Pagination
    let countPipeline = aggregationPipeline.filter(stage =>
      !('$skip' in stage) &&
      !('$limit' in stage) &&
      !('$sort' in stage)
    );

    // Add $count stage to get total count
    countPipeline.push({ $count: "totalCount" });

    const totalBusinessesResult = await Business.aggregate(countPipeline).exec();
    const totalCount = totalBusinessesResult.length ? totalBusinessesResult[0].totalCount : 0;

    res.status(200).json({
      success: true,
      count: businesses.length,
      totalPages: Math.ceil(totalCount / limitNumber),
      currentPage: pageNumber,
      data: businesses
    });

  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};


exports.getBusiness = async (req, res) => {
  try {
    if (req.user.userType != "serviceProvider") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only service providers can access this"
      })
    }
    const business = await Business.findOne({ user: req.user.userId })
      .populate('services')
      .populate('machines')
      .populate('spareParts')
      .populate('rawMaterial')
      .populate({
        path: 'reviews.user',
        model: 'User',
        select: 'fullName email profilePicture age' // Only select specific fields from the User model
      });

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Service Provider not found'
      });
    }

    res.status(200).json({
      success: true,
      data: business,
      message: "Business fetched Successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.deleteBusiness = async (req, res) => {
  try {
    if (req.user.userType != "serviceProvider") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only service providers can access this"
      })
    }

    const business = await Business.findOne({ user: req.user.userId });
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    await Service.deleteMany({ _id: { $in: business.services } });
    await MachinerySale.deleteMany({ _id: { $in: business.machines } });
    await SparePart.deleteMany({ _id: { $in: business.spareParts } });
    await RawMaterial.deleteMany({ _id: { $in: business.rawMaterial } });

    await Business.findByIdAndDelete(business._id);

    res.status(200).json({
      success: true,
      message: 'Business, associated services, and others deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    if (req.user.userType != "serviceProvider") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only service providers can access this"
      })
    }
    const { body, files } = req;

    // Define which fields are allowed to be updated
    const allowedFields = ['businessName', 'description', 'businessType', 'location', 'contact_info', 'workingHours', 'availability', 'logo', 'banner', 'certifications'];
    // Filter the body to only include allowed fields
    const updatedData = {};
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updatedData[field] = body[field];
      }
    });

    // Handle updating specific fields within contact_info
    if (body.contact_info) {
      const existingBusiness = await Business.findOne({ user: req.user.userId });
      if (!existingBusiness) {
        return res.status(404).json({
          success: false,
          error: 'Business not found'
        });
      }

      // Merge existing contact_info with new values
      updatedData.contact_info = {
        ...existingBusiness.contact_info.toObject(), // Convert existing to plain object to merge
        ...body.contact_info
      };
    }

    // Handle file uploads separately (e.g., logo, banner)
    if (files && files.logo) {
      const uploadResult = await uploadOnCloudinary(files.logo[0].buffer);
      updatedData.logo = uploadResult.url;
    }
    // Validate and format the location field
    if (body.location && body.location.coordinates) {
      const [latitude, longitude] = body.location.coordinates;

      // Check if latitude and longitude are valid numbers
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates. Latitude and longitude must be numbers.'
        });
      }

      updatedData.location = {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON expects [longitude, latitude]
      };
    }


    if (files && files.banner) {
      const uploadResult = await uploadOnCloudinary(files.banner[0].buffer);
      updatedData.banner = uploadResult.url;
    }

    // Update the business with the filtered data
    const business = await Business.findOneAndUpdate({ user: req.user.userId }, updatedData, { new: true });
    if (updatedData.certifications) {
      let dynamicField = await DynamicField.findOne();
      // Add new certifications to DynamicField if they do not exist already
      const newCertifications = business.certifications || [];
      for (const certification of newCertifications) {
        if (!dynamicField.certifications.includes(certification)) {
          dynamicField.certifications.push(certification);
        }
      }
      await dynamicField.save();
    }

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    res.status(200).json({
      success: true,
      data: business,
      message: 'Profile Updated Successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error
    });
  }
};

exports.nearByBusinesses = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    console.log(latitude, longitude);


    // Validate latitude and longitude
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const userLocation = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };

    // Find businesses near the user's location and populate related fields
    const businesses = await Business.find({
      location: {
        $near: {
          $geometry: userLocation,
          $maxDistance: 50000, // 5000 meters = 5 km
        },
      },
    })
      .populate('services')
      .populate('machines')
      .populate('spareParts')
      .populate('rawMaterial')
      .populate({
        path: 'reviews.user',
        model: 'User',
        select: 'fullName email profilePicture age', // Select specific fields from the User model
      });

    if (!businesses.length) {
      return res.status(404).json({
        success: false,
        message: "No businesses found near this location.",
      });
    }

    return res.status(200).json({
      success: true,
      data: businesses,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
