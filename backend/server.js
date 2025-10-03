require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const cron = require('node-cron');
const { scrapeLatest, getLiveExtracted } = require('./services/scraper/dpbossScraper');
const DpbossSync = require('./services/dpbossSync');
const { apiLimiter, scrapeLimiter, authLimiter } = require('./middleware/rateLimit');
const WebSocket = require('ws');

// Import routes
const authRoutes = require('./routes/auth');
const { router: resultRoutes, broadcastLatestUpdate } = require('./routes/results');
const predictionRoutes = require('./routes/predictions');
const panelsRoutes = require('./routes/panels');
const logsRoutes = require('./routes/logs');
const historyRoutes = require('./routes/history');

const app = express();

module.exports = app; // Export for testing

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Rate limiting
app.use('/api', apiLimiter); // General API rate limit
app.use('/api/results/fetch-latest', scrapeLimiter); // Stricter for scraping
app.use('/api/results/scrape-history', scrapeLimiter); // Stricter for scraping
app.use('/api/auth', authLimiter); // Stricter for auth

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/panels', panelsRoutes);
app.use('/api', historyRoutes);

// GET /api/history - returns sorted draws from DB (last 200 days)
app.get('/api/history', async (req, res) => {
  try {
    const Result = require('./models/Result');
    const moment = require('moment');
    const panel = (req.query.panel || 'MAIN_BAZAR').toUpperCase();
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    
    // Calculate date 200 days ago
    const twoHundredDaysAgo = moment().subtract(200, 'days').toDate();
    
    const results = await Result.find({ 
      panel,
      date: { $gte: twoHundredDaysAgo }
    })
    .sort({ date: -1 })
    .limit(limit)
    .lean();
    
    // Transform results to match frontend expectations
    const history = results.map(r => ({
      _id: r._id,
      date: r.date,
      open3: r.open3d || r.open3,
      close3: r.close3d || r.close3,
      middle: r.middle,
      double: r.double,
      openSum: r.openSum,
      closeSum: r.closeSum,
    }));
    
    res.json({ history, total: history.length });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
});

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

const Result = require('./models/Result');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');

    // Initial full scrape if low data
    const existingCount = await Result.countDocuments();
    if (existingCount < 10) {
      console.log('Low data in DB, performing initial full scrape from DPBoss...');
      const { scrapeHistory } = require('./services/scraper/dpbossScraper');
      const scrapedCount = await scrapeHistory();
      console.log(`Initial scrape completed: ${scrapedCount} real results added`);
    } else {
      console.log(`DB has sufficient data (${existingCount} records), skipping initial full scrape`);
    }

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

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please kill the process using this port or use a different port.`);
        console.error(`On Windows, you can run: netstat -ano | findstr :${PORT}`);
        console.error(`Then kill the process with: taskkill /PID <PID> /F`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
      }
    });

    // WebSocket server
    const wss = new WebSocket.Server({ server });
    const wsClients = new Set();

    wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      wsClients.add(ws);

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        wsClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
      });
    });

    // Function to broadcast to WebSocket clients
    const broadcastToWS = (data) => {
      const message = JSON.stringify(data);
      wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    };

    // Start DPBoss sync service
    const syncService = new DpbossSync(broadcastToWS);
    await syncService.start();

    // Removed gap-fill cron to ensure only real DPBoss numbers are used

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

    console.log('Cron job scheduled for scrape every 30 minutes on weekdays');

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
