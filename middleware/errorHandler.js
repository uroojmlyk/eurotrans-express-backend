// middleware/errorHandler.js
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  // Defaults
  let statusCode = res.statusCode && res.statusCode >= 400 ? res.statusCode : 500;
  let message = err.message || 'Something went wrong';
  let errors = null;

  // Mongoose: invalid ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid identifier format';
  }

  // Mongoose: validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = 'Validation failed';
  }

  // Mongo: duplicate key (unique index)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }

  // JWT (in case thrown outside authMiddleware)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired, please login again';
  }

  const isProd = process.env.NODE_ENV === 'production';

  // Log server errors (never log secrets/passwords — we only log the message)
  if (statusCode >= 500) {
    console.error('[ERROR]', err.message);
  }

  const body = {
    success: false,
    message,
  };
  if (errors) body.errors = errors;
  if (!isProd && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };