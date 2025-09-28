const express = require('express');
const router = express.Router();
const predictor = require('../services/prediction/matkaPredictor');
const { auth, admin } = require('../middleware/auth');
const Result = require('../models/Result');
const logger = require('../utils/logger');
const { validationResult, query } = require('express-validator');

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
  auth,
  validate([
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ]),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const result = await predictor.generatePredictions(limit);
      
      // Format the response
      const response = {
        success: true,
        data: {
          predictions: result.predictions,
          analysis: {
            frequency: result.analysis.frequency,
            patterns: result.analysis.patterns,
            spectral: result.analysis.spectralAnalysis,
            trends: result.analysis.trends
          },
          summary: {
            totalRecords: result.summary.totalRecords,
            lastNumber: result.summary.lastNumber,
            isRandom: result.summary.isRandom,
            runsTest: result.summary.runsTest,
            lastUpdated: new Date()
          }
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

module.exports = router;
