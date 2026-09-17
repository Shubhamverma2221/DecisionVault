/**
 * Middleware to intercept requests targeting undefined routes.
 * Creates an error and passes it down to the centralized errorHandler.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route Not Found: [${req.method}] ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Centralized Error-Handling Middleware for Express.
 * Express identifies this as an error handler because it accepts exactly 4 arguments: (err, req, res, next).
 * Intercepts Mongoose errors, CastErrors, validation issues, and uncaught exceptions.
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;

  // Log error stack trace to server console for server-side debugging
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);

  // 1. Mongoose Bad ObjectId (CastError)
  // Occurs when querying by an ID that does not conform to the 24-character hex format
  if (err.name === 'CastError') {
    const message = `Resource not found. Invalid ID format: ${err.value}`;
    return res.status(404).json({
      success: false,
      error: message
    });
  }

  // 2. Mongoose Schema Validation Error
  // Occurs when a document violates required, enum, or custom schema validators
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join('; ');
    return res.status(400).json({
      success: false,
      error: message
    });
  }

  // 3. Mongoose Duplicate Key Error (Code 11000)
  // Occurs if a field with a unique index receives a duplicate value
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value entered for field: "${field}". Must be unique.`;
    return res.status(400).json({
      success: false,
      error: message
    });
  }

  // 4. Fallback Generic Server Error
  // Use existing status code if already set (e.g. 404, 401, 403), otherwise default to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal Server Error',
    // In development mode, include the stack trace for fast debugging; hide in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { notFound, errorHandler };
