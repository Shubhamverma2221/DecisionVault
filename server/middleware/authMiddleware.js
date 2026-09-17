const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware: Validates Bearer JWT and attaches req.user
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this resource. No authentication token provided.'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'decisionvault_jwt_fallback_secret_key_2026';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. The user account no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Not authorized. Token has expired or is invalid.'
    });
  }
};

module.exports = { protect };
