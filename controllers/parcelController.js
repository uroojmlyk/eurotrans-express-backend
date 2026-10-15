// controllers/parcelController.js
const Parcel = require('../models/Parcel');
const {
  generateTrackingCode,
  generateShipmentId,
} = require('../utils/trackingCode');

const STATUSES = Parcel.STATUSES;
const PUBLIC_FIELDS = Parcel.PUBLIC_FIELDS;

// ---------- helpers ----------
const pickContact = (c) => {
  if (!c || typeof c !== 'object') return null;
  const out = {
    name: typeof c.name === 'string' ? c.name.trim() : '',
    phone: typeof c.phone === 'string' ? c.phone.trim() : '',
    email: typeof c.email === 'string' ? c.email.trim().toLowerCase() : '',
    address: typeof c.address === 'string' ? c.address.trim() : '',
    city: typeof c.city === 'string' ? c.city.trim() : '',
    country: typeof c.country === 'string' ? c.country.trim() : '',
  };
  if (!out.name) return null;
  return out;
};

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ---------- admin: create parcel ----------
// POST /api/parcels
const createParcel = async (req, res, next) => {
  try {
    const b = req.body || {};

    const sender = pickContact(b.sender);
    const recipient = pickContact(b.recipient);

    if (!sender) {
      return res
        .status(400)
        .json({ success: false, message: 'Valid sender is required' });
    }
    if (!recipient) {
      return res
        .status(400)
        .json({ success: false, message: 'Valid recipient is required' });
    }

    const origin = typeof b.origin === 'string' ? b.origin.trim() : '';
    const destination =
      typeof b.destination === 'string' ? b.destination.trim() : '';

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination are required',
      });
    }

    // Retry a few times in the unlikely event of a collision
    const MAX_TRIES = 3;
    let lastErr = null;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const trackingCode = generateTrackingCode();
      const shipmentId = generateShipmentId();

      try {
        const parcel = await Parcel.create({
          trackingCode,
          shipmentId,
          status: 'Registered',
          sender,
          recipient,
          origin,
          destination,
          parcelType:
            typeof b.parcelType === 'string' && b.parcelType.trim()
              ? b.parcelType.trim()
              : 'Parcel',
          serviceType:
            typeof b.serviceType === 'string' && b.serviceType.trim()
              ? b.serviceType.trim()
              : 'Standard',
          weightKg: toNumberOrNull(b.weightKg),
          pieces:
            Number.isFinite(Number(b.pieces)) && Number(b.pieces) >= 1
              ? Math.floor(Number(b.pieces))
              : 1,
          description:
            typeof b.description === 'string' ? b.description.trim() : '',
          history: [
            {
              status: 'Registered',
              location: origin,
              note:
                typeof b.note === 'string' && b.note.trim()
                  ? b.note.trim()
                  : 'Parcel registered',
              at: new Date(),
            },
          ],
        });

        return res.status(201).json({
          success: true,
          message: 'Parcel registered',
          parcel,
        });
      } catch (err) {
        lastErr = err;
        // 11000 = duplicate key
        if (err && err.code === 11000) continue;
        throw err;
      }
    }

    // If we reach here, we exhausted retries on duplicate keys
    return next(lastErr || new Error('Failed to generate unique identifiers'));
  } catch (err) {
    return next(err);
  }
};

// ---------- admin: list parcels ----------
// GET /api/parcels?page=1&limit=20&status=In%20Transit&q=ETX-...
const listParcels = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitRaw = parseInt(req.query.limit, 10) || 20;
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      const s = String(req.query.status).trim();
      if (!STATUSES.includes(s)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid status filter' });
      }
      filter.status = s;
    }

    if (req.query.q) {
      const q = String(req.query.q).trim();
      if (q) {
        // Escape regex metachars to avoid ReDoS
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(safe, 'i');
        filter.$or = [
          { trackingCode: rx },
          { shipmentId: rx },
          { 'sender.name': rx },
          { 'recipient.name': rx },
          { origin: rx },
          { destination: rx },
        ];
      }
    }

    const [items, total] = await Promise.all([
      Parcel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Parcel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      items,
    });
  } catch (err) {
    return next(err);
  }
};

// ---------- admin: get one parcel ----------
// GET /api/parcels/:id
const getParcel = async (req, res, next) => {
  try {
    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) {
      return res
        .status(404)
        .json({ success: false, message: 'Parcel not found' });
    }
    return res.status(200).json({ success: true, parcel });
  } catch (err) {
    return next(err);
  }
};

// ---------- admin: update status ----------
// PATCH /api/parcels/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, note, location } = req.body || {};

    if (typeof status !== 'string' || !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${STATUSES.join(', ')}`,
      });
    }

    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) {
      return res
        .status(404)
        .json({ success: false, message: 'Parcel not found' });
    }

    if (parcel.status === status) {
      return res.status(200).json({
        success: true,
        message: 'Status unchanged',
        parcel,
      });
    }

    parcel.status = status;
    parcel.history.push({
      status,
      location:
        typeof location === 'string' ? location.trim().slice(0, 200) : '',
      note: typeof note === 'string' ? note.trim().slice(0, 300) : '',
      at: new Date(),
    });

    await parcel.save();

    return res.status(200).json({
      success: true,
      message: 'Status updated',
      parcel,
    });
  } catch (err) {
    return next(err);
  }
};

// ---------- public: track parcel ----------
// GET /api/track/:code
const trackParcel = async (req, res, next) => {
  try {
    const raw = String(req.params.code || '').trim().toUpperCase();
    if (!raw || raw.length < 6 || raw.length > 40) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid tracking code' });
    }

    const parcel = await Parcel.findOne({ trackingCode: raw }).select(
      PUBLIC_FIELDS
    );

    if (!parcel) {
      return res
        .status(404)
        .json({ success: false, message: 'No shipment found for this code' });
    }

    // Sort history ascending for a clean timeline
    const history = Array.isArray(parcel.history)
      ? [...parcel.history].sort((a, b) => new Date(a.at) - new Date(b.at))
      : [];

    return res.status(200).json({
      success: true,
      trackingCode: parcel.trackingCode,
      shipmentId: parcel.shipmentId,
      status: parcel.status,
      origin: parcel.origin,
      destination: parcel.destination,
      parcelType: parcel.parcelType,
      serviceType: parcel.serviceType,
      pieces: parcel.pieces,
      weightKg: parcel.weightKg,
      description: parcel.description,
      recipient: parcel.recipient
        ? {
            name: parcel.recipient.name,
            city: parcel.recipient.city,
            country: parcel.recipient.country,
          }
        : undefined,
      history,
      createdAt: parcel.createdAt,
      updatedAt: parcel.updatedAt,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createParcel,
  listParcels,
  getParcel,
  updateStatus,
  trackParcel,
};