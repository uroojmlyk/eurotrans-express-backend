// models/Admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Administrator',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never return by default
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash a plain password (used by createAdmin script)
adminSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

// Compare a plain password with the stored hash
adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('Admin', adminSchema);