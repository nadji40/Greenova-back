const Service = require('../models/Service');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

// Create a new booking
exports.createBookings = async (req, res) => {
    try {
        const { serviceId, businessId, bookingDate, description, paymentMethod } = req.body;

        const requiredFields = { serviceId, bookingDate, description, paymentMethod };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value) // Find any field that is falsy or empty
            .map(([key, _]) => key);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `${missingFields.join(', ')} is required`
            });
        }

        if (!serviceId) {
            return res.status(400).json({
                success: false,
                error: 'Service ID is required'
            });
        }

        // Validate service exists and is approved
        const service = await Service.findOne({
            _id: serviceId,  // Use ObjectId conversion here
            status: 'approved'
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found or not available'
            });
        }

        // Create booking
        const booking = new Booking({
            user: req.user.userId,
            service: serviceId,
            business: businessId,
            bookingDate: new Date(bookingDate),  // MongoDB will handle this as UTC
            description,
            paymentMethod,
            status: 'pending',
            paymentStatus: 'pending'
        });

        await booking.save();

        // Populate user
        const populatedBooking = await booking.populate('user');

        // Populate service and business within service
        await populatedBooking.populate({
            path: 'service',
            populate: {
                path: 'business',  // Populate business within the service
                model: 'Business'  // Replace with your actual Business model name
            }
        });

        res.status(201).json({
            success: true,
            data: populatedBooking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get user's bookings
exports.getBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        // Build filter
        const filter = { user: req.user.userId };
        if (status) {
            filter.status = status;
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Fetch bookings with pagination and sorting
        const bookings = await Booking.find(filter)
            .populate('service')
            .populate('business')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        // Count total number of bookings matching the filter
        const total = await Booking.countDocuments(filter);

        // Send response
        res.status(200).json({
            success: true,
            data: bookings,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: Number(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching bookings'
        });
    }
}

// Cancel booking
exports.cancellBooking = async (req, res) => {
    try {
        const booking = await Booking.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user.userId,
                status: 'pending'
            },
            { status: 'cancelled' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found or cannot be cancelled'
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            error: 'Error cancelling booking'
        });
    }
}

exports.getBusinessBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        console.log("businessId", req.params.id)
        // Build filter
        const filter = { business: req.params.id };
        if (status) {
            filter.status = status;
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Fetch bookings with pagination and sorting
        const bookings = await Booking.find(filter)
            .populate('service')
            .populate('business')
            .populate('user', "fullName email")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        // Count total number of bookings matching the filter
        const total = await Booking.countDocuments(filter);

        // Send response
        res.status(200).json({
            success: true,
            data: bookings,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: Number(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching bookings'
        });
    }
}
