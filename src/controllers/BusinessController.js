const Business = require('../models/BusinessModel');
const Service = require('../models/Service');
const MachinerySale = require('../models/MachinerySaleModel');
const uploadOnCloudinary = require('../utils/cloudinary');
const DynamicField = require("../models/DynamicFieldsModel")

exports.createBusiness = async (req, res) => {
  try {
    const { files, body, user } = req;

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

    // Destructure the filter object from the query parameters
    let {
      priceRange, // Expected as an object: { min: '100', max: '500' }
      selectedCategories,
      selectedRating,
      radius, // Expected as an object: { min: '5', max: '50' }
      expertiseLevel,
      availabilityOption,
      minReviews,
      pricingType,
      selectedProviders,
      selectedCertifications,
      experienceRange,
      sortingOption,
      serviceName,
      businessName,
      longitude,
      latitude,
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

    // Parse priceRange from object
    let parsedPriceRange = {};
    if (priceRange) {
      const { min, max } = priceRange;
      if (min !== undefined && !isNaN(parseFloat(min))) parsedPriceRange.min = parseFloat(min);
      if (max !== undefined && !isNaN(parseFloat(max))) parsedPriceRange.max = parseFloat(max);
    }

    // Parse radius from object
    let parsedRadius = {};
    if (radius) {
      const { min, max } = radius;
      if (min !== undefined && !isNaN(parseFloat(min))) parsedRadius.min = parseFloat(min);
      if (max !== undefined && !isNaN(parseFloat(max))) parsedRadius.max = parseFloat(max);
    }

    // Initialize aggregation pipeline
    let aggregationPipeline = [];

    // Step 1: Geospatial Filtering (optional)
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

    // Step 2: Basic Business-Level Filters
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

    // Business Rating Filter (Assuming you want businesses with ratings >= selectedRating)
    if (selectedRating) {
      businessMatch.ratings = { $gte: Number(selectedRating) };
    }

    // Availability Option Filter
    if (availabilityOption) {
      const now = new Date();
      let availabilityCriteria = {};

      switch (availabilityOption.toLowerCase()) {
        case 'immediate':
          availabilityCriteria = {
            $elemMatch: {
              start: { $lte: now },
              end: { $gte: now }
            }
          };
          break;
        case 'within a week':
          const nextWeek = new Date();
          nextWeek.setDate(now.getDate() + 7);
          availabilityCriteria = {
            $elemMatch: {
              start: { $lte: nextWeek },
              end: { $gte: now }
            }
          };
          break;
        // Add more cases as needed
      }

      if (Object.keys(availabilityCriteria).length > 0) {
        businessMatch.availability = availabilityCriteria;
      }
    }

    // Expertise Level Filter
    if (expertiseLevel) {
      businessMatch.expertise_level = expertiseLevel;
    }

    // Apply Business-Level Filters
    if (Object.keys(businessMatch).length > 0) {
      aggregationPipeline.push({ $match: businessMatch });
    }

    // Step 3: Lookup Services
    aggregationPipeline.push({
      $lookup: {
        from: "services",
        localField: "services",
        foreignField: "_id",
        as: "services"
      }
    });

    // Step 4: Unwind Services to Apply Service-Level Filters
    aggregationPipeline.push({
      $unwind: {
        path: "$services",
        preserveNullAndEmptyArrays: false // Only include businesses with at least one service
      }
    });

    // Step 5: Service-Level Filters
    const serviceMatch = { "services.status": "approved" };

    // Service Name Filter
    if (serviceName) {
      serviceMatch["services.title"] = { $regex: serviceName, $options: "i" };
    }

    // Service Category Filter (selectedCategories as service type)
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
      // Remove empty pricing.amount if no conditions applied
      if (Object.keys(serviceMatch["services.pricing.amount"]).length === 0) {
        delete serviceMatch["services.pricing.amount"];
      }
    }

    // Pricing Type Filter
    if (pricingType) {
      serviceMatch["services.pricingType"] = pricingType;
    }

    // Apply Service-Level Filters
    aggregationPipeline.push({ $match: serviceMatch });

    // Step 6: Re-group Businesses with Filtered Services
    aggregationPipeline.push({
      $group: {
        _id: "$_id",
        user: { $first: "$user" },
        businessName: { $first: "$businessName" },
        businessType: { $first: "$businessType" },
        years_of_experience: { $first: "$years_of_experience" },
        ratings: { $first: "$ratings" },
        availability: { $first: "$availability" },
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

    // Step 7: Add numberOfReviews Field
    aggregationPipeline.push({
      $addFields: {
        numberOfReviews: { $size: { $ifNull: ["$reviews", []] } }
      }
    });

    // Step 8: Apply Business-Level Rating and Review Filters
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

    // Step 9: Sorting Options
    // Map frontend sortingOption to backend sortBy
    const sortOptions = {
      "Highest Rating": { ratings: -1 },
      "Most Reviewed": { numberOfReviews: -1 },
      "Newest": { createdAt: -1 },
      "Lowest Price": { "services.pricing.amount": 1 },
      "Highest Price": { "services.pricing.amount": -1 }
      // Add more sorting options as needed
    };

    if (sortingOption && sortOptions[sortingOption]) {
      aggregationPipeline.push({ $sort: sortOptions[sortingOption] });
    } else {
      // Default sorting
      aggregationPipeline.push({ $sort: { createdAt: -1 } });
    }

    // Step 10: Pagination
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: limitNumber });

    // Execute Aggregation Pipeline
    const businesses = await Business.aggregate(aggregationPipeline).exec();

    // Count Total Documents for Pagination Metadata (without $skip and $limit)
    let countPipeline = aggregationPipeline.filter(stage => !('$skip' in stage) && !('$limit' in stage));
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
      .populate({
        path: 'reviews.user',
        model: 'User',
        select: 'fullName email profilePicture' // Only select specific fields from the User model
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

    await Business.findByIdAndDelete(business._id);

    res.status(200).json({
      success: true,
      message: 'Business, associated services, and machines deleted successfully'
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
    const allowedFields = ['businessName', 'description', 'businessType', 'location', 'contact_info', 'workingHours', 'availability', 'logo', 'banner'];
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
          $maxDistance: 5000, // 5000 meters = 5 km
        },
      },
    })
      .populate('services')
      .populate('machines')
      .populate({
        path: 'reviews.user',
        model: 'User',
        select: 'fullName email profilePicture', // Select specific fields from the User model
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
