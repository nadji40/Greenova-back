const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    console.log('Headers:', req.headers);  // Debug: Log all headers
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Extracted Token:', token); // Debug: Log the extracted token

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access denied. Token is missing.' });
    }

    // Verify token
    const decoded = jwt.verify(token, "jwtsecret");
    console.log('Decoded Token:', decoded); // Debug: Log decoded token

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. User not found.'
      });
    }

    // Add user info to request
    req.user = {
      userId: user._id,
      email: user.email,
      userType: user.userType
    };

    next();
  } catch (error) {
    console.error('Authentication Error:', error); // Log any errors that occur during authentication
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

module.exports = auth;
