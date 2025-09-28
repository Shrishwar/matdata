const Result = require('../../models/Result');
const AnalysisRecord = require('../../models/AnalysisRecord');
const heuristics = require('./heuristics');
const mlClient = require('./mlClient');
const config = require('./config');
const NodeCache = require('node-cache');
const winston = require('winston');

class GeniusPredictor {
  constructor() {
    this.cache = new NodeCache({ stdTTL: config.cache.ttl });
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/genius-predictor.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async predictEnsemble(numLimit = 10) {
    const cacheKey = `ensemble_${numLimit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.info('Returning cached ensemble prediction');
      return cached;
    }

    try {
      // Get latest history
      const history = await Result.find().sort({ date: -1 }).limit(config.windows.historyLimit).lean();
      if (history.length < 10) {
        throw new Error('Insufficient historical data for prediction');
      }

      const prevDouble = history[0].double;

      // Get all heuristics
      const heurResults = await heuristics.getAllHeuristics(history, prevDouble, {
        window: config.windows.k30,
        topK: 50,
        recencyWindow: config.recency.window,
        decay: config.recency.decay
      });

      // Get ML predictions if available
      let mlResults = [];
      try {
        const features = await this.getLatestFeatures();
        if (features) {
          mlResults = await mlClient.predict(features);
        }
      } catch (mlError) {
        this.logger.warn('ML prediction failed, proceeding with heuristics only', { error: mlError.message });
      }

      // Ensemble scoring
      const ensembleScores = {};
      const contributions = {};

      // Process each heuristic
      Object.keys(heurResults).forEach(heurType => {
        const weight = config.ensembleWeights[heurType] || 0;
        heurResults[heurType].forEach(item => {
          if (!ensembleScores[item.double]) {
            ensembleScores[item.double] = 0;
            contributions[item.double] = [];
          }
          ensembleScores[item.double] += item.score * weight;
          contributions[item.double].push({
            component: heurType,
            value: item.score,
            metadata: item.metadata
          });
        });
      });

      // Add ML if available
      if (mlResults.length > 0) {
        const mlWeight = config.ensembleWeights.ml;
        mlResults.forEach(item => {
          if (!ensembleScores[item.double]) {
            ensembleScores[item.double] = 0;
            contributions[item.double] = [];
          }
          ensembleScores[item.double] += item.score * mlWeight;
          contributions[item.double].push({
            component: 'ml',
            value: item.score,
            metadata: item.metadata
          });
        });
      }

      // Sort and select top
      const sorted = Object.entries(ensembleScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, numLimit);

      // Normalize scores to 0-1
      const maxScore = Math.max(...sorted.map(([, score]) => score));
      const predictions = sorted.map(([double, score]) => ({
        double,
        normalized_confidence: maxScore > 0 ? score / maxScore : 0,
        raw_score: score,
        contributions: contributions[double] || []
      }));

      const result = {
        predictions,
        disclaimer: 'This system is for entertainment and analysis only — no guaranteed results. Use at your own risk.',
        timestamp: new Date().toISOString(),
        model_version: 'genius-v1.0'
      };

      this.cache.set(cacheKey, result);
      this.logger.info('Generated new ensemble prediction', { numPredictions: predictions.length });

      return result;
    } catch (error) {
      this.logger.error('Ensemble prediction failed', { error: error.message });
      throw error;
    }
  }

  async getLatestFeatures() {
    const latest = await Result.findOne().sort({ date: -1 });
    if (!latest) return null;

    const analysis = await AnalysisRecord.findOne({ date: latest.date }).lean();
    if (analysis) {
      // Convert to feature vector
      const features = {};
      // Add numeric features
      Object.keys(analysis).forEach(key => {
        if (typeof analysis[key] === 'number') {
          features[key] = analysis[key];
        }
      });
      return features;
    }

    return null;
  }

  updateWeights(newWeights) {
    Object.assign(config.ensembleWeights, newWeights);
    this.logger.info('Updated ensemble weights', { newWeights });
  }

  clearCache() {
    this.cache.flushAll();
    this.logger.info('Cleared prediction cache');
  }
}

module.exports = new GeniusPredictor();
