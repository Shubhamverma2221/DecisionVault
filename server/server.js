const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables from .env file at the earliest entry point
dotenv.config();

// Connect to MongoDB Database
connectDB();

// Initialize the Express application
const app = express();

// =========================================
// Global Middleware Configuration
// =========================================

// 1. Enable Cross-Origin Resource Sharing (CORS) so the browser allows client requests
app.use(cors());

// 2. Parse incoming JSON payloads and attach the parsed object to req.body
app.use(express.json());

// 3. Parse URL-encoded payloads from standard HTML form submissions
app.use(express.urlencoded({ extended: true }));

// 4. Serve static frontend files (HTML, CSS, JS) from the client folder
app.use(express.static(path.join(__dirname, '../client')));

// =========================================
// Base / Health Check Routes
// =========================================

const { notFound, errorHandler } = require('./middleware/errorHandler');

// Health check endpoint to verify that the server is alive and responding
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'DecisionVault API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Mount decision routes under /api/decisions
const decisionRoutes = require('./routes/decisionRoutes');
app.use('/api/decisions', decisionRoutes);

// =========================================
// Error Handling Middleware
// =========================================

// Catch 404 for undefined routes and forward to error handler
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

// =========================================
// Server Initialization
// =========================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` DecisionVault Server Running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});

module.exports = { app, server };
