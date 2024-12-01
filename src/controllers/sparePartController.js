const SparePart = require('../models/SparePart');

// @desc    Get all spare parts
// @route   GET /api/spare-parts
// @access  Public
exports.getAllSpareParts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    // Add filters if provided in query params
    if (req.query.partType) query.partType = req.query.partType;
    if (req.query.condition) query.condition = req.query.condition;
    if (req.query.locationCountry) query.locationCountry = req.query.locationCountry;
    if (req.query.locationCity) query.locationCity = req.query.locationCity;
    if (req.query.availability) query.availability = req.query.availability;

    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      query.minPrice = {};
      if (req.query.minPrice) query.minPrice.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice) query.minPrice.$lte = parseInt(req.query.maxPrice);
    }

    const spareParts = await SparePart.find(query)
      .populate('supplier', 'businessName email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await SparePart.countDocuments(query);

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
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Get single spare part
// @route   GET /api/spare-parts/:id
// @access  Public
exports.getSparePart = async (req, res) => {
  try {
    const sparePart = await SparePart.findById(req.params.id)
      .populate('supplier', 'businessName email phoneNumber');

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

// @desc    Create new spare part
// @route   POST /api/spare-parts
// @access  Private
exports.createSparePart = async (req, res) => {
  try {
    const sparePart = await SparePart.create({
      ...req.body,
      supplier: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: sparePart
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Update spare part
// @route   PUT /api/spare-parts/:id
// @access  Private
exports.updateSparePart = async (req, res) => {
  try {
    let sparePart = await SparePart.findById(req.params.id);

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        error: 'Spare part not found'
      });
    }

    // Debug logs
    console.log('Spare Part Supplier:', sparePart.supplier);
    console.log('Current User:', req.user.userId);

    // Compare the IDs properly
    const supplierIdString = sparePart.supplier.toString();
    const userIdString = req.user.userId.toString();

    console.log('Supplier ID String:', supplierIdString);
    console.log('User ID String:', userIdString);

    // Compare as strings
    if (supplierIdString !== userIdString) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to update this spare part'
      });
    }

    sparePart = await SparePart.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: sparePart
    });
  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Delete spare part
// @route   DELETE /api/spare-parts/:id
// @access  Private
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

    // Compare the IDs as strings
    const supplierIdString = sparePart.supplier.toString();
    const userIdString = req.user.userId.toString();

    console.log('Supplier ID String:', supplierIdString);
    console.log('User ID String:', userIdString);

    if (supplierIdString !== userIdString) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to delete this spare part'
      });
    }

    await SparePart.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
}; 