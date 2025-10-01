const express = require('express');
const router = express.Router();
const MatkaPredictor = require('../prediction-engine/dist/services/prediction/matkaPredictor.js').default;
const predictor = new MatkaPredictor();
const { auth, admin } = require('../middleware/auth');
const Result = require('../models/Result');
const logger = require('../utils/logger');
const { validationResult, query } = require('express-validator');
const { getLiveExtracted } = require('../services/scraper/dpbossScraper');

// Constants for live predictions
const LIVE_CONSTANTS = {
  RANDOM_SEED: 42
};

// Validation middleware
const validate = validations => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  };
};

/**
 * @route   POST /api/predictions/next
 * @desc    Get predictions for the next number
 * @access  Private
 */
router.get('/next',
  validate([
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 3;

      // Check if sufficient data exists
      const dataCount = await Result.countDocuments();
      let responsePayload;

      if (dataCount >= 10) {
        const result = await predictor.generatePredictions(limit);
        responsePayload = {
          predictions: result.predictions.slice(0, limit),
          analysis: result.analysis,
          predictionTable: result.predictionTable,
          summary: result.summary
        };
      } else {
        // Heuristic fallback to always return top-3 using available data
        const history = await Result.find({}).sort({ date: -1 }).limit(Math.min(50, dataCount)).lean();
        const freq = new Array(100).fill(0);
        history.forEach(h => {
          const n = parseInt(h.double, 10);
          if (!isNaN(n) && n >= 0 && n < 100) freq[n]++;
        });
        const ranked = Array.from({ length: 100 }, (_, n) => ({ n, c: freq[n] }))
          .sort((a, b) => b.c - a.c || a.n - b.n)
          .slice(0, limit)
          .map((r, idx) => ({ number: r.n, confidence: Math.max(50, 70 - idx * 10) }));
        responsePayload = {
          predictions: ranked,
          analysis: { note: 'Fallback heuristic due to low data', total: dataCount },
          predictionTable: [],
          summary: { totalRecords: dataCount, lastNumber: history[0] ? parseInt(history[0].double, 10) : null, isRandom: false, topPredictions: ranked }
        };
      }
      
      // Format the response with full analysis
      const response = {
        success: true,
        data: responsePayload
      };
      
      res.json(response);
    } catch (error) {
      logger.error('Prediction error:', { error: error.message, stack: error.stack });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate predictions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/analysis
 * @desc    Get detailed analysis data
 * @access  Private (Admin only)
 */
router.get('/analysis', 
  auth, 
  admin,
  validate([
    query('range').optional().isIn(['day', 'week', 'month']).withMessage('Invalid range parameter')
  ]),
  async (req, res) => {
    try {
      const timeRange = req.query.range || 'day';
      const result = await predictor.generatePredictions();
      
      // Additional analysis for admin
      const historicalData = await Result.getHistoricalData(timeRange);
      const accuracy = await predictor.calculateAccuracy(historicalData);
      const modelMetrics = await predictor.getModelMetrics();
      
      res.json({
        success: true,
        data: {
          ...result,
          historicalAnalysis: {
            accuracy,
            timeRange,
            totalSamples: historicalData.length
          },
          modelMetrics
        }
      });
    } catch (error) {
      logger.error('Analysis error:', { error: error.message, stack: error.stack });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate analysis',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/accuracy
 * @desc    Get prediction accuracy metrics
 * @access  Private (Admin only)
 */
router.get('/accuracy', 
  auth,
  admin,
  validate([
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
  ]),
  async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const historicalData = await Result.getHistoricalData(days + 'd');
      const accuracy = await predictor.calculateAccuracy(historicalData);
      
      res.json({
        success: true,
        data: {
          accuracy,
          days,
          totalSamples: historicalData.length
        }
      });
    } catch (error) {
      logger.error('Accuracy calculation error:', { error: error.message, stack: error.stack });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to calculate accuracy',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/patterns
 * @desc    Get number pattern analysis
 * @access  Private (Admin only)
 */
router.get('/patterns', 
  auth,
  admin,
  validate([
    query('length').optional().isInt({ min: 2, max: 5 }).withMessage('Pattern length must be between 2 and 5')
  ]),
  async (req, res) => {
    try {
      const length = parseInt(req.query.length) || 3;
      const patterns = await predictor.analyzePatterns(length);
      
      res.json({
        success: true,
        data: {
          patterns,
          patternLength: length
        }
      });
    } catch (error) {
      logger.error('Pattern analysis error:', { error: error.message, stack: error.stack });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to analyze patterns',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/spectral
 * @desc    Get spectral analysis of number sequences
 * @access  Private (Admin only)
 */
router.get('/spectral', 
  auth,
  admin,
  async (req, res) => {
    try {
      const spectralData = await predictor.performSpectralAnalysis();
      
      res.json({
        success: true,
        data: spectralData
      });
    } catch (error) {
      logger.error('Spectral analysis error:', { error: error.message, stack: error.stack });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to perform spectral analysis',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/metrics
 * @desc    Get model performance metrics
 * @access  Private (Admin only)
 */
router.get('/metrics',
  auth,
  admin,
  async (req, res) => {
    try {
      const metrics = await predictor.getModelMetrics();

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Metrics fetch error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch model metrics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/live
 * @desc    Get live predictions based on DPBoss live chart data
 * @access  Private
 */
router.get('/live',
  validate([
    query('limit').optional().isInt({ min: 1, max: 10 }).withMessage('Limit must be between 1 and 10')
  ]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;

      // Fetch live DPBoss data
      logger.info('Fetching live DPBoss chart data...');
      const liveData = await getLiveExtracted();

      if (!liveData) {
        return res.status(503).json({
          success: false,
          error: 'Live chart unavailable',
          message: 'Unable to fetch live DPBoss chart data. Please retry later.'
        });
      }

      // Save live data to DB (idempotent)
      const startOfDay = new Date(liveData.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(liveData.date);
      endOfDay.setHours(23, 59, 59, 999);

      await Result.findOneAndUpdate(
        { date: { $gte: startOfDay, $lt: endOfDay } },
        liveData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      logger.info(`Live data saved for ${liveData.date.toISOString().split('T')[0]}`);

      // Load historical data including the new live data
      const historicalData = await Result.find({})
        .sort({ date: -1 })
        .limit(100) // Use last 100 records for prediction
        .lean();

      if (historicalData.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient data for predictions',
          details: `Only ${historicalData.length} records found. Need at least 10 records.`
        });
      }

      // Transform data for predictor
      const transformedData = historicalData.map(item => ({
        number: parseInt(item.double),
        date: item.date,
        timestamp: item.scrapedAt || item.date,
        gameType: 'MAIN_BAZAR',
        openClose: 'CLOSE', // Assuming close for final number
        tens: Math.floor(parseInt(item.double) / 10),
        units: parseInt(item.double) % 10
      }));

      // Create new predictor instance with live data
      const livePredictor = new MatkaPredictor();
      livePredictor.historicalData = transformedData;

      // Generate predictions
      const result = await livePredictor.generatePredictions(limit);

      // Format response with required structure
      const response = {
        success: true,
        predictions: result.predictions.slice(0, limit).map(p => ({
          number: p.number,
          confidence: p.confidence,
          explanation: [
            `Score: ${p.score.toFixed(4)}`,
            `Frequency rank: ${result.predictions.indexOf(p) + 1}`,
            `Based on live DPBoss chart data`
          ]
        })),
        analysis: {
          freqTop: result.analysis.frequencyAnalysis.overrepresented.slice(0, 5),
          markov: {
            steadyStateProbs: result.analysis.markovMatrix.steadyStateProbs.slice(0, 10)
          },
          recencyStats: {
            lastNumber: result.summary.lastNumber,
            totalRecords: result.summary.totalRecords
          },
          gapAnalysis: result.analysis.trendAnalysis,
          bayesianUpdate: result.analysis.bayesianUpdate,
          mlSummary: {
            modelMetrics: result.summary.modelMetrics,
            accuracy: result.summary.accuracy
          }
        },
        provenance: {
          source: 'dpboss',
          fetchedAt: new Date().toISOString(),
          modelVersion: '1.0.0',
          seed: LIVE_CONSTANTS.RANDOM_SEED
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Live prediction error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to generate live predictions',
        message: 'Live chart unavailable, please retry',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/predictions/combined
 * @desc    Deterministic hybrid predictor (Human heuristics + AI ensemble) using ONLY DPBoss history
 * @access  Public
 */
router.get('/combined',
  validate([
    query('limit').optional().isInt({ min: 1, max: 10 }).withMessage('Limit must be between 1 and 10')
  ]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;

      // Load only real DPBoss history from DB
      const history = await Result.find({})
        .sort({ date: 1 }) // chronological
        .lean();

      if (!history || history.length < 50) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient DPBoss history',
          details: `Need >=50 records, found ${history ? history.length : 0}`,
        });
      }

      // Transform for AI predictor (numbers 0-99)
      const series = history.map(h => {
        const n = parseInt(h.double, 10);
        return {
          number: isNaN(n) ? 0 : n,
          date: h.date,
          timestamp: h.scrapedAt || h.date,
          gameType: 'MAIN_BAZAR',
          openClose: 'CLOSE',
          tens: Math.floor((isNaN(n) ? 0 : n) / 10),
          units: (isNaN(n) ? 0 : n) % 10,
        };
      });

      // AI probabilities (deterministic)
      const ai = new MatkaPredictor();
      ai.historicalData = series;
      const aiResult = await ai.generatePredictions(100);
      // Map to probability by number (0..99)
      const aiProbByNumber = new Map();
      aiResult.predictions.forEach(p => {
        aiProbByNumber.set(p.number, Math.max(0, Math.min(1, p.confidence / 100)));
      });

      // Human heuristics over the same dataset
      const numbers = series.map(s => s.number);
      const universe = Array.from({ length: 100 }, (_, i) => i);

      // Frequency (last 200 draws or all if smaller)
      const windowSize = Math.min(200, numbers.length);
      const window = numbers.slice(-windowSize);
      const freq = new Array(100).fill(0);
      window.forEach(n => { if (n >= 0 && n < 100) freq[n]++; });
      const maxFreq = Math.max(...freq) || 1;
      const freqScore = freq.map(f => f / maxFreq); // 0..1

      // Gap (recency): more recent → higher score, long absence → boost with taper
      const lastIndex = new Array(100).fill(-1);
      for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        if (lastIndex[n] === -1) lastIndex[n] = i;
      }
      const latestIdx = numbers.length - 1;
      const gapScore = lastIndex.map(idx => {
        if (idx === -1) return 0.5; // never seen: moderate unknown
        const gap = latestIdx - idx;
        // Normalize with soft cap at 100 draws
        return Math.min(1, gap / 100);
      });

      // Transition probability (first-order Markov)
      const trans = Array.from({ length: 100 }, () => new Array(100).fill(0));
      for (let i = 1; i < numbers.length; i++) {
        const a = numbers[i - 1];
        const b = numbers[i];
        if (a >= 0 && a < 100 && b >= 0 && b < 100) trans[a][b]++;
      }
      // Normalize rows
      const transProb = trans.map(row => {
        const sum = row.reduce((s, v) => s + v, 0);
        if (sum === 0) return row.map(() => 0);
        return row.map(v => v / sum);
      });
      const recent = numbers[numbers.length - 1];
      const transFromRecent = recent >= 0 && recent < 100 ? transProb[recent] : new Array(100).fill(0);

      // Digit balance: prefer numbers whose digits keep the tens/units distributions near-uniform
      const tensCount = new Array(10).fill(0);
      const unitsCount = new Array(10).fill(0);
      numbers.forEach(n => {
        const t = Math.floor(n / 10);
        const u = n % 10;
        tensCount[t]++; unitsCount[u]++;
      });
      const avgTens = numbers.length / 10;
      const avgUnits = numbers.length / 10;
      const digitBalance = universe.map(n => {
        const t = Math.floor(n / 10);
        const u = n % 10;
        const tensDev = Math.abs(tensCount[t] + 1 - avgTens);
        const unitsDev = Math.abs(unitsCount[u] + 1 - avgUnits);
        const maxDev = Math.max(avgTens, avgUnits) || 1;
        return 1 - Math.min(1, (tensDev + unitsDev) / (2 * maxDev));
      });

      // Runs: discourage immediate repeats of recent clusters; encourage breaking long monotonic runs
      // Simple heuristic: penalize numbers equal to the most recent and reward different decade
      const recentDecade = Math.floor(recent / 10);
      const runsScore = universe.map(n => {
        if (n === recent) return 0;
        const decade = Math.floor(n / 10);
        return decade === recentDecade ? 0.5 : 1.0;
      });

      // Normalize arrays to 0..1 utility
      const normalize = arr => {
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const span = max - min || 1;
        return arr.map(v => (v - min) / span);
      };

      const freqN = normalize(freqScore);
      const gapN = normalize(gapScore);
      const transN = normalize(transFromRecent);
      const digitN = normalize(digitBalance);
      const runsN = normalize(runsScore);

      // Human composite weight (deterministic)
      const humanWeight = universe.map((n, i) => (
        0.35 * freqN[i] +
        0.25 * gapN[i] +
        0.20 * transN[i] +
        0.10 * digitN[i] +
        0.10 * runsN[i]
      ));

      // AI probability (0..1), default 0 if not present
      const aiProb = universe.map(n => aiProbByNumber.get(n) || 0);

      // Combined score: AI + Human weight (scaled) with deterministic weights
      const combined = universe.map((_, i) => 0.6 * aiProb[i] + 0.4 * humanWeight[i]);

      // Rank and prepare explanations
      const ranked = universe
        .map(n => ({ n, score: combined[n] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const toPct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);

      const humanExplain = (n) => {
        const lastIdx = lastIndex[n];
        const gap = lastIdx === -1 ? 'never seen' : `${latestIdx - lastIdx} draws gap`;
        const tProb = transFromRecent[n] ? transFromRecent[n].toFixed(2) : '0.00';
        const fRank = (100 - freqN[n] * 100); // inverted rank proxy
        return [
          `Number ${n.toString().padStart(2, '0')} ${gap}`,
          `Transition from ${recent.toString().padStart(2, '0')} → ${n.toString().padStart(2, '0')} = ${tProb}`,
          `Frequency strength rank ≈ #${Math.max(1, Math.round(fRank / 2))}`,
        ];
      };

      const systemExplain = (n) => {
        const prob = toPct(aiProb[n]);
        const freqPct = Math.round(freqN[n] * 100);
        const transPct = Math.round(transN[n] * 100);
        return [
          `AI ensemble probability ≈ ${prob}%`,
          `Markov/transition score ≈ ${transPct}%`,
          `Frequency feature score ≈ ${freqPct}%`,
        ];
      };

      const response = {
        success: true,
        data: {
          top: ranked.map(r => ({
            number: r.n,
            confidence: toPct(r.score),
            human: humanExplain(r.n),
            system: systemExplain(r.n),
          })),
          provenance: {
            source: 'dpboss-history',
            totalRecords: history.length,
            deterministic: true,
            modelVersion: 'hybrid-1.0.0',
          },
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Combined predictor error:', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: 'Failed to compute combined predictions' });
    }
  }
);

module.exports = router;
