// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const { adminRouter, publicRouter } = require('./routes/parcelRoutes');

// ---------- env ----------
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Comma-separated list in .env, e.g.
// CORS_ORIGINS=http://localhost:5173,https://eurotrans-express.vercel.app
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0 && NODE_ENV === 'production') {
  console.error('❌ CORS_ORIGINS must be set in production');
  process.exit(1);
}

const app = express();

// ---------- global middleware ----------
app.set('trust proxy', 1); // correct client IP behind Render/proxies

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser tools (Postman, curl) when origin is undefined
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// basic request logger (no bodies, no tokens)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`
    );
  });
  next();
});

// ---------- health ----------
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.status(200).json({
    success: true,
    status: 'ok',
    env: NODE_ENV,
    db: dbState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// ---------- routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/parcels', adminRouter);
app.use('/api/track', publicRouter);

// ---------- 404 + errors ----------
app.use(notFound);
app.use(errorHandler);

// ---------- startup ----------
const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Eurotrans Express backend running on port ${PORT}`);
    console.log(`   Env: ${NODE_ENV}`);
    console.log(`   Allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
  });

  // graceful shutdowns
  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('✅ Server and DB connection closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason && reason.message ? reason.message : reason);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    process.exit(1);
  });
};

start();