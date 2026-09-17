const app = require('../server/server');
const connectDB = require('../server/config/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Vercel Serverless Error] Failed to connect to MongoDB:', err.message);
  }
  return app(req, res);
};
