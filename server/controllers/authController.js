const User = require('../models/User');
const Decision = require('../models/Decision');

/**
 * @desc    Register a new user account
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password'
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists'
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      authProvider: 'local',
      isGuest: false
    });

    const token = user.generateToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isGuest: user.isGuest,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & return token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password'
      });
    }

    // Find user and explicitly include password field
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. No account found with this email.'
      });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Incorrect password.'
      });
    }

    const token = user.generateToken();

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isGuest: user.isGuest,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Initialize an instant ephemeral guest session
 * @route   POST /api/auth/guest
 * @access  Public
 */
const loginGuest = async (req, res, next) => {
  try {
    const guestNonce = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const guestEmail = `guest_${guestNonce}@decisionvault.local`;

    const user = await User.create({
      name: 'Guest Explorer',
      email: guestEmail,
      authProvider: 'guest',
      isGuest: true
    });

    const token = user.generateToken();

    res.status(201).json({
      success: true,
      message: 'Guest session created successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isGuest: user.isGuest,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate or register via Google OAuth
 * @route   POST /api/auth/google
 * @access  Public
 */
const googleAuth = async (req, res, next) => {
  try {
    let { googleId, email, name, credential } = req.body;

    // Decode Google ID Token if passed from official Google Identity Services
    if (credential) {
      try {
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          Buffer.from(base64, 'base64')
            .toString('utf-8')
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const googleUser = JSON.parse(jsonPayload);
        googleId = googleUser.sub;
        email = googleUser.email;
        name = googleUser.name || googleUser.given_name || 'Google User';
      } catch (err) {
        console.error('Failed to parse Google ID token credential:', err.message);
      }
    }

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Google profile information (email and name) is required'
      });
    }

    // Check if user already exists by googleId or email
    let user = await User.findOne({
      $or: [
        { googleId: googleId || 'nonexistent' },
        { email: email.toLowerCase().trim() }
      ]
    });

    if (user) {
      // If user exists by email but not googleId, link googleId
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        await user.save();
      }
    } else {
      // Create new Google account
      user = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        googleId: googleId || `g_${Date.now()}`,
        authProvider: 'google',
        isGuest: false
      });
    }

    const token = user.generateToken();

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isGuest: user.isGuest,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Google OAuth Client ID for frontend GSI button
 * @route   GET /api/auth/google/client-id
 * @access  Public
 */
const getGoogleClientId = async (req, res) => {
  res.status(200).json({
    success: true,
    clientId: process.env.GOOGLE_CLIENT_ID || ''
  });
};

/**
 * @desc    Get currently logged in user profile & personal decision statistics
 * @route   GET /api/auth/me
 * @access  Private (Protected)
 */
const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    // Fetch personal decision counts for user profile
    const totalDecisions = await Decision.countDocuments({ userId: user._id });
    const reviewedDecisions = await Decision.countDocuments({
      userId: user._id,
      'review.result': { $ne: null }
    });
    const achievedDecisions = await Decision.countDocuments({
      userId: user._id,
      'review.result': 'Achieved'
    });

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isGuest: user.isGuest,
        createdAt: user.createdAt,
        stats: {
          totalDecisions,
          reviewedDecisions,
          achievedDecisions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Convert temporary guest account to permanent registered account
 * @route   POST /api/auth/convert-guest
 * @access  Private (Protected - Guest only)
 */
const convertGuestToAccount = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.isGuest) {
      return res.status(400).json({
        success: false,
        error: 'This account is already a permanent registered account'
      });
    }

    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password to upgrade your account'
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Verify email is not already taken by another user
    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: user._id }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists'
      });
    }

    // Upgrade guest user in-place: all user._id references across decisions are preserved!
    user.name = name.trim();
    user.email = email.toLowerCase().trim();
    user.password = password; // Will be hashed by pre('save') hook
    user.isGuest = false;
    user.authProvider = 'local';

    await user.save();

    const token = user.generateToken();

    res.status(200).json({
      success: true,
      message: 'Guest account successfully converted to permanent account! All decisions preserved.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        isGuest: user.isGuest,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  loginGuest,
  googleAuth,
  getGoogleClientId,
  getMe,
  convertGuestToAccount
};
