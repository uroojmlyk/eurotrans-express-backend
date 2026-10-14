// routes/parcelRoutes.js
const express = require('express');
const { protectAdmin } = require('../middleware/authMiddleware');
const { trackLimiter } = require('../middleware/rateLimiters');
const {
  createParcel,
  listParcels,
  getParcel,
  updateStatus,
  trackParcel,
} = require('../controllers/parcelController');

// ---------- Admin router (mounted at /api/parcels) ----------
const adminRouter = express.Router();

adminRouter.use(protectAdmin);

adminRouter.post('/', createParcel);
adminRouter.get('/', listParcels);
adminRouter.get('/:id', getParcel);
adminRouter.patch('/:id/status', updateStatus);

// ---------- Public router (mounted at /api/track) ----------
const publicRouter = express.Router();

publicRouter.get('/:code', trackLimiter, trackParcel);

module.exports = { adminRouter, publicRouter };