const mongoose = require('mongoose');
const MachinerySale = require('../models/MachinerySaleModel');
const Service = require('../models/Service');
const uploadOnCloudinary = require('../utils/cloudinary');
const Business = require('../models/BusinessModel');
const DynamicField = require('../models/DynamicFieldsModel')

exports.createService = async (req, res) => {
    try {
        const { category, title, description, pricing, pricingType, availability, location } = req.body;
        const { files } = req; // Get files for image uploads

        // Check if the user is a service provider
        if (req.user.userType != "serviceProvider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can access this",
            });
        }

        // Find the business linked to the user
        const businessFound = await Business.findOne({ user: req.user.userId });
        if (!businessFound) {
            return res.status(404).json({
                success: false,
                message: "Business Not found",
            });
        }

        let dynamicField = await DynamicField.findOne();
        if (!dynamicField) {
            // If DynamicField doesn't exist, create it and initialize default categories
            dynamicField = await DynamicField.create({
                serviceCategories: ["Maintenance", "Consulting", "Automation", "Installation", "Inspection", "Repair", "Training"], // Initialize with default values
            });
        }

        // Ensure default categories are present if the document was created with no serviceCategories
        const defaultCategories = ["Maintenance", "Consulting", "Automation", "Installation", "Inspection", "Repair", "Training"];
        defaultCategories.forEach((defaultCategory) => {
            if (!dynamicField.serviceCategories.includes(defaultCategory)) {
                dynamicField.serviceCategories.push(defaultCategory);
            }
        });

        // Check if the category already exists in the serviceCategories array
        if (!dynamicField.serviceCategories.includes(category)) {
            // If not, add the new category
            dynamicField.serviceCategories.push(category);
            await dynamicField.save(); // Save the updated DynamicField document
        }

        // Create the new service
        const service = new Service({
            business: businessFound._id,
            title,
            description,
            category,
            pricing,
            pricingType,
            availability,
            location,
        });

        // Handle multiple image uploads
        if (files && files.length > 0) {
            const imageUrls = await Promise.all(
                files.map(async (file) => {
                    const uploadResult = await uploadOnCloudinary(file.buffer);
                    return uploadResult.url;
                })
            );
            service.images = imageUrls;
        }

        // Save the service
        await service.save();

        // Add the service ID to the business's services array
        businessFound.services.push(service._id);
        await businessFound.save();

        // Return a success response
        res.status(201).json({
            success: true,
            data: service,
            message: "Service Registered Successfully",
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findByIdAndDelete(id);

        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { body, files } = req;

        const updatedData = { ...body };

        // Handle multiple image updates
        if (files && files.length > 0) {
            const imageUrls = await Promise.all(
                files.map(async (file) => {
                    const uploadResult = await uploadOnCloudinary(file.buffer);
                    return uploadResult.url;
                })
            );
            updatedData.images = imageUrls;
        }

        const service = await Service.findByIdAndUpdate(id, updatedData, { new: true });

        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }

        res.status(200).json({
            success: true,
            data: service,
            message: "Service Updated Successfully"
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.getServices = async (req, res) => {
    try {
        const {
            category,
            serviceType,
            location,
            radius,
            minRating,
            minReviews,
            availability,
            minPrice,
            maxPrice,
            pricingType,
            providerTypes,
            certifications,
            minExperience,
            maxExperience,
            sortBy,
            page = 1,
            limit = 20
        } = req.query;

        const pipeline = [];

        // Geospatial Filtering
        if (location && radius) {
            const [latitude, longitude] = location.split(',').map(Number);
            if (isNaN(latitude) || isNaN(longitude)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid location format. Expected "latitude,longitude".'
                });
            }

            pipeline.push({
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    distanceField: "distance",
                    maxDistance: radius * 1000, // Convert km to meters
                    spherical: true,
                    query: { status: 'approved' }
                }
            });
        } else {
            pipeline.push({
                $match: { status: 'approved' }
            });
        }

        // Service-Level Filters
        const serviceMatch = {};

        if (category || serviceType) {
            serviceMatch.category = category || serviceType;
        }

        if (minRating) {
            serviceMatch.ratings = { $gte: Number(minRating) };
        }

        if (minReviews) {
            serviceMatch.$expr = {
                $gte: [{ $size: "$reviews" }, Number(minReviews)]
            };
        }

        if (availability) {
            if (availability === 'immediate') {
                const today = new Date();
                serviceMatch.availability = { $elemMatch: { $gte: today } };
            } else if (availability === 'within_week') {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                serviceMatch.availability = { $elemMatch: { $gte: new Date(), $lte: nextWeek } };
            }
        }

        if (minPrice || maxPrice) {
            serviceMatch['pricing.amount'] = {};
            if (minPrice) serviceMatch['pricing.amount'].$gte = Number(minPrice);
            if (maxPrice) serviceMatch['pricing.amount'].$lte = Number(maxPrice);
        }

        if (pricingType) {
            serviceMatch['pricing.unit'] = pricingType;
        }

        if (Object.keys(serviceMatch).length > 0) {
            pipeline.push({ $match: serviceMatch });
        }

        // Populate Business Details
        pipeline.push({
            $lookup: {
                from: 'businesses',
                localField: 'business',
                foreignField: '_id',
                as: 'business'
            }
        });

        // Unwind to make business data a single document instead of an array
        pipeline.push({ $unwind: "$business" });

        // Apply Business-Level Filters After Lookup and Unwind
        const businessMatch = {};

        if (certifications) {
            const certsArray = certifications.split(',').map(cert => cert.trim());
            businessMatch['business.certifications'] = { $in: certsArray };
        }

        if (minExperience || maxExperience) {
            businessMatch['business.years_of_experience'] = {};
            if (minExperience) businessMatch['business.years_of_experience'].$gte = Number(minExperience);
            if (maxExperience) businessMatch['business.years_of_experience'].$lte = Number(maxExperience);
        }

        if (providerTypes) {
            const typesArray = providerTypes.split(',').map(type => type.trim());
            businessMatch['business.businessType'] = { $in: typesArray };
        }

        if (Object.keys(businessMatch).length > 0) {
            pipeline.push({ $match: businessMatch });
        }

        // Add Additional Fields
        pipeline.push({
            $addFields: {
                numberOfReviews: { $size: "$reviews" },
                averageRating: "$ratings",
                businessNumberOfReviews: { $size: "$business.reviews" },
                businessAverageRating: "$business.ratings"
            }
        });

        // Sorting
        const sortOptions = {
            highest_rating: { ratings: -1 },
            lowest_price: { 'pricing.amount': 1 },
            most_reviewed: { numberOfReviews: -1 },
            newest: { createdAt: -1 }
        };

        if (sortBy && sortOptions[sortBy]) {
            pipeline.push({ $sort: sortOptions[sortBy] });
        } else {
            pipeline.push({ $sort: { createdAt: -1 } });
        }

        // Pagination
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limitNumber });

        // Projection
        pipeline.push({
            $project: {
                title: 1,
                description: 1,
                category: 1,
                pricing: 1,
                availability: 1,
                images: 1,
                location: 1,
                ratings: 1,
                reviews: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
                distance: 1,
                business: {
                    businessName: 1,
                    businessType: 1,
                    years_of_experience: 1,
                    description: 1,
                    logo: 1,
                    banner: 1,
                    location: 1,
                    contact_info: 1,
                    certifications: 1,
                    workingHours: 1,
                    availability: 1,
                    subscriptionPlan: 1,
                    ratings: 1,
                    reviews: 1,
                    noOfOrders: 1
                },
                numberOfReviews: 1,
                averageRating: 1,
                businessNumberOfReviews: 1,
                businessAverageRating: 1
            }
        });

        // Execute Aggregation Pipeline
        const services = await Service.aggregate(pipeline).exec();

        // Count Total Documents for Pagination Metadata
        const totalServices = await Service.aggregate(pipeline.slice(0, -2)).count('count').exec();

        const totalCount = totalServices.length ? totalServices[0].count : 0;

        res.status(200).json({
            success: true,
            count: services.length,
            totalPages: Math.ceil(totalCount / limitNumber),
            currentPage: pageNumber,
            data: services
        });

    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.getService = async (req, res) => {
    try {
        const { id } = req.params
        if (!id) {
            return res.status(401).json({
                success: false,
                message: "Please provide service ID"
            })
        }
        const service = await Service.findById(id).populate('business')
        if (!service) {
            return res.status(404).json({
                success: false,
                message: "service not found"
            })
        }
        return res.status(200).json({
            success: true,
            data: service,
            message: "service fetched Successfully"
        })
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

exports.getServicesByBusiness = async (req, res) => {
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
        const services = await Service.find({
            business: business._id
        })
        if (!services) {
            return res.status(404).json({
                success: false,
                message: "No Services Found"
            })
        }
        return res.status(200).json({
            success: true,
            data: services
        })

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

