const mongoose = require('mongoose');
const { scrapeHistory } = require('./services/scraper/dpbossScraper');
require('dotenv').config({ path: './.env' });

async function runScrape() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matka-platform');
    console.log('Connected to MongoDB for scrape');

    const count = await scrapeHistory();
    console.log(`Scrape completed: ${count} results processed.`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Scrape error:', error);
  }
}

runScrape();
