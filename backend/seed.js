require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');
const User = require('./models/User');
const { scrapeHistory } = require('./services/scraper/dpbossScraper');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Clear existing results to remove any random data
    await Result.deleteMany({});
    console.log('Cleared existing results from database');
    
    // Always scrape real DPBoss history
    console.log('Scraping real DPBoss history...');
    const scrapedCount = await scrapeHistory();
    console.log(`Scraped ${scrapedCount} real results from DPBoss`);
    
    // Create admin user if it doesn't exist
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      const user = new User({
        username: 'admin',
        password: 'admin123',
        isAdmin: true
      });
      
      await user.save();
      console.log('Created admin user (username: admin, password: admin123)');
    } else {
      console.log('Admin user already exists');
    }
    
    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
