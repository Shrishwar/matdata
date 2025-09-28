const mongoose = require('mongoose');
const Result = require('./models/Result');
require('dotenv').config({ path: './.env' });

async function cleanFutureData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matka-platform');
    console.log('Connected to MongoDB');

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const deleted = await Result.deleteMany({ date: { $gt: today } });
    console.log(`Deleted ${deleted.deletedCount} future results.`);

    const remaining = await Result.countDocuments({ date: { $lte: today } });
    console.log(`Remaining valid results: ${remaining}`);

    // Also log latest valid
    const latestValid = await Result.findOne({ date: { $lte: today } }).sort({ date: -1 }).lean();
    if (latestValid) {
      console.log('Latest valid result:', latestValid.date.toISOString().split('T')[0], latestValid.open3, latestValid.middle, latestValid.close3);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error cleaning DB:', error);
  }
}

cleanFutureData();
