require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');
const moment = require('moment');

const generateSampleData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matka-platform', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Clear existing results
    await Result.deleteMany({});
    console.log('Cleared existing results');
    
    // Generate sample data for the last 200 days
    const sampleResults = [];
    const startDate = moment().subtract(200, 'days');
    
    for (let i = 0; i < 200; i++) {
      const date = startDate.clone().add(i, 'days');
      
      // Skip weekends (Saturday and Sunday)
      if (date.day() === 0 || date.day() === 6) {
        continue;
      }
      
      // Generate random but realistic matka numbers
      const open3d = Math.floor(Math.random() * 900 + 100).toString();
      const close3d = Math.floor(Math.random() * 900 + 100).toString();
      const middle = Math.floor(Math.random() * 900 + 100).toString();
      const double = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      
      const openSum = parseInt(open3d[0]) + parseInt(open3d[1]) + parseInt(open3d[2]);
      const closeSum = parseInt(close3d[0]) + parseInt(close3d[1]) + parseInt(close3d[2]);
      
      sampleResults.push({
        panel: 'MAIN_BAZAR',
        session: 'NIGHT',
        drawId: `MB_${date.format('YYYYMMDD')}`,
        datetime: date.toDate(),
        date: date.toDate(),
        open3d: open3d,
        close3d: close3d,
        middle: middle,
        double: double,
        openSum: openSum,
        closeSum: closeSum,
        rawSource: 'sample_data',
        sourceUrl: 'https://sample.com',
        fetchedAt: date.toDate(),
        isEstimated: false
      });
    }
    
    // Insert sample data
    await Result.insertMany(sampleResults);
    console.log(`Generated ${sampleResults.length} sample results for the last 200 days`);
    
    console.log('Sample data generation completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error generating sample data:', error);
    process.exit(1);
  }
};

generateSampleData();
