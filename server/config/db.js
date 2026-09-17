const mongoose = require('mongoose');

/**
 * Establishes connection to MongoDB using Mongoose ODM.
 * Reads connection URI from process.env.MONGODB_URI.
 */
let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;

    console.log(`=========================================`);
    console.log(` MongoDB Connected Successfully!`);
    console.log(` Host: ${conn.connection.host}`);
    console.log(` Database: ${conn.connection.name}`);
    console.log(` Port: ${conn.connection.port}`);
    console.log(`=========================================`);

    // Listen for runtime connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB runtime connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB connection lost. Attempting reconnection...');
      isConnected = false;
    });

    return conn;
  } catch (error) {
    console.error(`=========================================`);
    console.error(` Error connecting to MongoDB: ${error.message}`);
    console.error(` Verify that MongoDB is running and MONGODB_URI in .env is correct.`);
    console.error(`=========================================`);
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
