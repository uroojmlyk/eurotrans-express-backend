// routes/authRoutes.js
const express = require('express');
const { login, me } = require('../controllers/authController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// GET /api/auth/me  (protected)
router.get('/me', protectAdmin, me);

module.exports = router;