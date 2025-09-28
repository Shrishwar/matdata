require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const cron = require('node-cron');
const { scrapeLatest, getLiveExtracted } = require('./services/scraper/dpbossScraper');
const { apiLimiter, scrapeLimiter, authLimiter } = require('./middleware/rateLimit');

// Import routes
const authRoutes = require('./routes/auth');
const { router: resultRoutes, broadcastLatestUpdate } = require('./routes/results');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/api', apiLimiter); // General API rate limit
app.use('/api/results/fetch-latest', scrapeLimiter); // Stricter for scraping
app.use('/api/results/scrape-history', scrapeLimiter); // Stricter for scraping
app.use('/api/auth', authLimiter); // Stricter for auth

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/results', resultRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Matka Platform API is running in development mode');
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');

    // Create admin user if it doesn't exist
    await createAdminUser();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // process.exit(1); // Comment out to allow server to run without DB
  }
};

// Create admin user if it doesn't exist
const createAdminUser = async () => {
  try {
    const User = require('./models/User');
    const adminUser = await User.findOne({});
    
    if (!adminUser && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const user = new User({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        isAdmin: true
      });
      
      await user.save();
      console.log('Admin user created successfully');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
});

const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    // Store previous latest for change detection
    let previousLatest = null;

    // Schedule scrape every 60 seconds
    cron.schedule('*/1 * * * *', async () => {
      try {
        const latest = await scrapeLatest();
        console.log('Cron scrape completed:', latest.date);

        // Check if there's a change
        const hasChanged = !previousLatest ||
          previousLatest.date.getTime() !== latest.date.getTime() ||
          previousLatest.open3 !== latest.open3 ||
          previousLatest.middle !== latest.middle ||
          previousLatest.close3 !== latest.close3 ||
          previousLatest.double !== latest.double;

        if (hasChanged) {
          console.log('Change detected, broadcasting update');
          previousLatest = latest;

          // Generate guesses
          const { getLiveExtracted } = require('./services/scraper/dpbossScraper');
          const liveScraped = await getLiveExtracted();
          const liveMatch = latest.date.toDateString() === liveScraped.date.toDateString() &&
                            latest.open3 === liveScraped.open3 &&
                            latest.middle === liveScraped.middle &&
                            latest.close3 === liveScraped.close3 &&
                            latest.double === liveScraped.double;

          let liveHtmlSnippet = '';
          if (!liveMatch) {
            liveHtmlSnippet = `Date range row text: ${liveScraped.date} - Open: ${liveScraped.open3}, Middle: ${liveScraped.middle}, Close: ${liveScraped.close3}, Double: ${liveScraped.double}`;
          }

          // Get guesses (simplified, without backtest)
          const Result = require('./models/Result');
          const history = await Result.find().sort({ date: -1 }).limit(100);
          const guesses = generateSimpleGuesses(history, latest.double);

          // Broadcast to SSE clients
          broadcastLatestUpdate(latest, guesses, liveMatch, liveHtmlSnippet);
        }
      } catch (error) {
        console.error('Cron scrape failed:', error);
      }
    });

    // Simple guess generation for cron (subset of full logic)
    function generateSimpleGuesses(history, prevDouble) {
      if (history.length < 10) return [];

      const doubleFreq = {};
      for (let i = 0; i < 100; i++) doubleFreq[i.toString().padStart(2, '0')] = 0;
      history.forEach(r => doubleFreq[r.double.padStart(2, '0')]++);

      const maxFreq = Math.max(...Object.values(doubleFreq));
      const guesses = [];
      for (let t = 0; t < 10; t++) {
        for (let u = 0; u < 10; u++) {
          const dbl = `${t}${u}`;
          const score = maxFreq > 0 ? (doubleFreq[dbl] / maxFreq) * 100 : 0;
          guesses.push({ double: dbl, score });
        }
      }

      return guesses
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(g => ({ double: g.double, confidence: Math.round(g.score) + '%' }));
    }

    console.log('Cron job scheduled for scrape every 60 seconds');

    module.exports = server; // For testing
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
