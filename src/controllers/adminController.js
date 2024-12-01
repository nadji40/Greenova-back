const Service = require('../models/Service');

exports.getPendingServices = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pendingServices = await Service.find({ status: 'pending' })
            .populate('serviceProvider', 'businessName email')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Service.countDocuments({ status: 'pending' });

        res.status(200).json({
            success: true,
            data: pendingServices,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching pending services:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching pending services'
        });
    }
};

exports.approveService = async (req, res) => {
 
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            { status: 'approved' },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }
        console.log(service)
        res.status(200).json({
            success: true,
            data: service
        });
  
};

exports.rejectService = async (req, res) => {
    try {
        const { reason } = req.body;
        
        if (!reason) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required'
            });
        }

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            { 
                status: 'rejected',
                rejectionReason: reason 
            },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'Service not found'
            });
        }

        res.status(200).json({
            success: true,
            data: service
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error rejecting service'
        });
    }
};
