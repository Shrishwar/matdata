const mongoose = require('mongoose');
const Result = require('./models/Result');
require('dotenv').config({ path: './.env' });

async function queryLatest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matka-platform');
    console.log('Connected to MongoDB');

    const latestResults = await Result.find()
      .sort({ date: -1 })
      .limit(5)
      .lean();

    console.log('Latest 5 Results from DB:');
    latestResults.forEach((result, index) => {
      console.log(`${index + 1}. Date: ${result.date.toISOString().split('T')[0]}, Open3: ${result.open3}, Middle: ${result.middle}, Close3: ${result.close3}, Double: ${result.double}, Source: ${result.source}`);
    });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error querying DB:', error);
  }
}

queryLatest();
