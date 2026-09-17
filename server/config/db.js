const mongoose = require('mongoose');

/**
 * Establishes connection to MongoDB using Mongoose ODM.
 * Reads connection URI from process.env.MONGODB_URI.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

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
    });

    return conn;
  } catch (error) {
    console.error(`=========================================`);
    console.error(` Error connecting to MongoDB: ${error.message}`);
    console.error(` Verify that MongoDB is running and MONGODB_URI in .env is correct.`);
    console.error(`=========================================`);
    // Exit process with failure code (1) if initial database connection fails
    process.exit(1);
  }
};

module.exports = connectDB;
