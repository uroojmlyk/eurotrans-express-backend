// controllers/authController.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const signToken = (adminId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  return jwt.sign({ sub: adminId.toString() }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    issuer: 'eurotrans-express',
  });
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: cleanEmail }).select(
      '+passwordHash'
    );

    // Same generic message for unknown email or wrong password
    const genericError = {
      success: false,
      message: 'Invalid email or password',
    };

    if (!admin) {
      return res.status(401).json(genericError);
    }

    const ok = await admin.comparePassword(password);
    if (!ok) {
      return res.status(401).json(genericError);
    }

    admin.lastLoginAt = new Date();
    await admin.save({ validateBeforeSave: false });

    const token = signToken(admin._id);

    return res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /api/auth/me   (protected)
const me = async (req, res, next) => {
  try {
    // req.admin is set by protectAdmin middleware
    return res.status(200).json({
      success: true,
      admin: req.admin,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { login, me };