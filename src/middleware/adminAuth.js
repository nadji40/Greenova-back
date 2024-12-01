const adminAuth = async (req, res, next) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error checking admin privileges'
    });
  }
};

module.exports = adminAuth; 