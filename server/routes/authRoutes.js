const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  loginGuest,
  googleAuth,
  getGoogleClientId,
  getMe,
  convertGuestToAccount
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/guest', loginGuest);
router.post('/google', googleAuth);
router.get('/google/client-id', getGoogleClientId);
router.get('/me', protect, getMe);
router.post('/convert-guest', protect, convertGuestToAccount);
router.put('/convert-guest', protect, convertGuestToAccount);

module.exports = router;
