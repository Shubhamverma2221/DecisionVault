const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false // Exclude from queries by default for security
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'guest'],
      default: 'local'
    },
    googleId: {
      type: String,
      sparse: true
    },
    isGuest: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Hash user password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered plaintext password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate signed JSON Web Token (JWT)
userSchema.methods.generateToken = function () {
  const secret = process.env.JWT_SECRET || 'decisionvault_jwt_fallback_secret_key_2026';
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      isGuest: this.isGuest
    },
    secret,
    {
      expiresIn: '30d'
    }
  );
};

module.exports = mongoose.model('User', userSchema);
