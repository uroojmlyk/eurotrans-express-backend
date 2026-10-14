// utils/trackingCode.js
const crypto = require('crypto');

// Crockford-ish safe alphabet (no 0/O/1/I to avoid confusion)
const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomString = (length) => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return out;
};

// Public tracking code, e.g. ETX-8F3K9P2Q7L
const generateTrackingCode = () => {
  return `ETX-${randomString(10)}`;
};

// Internal shipment id, e.g. SHP-20260214-7K3Q
const generateShipmentId = () => {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const suffix = randomString(4);
  return `SHP-${yyyy}${mm}${dd}-${suffix}`;
};

module.exports = { generateTrackingCode, generateShipmentId };