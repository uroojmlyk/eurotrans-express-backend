// middleware/rateLimiters.js
const rateLimit = require('express-rate-limit');

const jsonHandler = (message) => (req, res, next, options) => {
  res.status(options.statusCode).json({ success: false, message });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler('Too many login attempts. Please try again later.'),
});

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 tracking lookups per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler('Too many tracking requests. Please slow down.'),
});

module.exports = { loginLimiter, trackLimiter };