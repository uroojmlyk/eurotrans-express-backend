// models/Parcel.js
const mongoose = require('mongoose');

const STATUSES = [
  'Registered',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'On Hold',
];

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
    },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    country: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    location: { type: String, trim: true, maxlength: 200, default: '' },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const parcelSchema = new mongoose.Schema(
  {
    shipmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    trackingCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'Registered',
      index: true,
    },

    sender: { type: contactSchema, required: true },
    recipient: { type: contactSchema, required: true },

    origin: { type: String, required: true, trim: true, maxlength: 120 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },

    parcelType: { type: String, trim: true, maxlength: 80, default: 'Parcel' },
    serviceType: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Standard',
    },
    weightKg: { type: Number, min: 0, default: null },
    pieces: { type: Number, min: 1, default: 1 },
    description: { type: String, trim: true, maxlength: 500, default: '' },

    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

// Expose statuses for controllers / validation
parcelSchema.statics.STATUSES = STATUSES;

// Fields safe to return on the PUBLIC tracking endpoint
parcelSchema.statics.PUBLIC_FIELDS = [
  'trackingCode',
  'shipmentId',
  'status',
  'origin',
  'destination',
  'parcelType',
  'serviceType',
  'pieces',
  'weightKg',
  'description',
  'history',
  'createdAt',
  'updatedAt',
  'recipient.name',
  'recipient.city',
  'recipient.country',
].join(' ');

module.exports = mongoose.model('Parcel', parcelSchema);