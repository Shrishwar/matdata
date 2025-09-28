require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');
const User = require('./models/User');

// Generate a random 3-digit number as string
const random3Digit = () => Math.floor(100 + Math.random() * 900).toString();

// Generate a random 2-digit number as string
const random2Digit = () => Math.floor(10 + Math.random() * 90).toString().padStart(2, '0');

// Generate sample results
const generateSampleResults = (count = 30) => {
  const results = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    results.push({
      date,
      open3: random3Digit(),
      close3: random3Digit(),
      middle: random2Digit(),
      double: random2Digit()
    });
  }
  
  return results;
};

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Clear existing data
    await Result.deleteMany({});
    console.log('Cleared existing results');
    
    // Generate and insert sample results
    const sampleResults = generateSampleResults(30);
    await Result.insertMany(sampleResults);
    console.log(`Inserted ${sampleResults.length} sample results`);
    
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
