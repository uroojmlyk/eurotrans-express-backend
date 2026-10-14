// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectAdmin = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ success: false, message: 'Authorization token missing' });
    }

    const token = header.slice(7).trim();
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'Authorization token missing' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Fail loud in dev, generic in prod
      console.error('JWT_SECRET is not configured');
      return res
        .status(500)
        .json({ success: false, message: 'Server auth is not configured' });
    }

    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError'
          ? 'Session expired, please login again'
          : 'Invalid authentication token';
      return res.status(401).json({ success: false, message: msg });
    }

    if (!payload || !payload.sub) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid authentication token' });
    }

    // Always re-check the admin in the DB; never trust token alone for role.
    const admin = await Admin.findById(payload.sub).select('name email role');
    if (!admin) {
      return res
        .status(401)
        .json({ success: false, message: 'Admin account no longer exists' });
    }

    req.admin = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { protectAdmin };