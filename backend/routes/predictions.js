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
 * @route   GET /api/predictions/next
 * @desc    Get predictions for the next number
 * @access  Private
 */
router.get('/next', 
  validate([
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;

      // Check if sufficient data exists
      const dataCount = await Result.countDocuments();
      if (dataCount < 10) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient data for predictions',
          details: `Only ${dataCount} records found. Please run the scraper to populate the database with DPBoss data.`
        });
      }

      const result = await predictor.generatePredictions(limit);
      
      // Format the response with full analysis
      const response = {
        success: true,
        data: {
          predictions: result.predictions,
          analysis: result.analysis, // Full analysis object
          predictionTable: result.predictionTable,
          summary: result.summary
        }
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

module.exports = router;
