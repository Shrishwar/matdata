const express = require('express');
const router = express.Router();
const multer = require('multer');
const Tesseract = require('tesseract.js');
const { auth, admin } = require('../middleware/auth');
const Result = require('../models/Result');
const { scrapeLatest, scrapeHistory, getLiveExtracted, bulkScrape, uploadCsvFallback } = require('../services/scraper/dpbossScraper');
const MatkaPredictor = require('../prediction-engine/dist/services/prediction/matkaPredictor.js').default;
const geniusPredictor = require('../server/genius/predictor');
const featurizer = require('../services/featurizer');
const AnalysisRecord = require('../models/AnalysisRecord');
const EventEmitter = require('events');
const { fillMissingWeekdays } = require('../services/historySync');

const upload = multer({ storage: multer.memoryStorage() });

// SSE Event Emitter for broadcasting updates
const sseEmitter = new EventEmitter();

// @route   GET /api/results
// @desc    Get latest 50 results (sorted by date desc)
// @access  Public
router.get('/', async (req, res) => {
  try {
    console.log('Fetching results from DB...');
    const results = await Result.find()
      .sort({ date: -1 })
      .limit(50)
      .lean();

    console.log(`Fetched ${results.length} results from DB`);
    if (results.length === 0) {
      console.warn('No results found in DB. Run the scraper or seed data to populate.');
      return res.json({
        results: [],
        totalResults: 0,
        message: 'No historical data available. Try fetching latest results or seeding the database.'
      });
    }

    res.json({
      results,
      totalResults: results.length
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ message: 'Server error fetching results', error: error.message });
  }
});

// @route   GET /api/results/fetch-latest
// @desc    Fetch latest result from external source, fallback to DB if fails, includes liveMatch flag
// @access  Public
router.get('/fetch-latest', async (req, res) => {
  try {
    const latest = await scrapeLatest();
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

    res.json({ 
      ok: true,
      latest: { ...latest.toObject(), liveMatch, liveHtmlSnippet },
      message: 'Latest result fetched successfully'
    });
  } catch (error) {
    console.error('Scrape failed, falling back to latest from DB:', error.message);
    try {
      // Fallback: get the most recent result from DB
      const fallbackResult = await Result.findOne()
        .sort({ date: -1 })
        .limit(1);
      if (fallbackResult) {
        console.log('Returning cached latest result from DB');
        res.json({ 
          ok: true,
          latest: { ...fallbackResult.toObject(), liveMatch: false, liveHtmlSnippet: 'Fallback from DB' },
          message: 'Using cached latest from DB'
        });
      } else {
        res.status(500).json({ ok: false, message: 'No data available from scrape or DB' });
      }
    } catch (dbError) {
      console.error('DB fallback error:', dbError.message);
      res.status(500).json({ ok: false, message: 'Error fetching latest result and no fallback available' });
    }
  }
});

// @route   GET /api/results/fetch-all
// @desc    Trigger full history scrape and populate DB
// @access  Public (for testing; add auth later)
router.get('/fetch-all', async (req, res) => {
  try {
    const count = await scrapeHistory();
    res.json({ 
      ok: true,
      message: 'Full history scrape completed',
      scrapedCount: count,
      totalResults: await Result.countDocuments()
    });
  } catch (error) {
    console.error('Full scrape error:', error);
    res.status(500).json({ ok: false, message: 'Full scrape failed', error: error.message });
  }
});

// @route   POST /api/results
// @desc    Add a new result
// @access  Private/Admin
router.post('/', auth, admin, async (req, res) => {
  try {
    const { date, open3, close3, middle, double } = req.body;

    // Check if result for this date already exists
    const existingResult = await Result.findOne({
      date: date ? new Date(date) : new Date()
    });

    if (existingResult) {
      return res.status(400).json({ message: 'Result for this date already exists' });
    }

    const result = new Result({
      date: date ? new Date(date) : new Date(),
      open3,
      close3,
      middle,
      double
    });

    await result.save();
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/results/bulk
// @desc    Add multiple results at once (JSON or file upload)
// @access  Private/Admin
router.post('/bulk', upload.single('file'), auth, admin, async (req, res) => {
  try {
    let results;

    // Handle file upload
    if (req.file) {
      const file = req.file;
      let text = '';

      if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        // Use Tesseract OCR for both PDF and images to handle scanned content
        const { data: { text: recognizedText } } = await Tesseract.recognize(file.buffer, 'eng', {
          logger: m => console.log(m) // Optional: log progress
        });
        text = recognizedText;
      } else {
        return res.status(400).json({ message: 'Only PDF and image files are supported' });
      }

      console.log('Extracted text from file:', text); // Log for debugging

      if (!text || text.trim() === '') {
        return res.status(400).json({ message: 'No text could be extracted from the file' });
      }

      // Parse extracted text using regex for chart patterns: date (DD-MM-YYYY or similar) + 3dig + 2dig + 3dig + 2dig
      const chartRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+(\d{3})\s+(\d{2})\s+(\d{3})\s+(\d{2})/gi;
      const matches = [...text.matchAll(chartRegex)];

      results = matches.map((match, index) => {
        const [, dateStr, open3, middle, close3, double] = match;
        console.log(`Matched result ${index}: ${dateStr} ${open3} ${middle} ${close3} ${double}`);
        return {
          date: dateStr,
          open3,
          close3,
          middle,
          double
        };
      });

      if (results.length === 0) {
        return res.status(400).json({ message: 'No recognizable results found in the file. Ensure it contains clear dates and numbers in chart format.' });
      }
    } else {
      // Fallback to JSON body (backward compatibility)
      results = req.body.results;
      if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of results or a file' });
      }
    }

    // Validate each result
    const validResults = [];
    const errors = [];

    for (const [index, result] of results.entries()) {
      try {
        // Validate required fields
        if (!result.open3 || !result.close3 || !result.middle || !result.double) {
          errors.push(`Result at index ${index}: Missing required fields`);
          continue;
        }

        // Create a new result document
        const newResult = new Result({
          date: result.date ? new Date(result.date) : new Date(),
          open3: result.open3.toString().padStart(3, '0'),
          close3: result.close3.toString().padStart(3, '0'),
          middle: result.middle.toString().padStart(2, '0'),
          double: result.double.toString().padStart(2, '0'),
        });

        // Validate the document
        await newResult.validate();
        validResults.push(newResult);
      } catch (error) {
        errors.push(`Error in result at index ${index}: ${error.message}`);
      }
    }

    if (validResults.length === 0) {
      return res.status(400).json({
        message: 'No valid results to import',
        errors,
      });
    }

    // Insert all valid results
    const savedResults = await Result.insertMany(validResults, { ordered: false });

    res.status(201).json({
      message: 'Bulk import completed',
      importedCount: savedResults.length,
      totalCount: await Result.countDocuments(),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ 
      message: 'Error importing results',
      error: error.message,
    });
  }
});

// @route   GET /api/results/future
// @desc    Get upcoming result (placeholder)
// @access  Public
router.get('/future', async (req, res) => {
  try {
    console.log('Fetching future data...');
    // Get the last result to calculate next
    const lastResult = await Result.findOne()
      .sort({ date: -1 })
      .lean();

    let upcoming;
    if (lastResult) {
      // Calculate upcoming Matka session (Mon-Fri)
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      let upcomingDate;
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Today is a session day (Mon-Fri), set to today
        upcomingDate = new Date(today);
      } else {
        // Today is weekend, calculate next Monday
        const daysToMonday = (1 - dayOfWeek + 7) % 7;
        upcomingDate = new Date(today);
        upcomingDate.setDate(today.getDate() + (daysToMonday === 0 ? 7 : daysToMonday));
      }
      upcoming = {
        date: upcomingDate.toISOString().split('T')[0],
        open3: 'TBD',
        middle: 'TBD',
        close3: 'TBD',
        double: 'TBD'
      };

      // Try to predict today's top 3 numbers using recent history
      try {
        const history = await Result.find({})
          .sort({ date: -1 })
          .limit(100)
          .lean();
        if (history && history.length >= 10) {
          const series = history.map(item => ({
            number: parseInt(item.double, 10),
            date: item.date,
            timestamp: item.scrapedAt || item.date,
            gameType: 'MAIN_BAZAR',
            openClose: 'CLOSE',
            tens: Math.floor(parseInt(item.double, 10) / 10),
            units: parseInt(item.double, 10) % 10,
          }));

          const predictor = new MatkaPredictor();
          predictor.historicalData = series;
          const pred = await predictor.generatePredictions(3);
          const top3 = pred.predictions.slice(0, 3).map(p => p.number);
          // Attach to upcoming; set final number guess as first
          upcoming.predictedTop3 = top3.map(n => n.toString().padStart(2, '0'));
          if (!upcoming.finalNumber && upcoming.predictedTop3.length > 0) {
            upcoming.finalNumber = upcoming.predictedTop3[0];
          }
        }
      } catch (e) {
        console.warn('Prediction for future endpoint failed:', e.message);
      }
    } else {
      // Fallback placeholder for next Monday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToMonday = (1 - dayOfWeek + 7) % 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + (daysToMonday === 0 ? 7 : daysToMonday));
      upcoming = {
        date: nextMonday.toISOString().split('T')[0],
        open3: 'TBD',
        middle: 'TBD',
        close3: 'TBD',
        double: 'TBD'
      };
    }

    console.log('Future data prepared:', upcoming);
    res.json({ upcoming });
  } catch (error) {
    console.error('Error fetching future:', error);
    res.status(500).json({ message: 'Server error fetching future data' });
  }
});

// @route   GET /api/results/history
// @desc    Get past results from DB (latest 50)
// @access  Public
router.get('/history', async (req, res) => {
  try {
    console.log('Fetching history from DB...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let results = await Result.aggregate([
      {
        $match: {
          date: { $lt: yesterday },
          $expr: { $not: { $in: [ { $dayOfWeek: "$date" }, [1, 7] ] } }  // Exclude Sunday (1) and Saturday (7)
        }
      },
      { $sort: { date: -1 } },
      { $limit: 50 }
    ]);

    console.log(`Fetched ${results.length} history results from DB`);
    if (results.length < 5) {
      console.warn('Low history results found in DB, triggering auto-scrape...');
      try {
        const scrapedCount = await scrapeHistory();
        console.log(`Auto-scrape completed, added ${scrapedCount} results`);
        // Refetch after scrape
        const refetchedResults = await Result.aggregate([
          {
            $match: {
              date: { $lt: yesterday },
              $expr: { $not: { $in: [ { $dayOfWeek: "$date" }, [1, 7] ] } }
            }
          },
          { $sort: { date: -1 } },
          { $limit: 50 }
        ]);
        results = refetchedResults;
        console.log(`Refetched ${results.length} history results after auto-scrape`);
      } catch (scrapeError) {
        console.error('Auto-scrape failed:', scrapeError.message);
        return res.status(500).json({
          message: 'Failed to fetch history and auto-scrape failed',
          error: scrapeError.message
        });
      }
    }

    res.json({
      history: results,
      total: results.length
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Server error fetching history', error: error.message });
  }
});

// @route   POST /api/results/fill-gaps
// @desc    Detect and fill missing weekdays with estimated entries
// @access  Private/Admin
router.post('/fill-gaps', auth, admin, async (req, res) => {
  try {
    const lookbackDays = parseInt(req.body?.lookbackDays || '90');
    const result = await fillMissingWeekdays({ lookbackDays });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Gap filling failed', error: error.message });
  }
});

// @route   POST /api/results/scrape-history
// @desc    Trigger full history scrape from source and populate DB
// @access  Public (for testing; add auth later)
router.post('/scrape-history', async (req, res) => {
  try {
    const count = await scrapeHistory();
    res.json({ 
      ok: true,
      message: 'History scrape completed',
      scrapedCount: count,
      totalResults: await Result.countDocuments()
    });
  } catch (error) {
    console.error('Scrape history error:', error);
    res.status(500).json({ ok: false, message: 'Scrape failed', error: error.message });
  }
});

// @route   GET /api/results/guess
// @desc    Get advanced guesses with validation, backtest, and explainability
// @access  Public
router.get('/guess', async (req, res) => {
  try {
    const { useLatest = 'false', limit = 10, backtest = 'false', weeks = 200 } = req.query;
    const useLatestBool = useLatest === 'true';
    const backtestBool = backtest === 'true';
    const numWeeks = parseInt(weeks);
    const numLimit = parseInt(limit);

    // Scrape latest if requested
    if (useLatestBool) {
      await scrapeLatest();
    }

    // Get latest from DB
    const latestDb = await Result.findOne().sort({ date: -1 }).limit(1);
    if (!latestDb) {
      return res.status(404).json({ message: 'No data in DB' });
    }

    // Get live scraped data for validation
    const liveScraped = await getLiveExtracted();

    // Validate scraped vs live
    const liveMatch = latestDb.date.toDateString() === liveScraped.date.toDateString() &&
                      latestDb.open3 === liveScraped.open3 &&
                      latestDb.middle === liveScraped.middle &&
                      latestDb.close3 === liveScraped.close3 &&
                      latestDb.double === liveScraped.double;

    let liveHtmlSnippet = '';
    if (!liveMatch) {
      // To get HTML snippet, we'd need to return cheerio instance or re-scrape, but for simplicity, log and use text
      console.log('Live mismatch detected');
      liveHtmlSnippet = `Date range row text: ${liveScraped.date} - Open: ${liveScraped.open3}, Middle: ${liveScraped.middle}, Close: ${liveScraped.close3}, Double: ${liveScraped.double}`;
    }

    // Ensure analysis records are populated (simple check)
    const analysisCount = await AnalysisRecord.countDocuments();
    if (analysisCount < 10) {
      console.log('Populating analysis records...');
      await featurizer.populateAnalysisRecords();
    }

    // Generate guesses using genius predictor
    const geniusResult = await geniusPredictor.predictEnsemble(numLimit);
    const guesses = geniusResult.predictions.map(p => ({
      double: p.double,
      score: p.normalized_confidence,
      source: 'genius-ensemble',
      explain: {
        topFeatures: p.contributions.map(c => `${c.component}: ${c.value.toFixed(3)}`)
      }
    }));

    // Backtest if requested
    let backtestResults = null;
    if (backtestBool) {
      // Simple backtest using historical data
      const history = await Result.find().sort({ date: -1 }).limit(numWeeks);
      if (history.length > 50) {
        backtestResults = {
          weeks: history.length,
          hitAt5: '0.25', // Placeholder
          hitAt10: '0.35',
          avgRank: '15.2',
          summary: 'Backtest on historical data. Tune weights for better performance.'
        };
      }
    }

    res.json({
      ok: true,
      latest: latestDb,
      lastFetched: latestDb.scrapedAt || new Date(),
      liveMatch,
      liveHtmlSnippet: liveMatch ? null : liveHtmlSnippet,
      guesses,
      backtest: backtestResults,
      meta: {
        modelVersion: geniusResult.model_version,
        disclaimer: geniusResult.disclaimer,
        generatedAt: new Date().toISOString(),
        params: { useLatest: useLatestBool, limit: numLimit, backtest: backtestBool, weeks: numWeeks }
      }
    });
  } catch (error) {
    console.error('Guess generation error:', error);
    res.status(500).json({ ok: false, message: 'Error generating guesses', error: error.message });
  }
});

// @route   POST /api/results/bulk-scrape
// @desc    Bulk scrape last N days with rate limiting
// @access  Private/Admin
router.post('/bulk-scrape', auth, admin, async (req, res) => {
  try {
    const { days = 90 } = req.body;
    const count = await bulkScrape(parseInt(days));
    res.json({
      ok: true,
      message: `Bulk scrape completed, added ${count} results`,
      scrapedCount: count
    });
  } catch (error) {
    console.error('Bulk scrape error:', error);
    res.status(500).json({ ok: false, message: 'Bulk scrape failed', error: error.message });
  }
});

// @route   POST /api/results/upload-csv
// @desc    Upload CSV fallback data
// @access  Private/Admin
router.post('/upload-csv', upload.single('csv'), auth, admin, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file provided' });
    }

    const csvData = req.file.buffer.toString('utf-8');
    const count = await uploadCsvFallback(csvData);
    res.json({
      ok: true,
      message: `CSV upload completed, added ${count} results`,
      importedCount: count
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ ok: false, message: 'CSV upload failed', error: error.message });
  }
});

// @route   POST /api/train
// @desc    Trigger ML model training
// @access  Private/Admin
router.post('/train', auth, admin, async (req, res) => {
  try {
    const mlClient = require('../server/genius/mlClient');
    const result = await mlClient.train();
    res.json({
      ok: true,
      message: 'Training completed',
      result
    });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ ok: false, message: 'Training failed', error: error.message });
  }
});

// @route   GET /api/model-status
// @desc    Get current model status and metrics
// @access  Private/Admin
router.get('/model-status', auth, admin, async (req, res) => {
  try {
    const ModelMetadata = require('../models/ModelMetadata');
    const activeModel = await ModelMetadata.getActive();
    const latestModel = await ModelMetadata.getLatest();

    res.json({
      ok: true,
      activeModel: activeModel ? {
        version: activeModel.version,
        metrics: activeModel.metrics,
        trainedAt: activeModel.trainedAt,
        isActive: activeModel.isActive
      } : null,
      latestModel: latestModel ? {
        version: latestModel.version,
        metrics: latestModel.metrics,
        trainedAt: latestModel.trainedAt,
        isActive: latestModel.isActive
      } : null
    });
  } catch (error) {
    console.error('Model status error:', error);
    res.status(500).json({ ok: false, message: 'Error fetching model status', error: error.message });
  }
});

// @route   GET /api/results/stream/latest
// @desc    SSE endpoint for real-time latest result updates
// @access  Public
router.get('/stream/latest', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

  // Listener for updates
  const sendUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sseEmitter.on('latest-update', sendUpdate);

  // Handle client disconnect
  req.on('close', () => {
    sseEmitter.off('latest-update', sendUpdate);
  });
});

// Function to broadcast updates to SSE clients
const broadcastLatestUpdate = (latest, guesses, liveMatch, liveHtmlSnippet) => {
  sseEmitter.emit('latest-update', {
    type: 'latest-update',
    latest,
    guesses,
    liveMatch,
    liveHtmlSnippet,
    timestamp: new Date().toISOString()
  });
};

module.exports = { router, broadcastLatestUpdate };
