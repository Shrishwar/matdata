const mongoose = require('../backend/node_modules/mongoose');
const Result = require('../backend/models/Result');
const { scrapeHistory } = require('../backend/services/scraper/dpbossScraper');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/matka-platform', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Check if data already exists
    const count = await Result.countDocuments();
    if (count > 0) {
      console.log(`Database already has ${count} results. Skipping seed.`);
      return;
    }

    console.log('Seeding historical data...');
    const scrapedCount = await scrapeHistory();
    console.log(`Seeded ${scrapedCount} results`);

    // Populate analysis records
    console.log('Populating analysis records...');
    const featurizer = require('../backend/services/featurizer');
    await featurizer.populateAnalysisRecords();
    console.log('Analysis records populated');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedDatabase();
