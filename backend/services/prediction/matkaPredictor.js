const math = require('mathjs');
const { RandomForestClassifier } = require('ml-random-forest');
const { SimpleLinearRegression, PolynomialRegression } = require('ml-regression');
const { KMeans } = require('ml-kmeans');
const { PCA } = require('ml-pca');
const moment = require('moment');
const winston = require('winston');
const Result = require('../../models/Result');
const { fft, ifft } = require('fft-js');
const { performance } = require('perf_hooks');

// Constants
const TOTAL_NUMBERS = 100; // 00-99
const DEFAULT_PREDICTION_LIMIT = 10;
const MIN_SAMPLES_FOR_ANALYSIS = 50;
const PATTERN_LENGTH = 3; // Default pattern length for sequence analysis

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/prediction-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/prediction-combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class MatkaPredictor {
  constructor() {
    this.historicalData = [];
    this.results = {
      frequencyAnalysis: [],
      chiSquareTest: {},
      transitionMatrix: {},
      runsTest: {},
      movingAverages: {},
      bayesianPredictions: {},
      digitCorrelations: {},
      mlPredictions: {},
      spectralAnalysis: {},
      patternAnalysis: {},
      clusterAnalysis: {},
      finalPredictions: [],
      confidenceScores: {},
      modelMetrics: {}
    };
    this.lastUpdated = null;
    this.model = null;
    this.featureScaler = null;
    this.patternCache = new Map();
  }

  /**
   * Load historical data from MongoDB
   * @param {string} timeRange - Time range to load data for (e.g., '7d', '30d', '1y')
   */
  async loadData(timeRange = '30d') {
    try {
      let query = {};
      
      // Apply time range filter if specified
      if (timeRange) {
        const cutoffDate = moment().subtract(
          parseInt(timeRange),
          timeRange.replace(/[0-9]/g, '')
        ).toDate();
        
        query = {
          date: { $gte: cutoffDate }
        };
      }
      
      // Get results, sorted by date (newest first)
      const results = await Result.find(query)
        .sort({ date: -1 })
        .limit(2000) // Increased limit for better pattern recognition
        .lean();
      
      // Transform to the format expected by the predictor
      this.historicalData = results
        .map(result => ({
          date: result.date,
          number: result.close3, // Using close3 as the main number
          open3: result.open3,
          middle: result.middle,
          double: result.double
        }))
        .filter(entry => 
          entry.number !== undefined && 
          entry.number >= 0 && 
          entry.number <= 99 &&
          entry.date
        )
        .map(entry => ({
          ...entry,
          tens: Math.floor(entry.number / 10),
          units: entry.number % 10
        }));
      
      logger.info(`Loaded ${this.historicalData.length} records from database`);
      return this.historicalData;
    } catch (error) {
      logger.error('Error loading data from database:', error);
      throw error;
    }
  }

  // 1. Enhanced Frequency Analysis with Trend Detection
  performFrequencyAnalysis() {
    const frequency = new Array(100).fill(0);
    const recentFrequency = new Array(100).fill(0);
    const recentCount = Math.min(100, Math.floor(this.historicalData.length * 0.3)); // Last 30% of data
    
    this.historicalData.forEach((entry, index) => {
      frequency[entry.number]++;
      // Weight recent occurrences more heavily
      if (index >= this.historicalData.length - recentCount) {
        recentFrequency[entry.number] += 1.5; // 50% more weight to recent
      }
    });
    
    this.results.frequencyAnalysis = frequency.map((count, number) => {
      const recentWeight = recentFrequency[number] / (recentCount * 1.5);
      const overallWeight = count / this.historicalData.length;
      
      // Combine with emphasis on recent patterns
      const combinedWeight = (recentWeight * 0.6) + (overallWeight * 0.4);
      
      return {
        number,
        count,
        frequency: combinedWeight,
        recentFrequency: recentFrequency[number] / recentCount,
        trend: recentFrequency[number] / recentCount - (count / this.historicalData.length)
      };
    });
    
    return this.results.frequencyAnalysis;
  }

  // 2. Chi-Square Test
  performChiSquareTest() {
    const expected = this.historicalData.length / 100;
    let chiSquare = 0;
    
    this.results.frequencyAnalysis.forEach(({ count }) => {
      chiSquare += Math.pow(count - expected, 2) / expected;
    });
    
    const df = 99; // degrees of freedom
    const pValue = 1 - math.chi2cdf(chiSquare, df);
    
    this.results.chiSquareTest = {
      chiSquare,
      pValue,
      isRandom: pValue > 0.05,
      degreesOfFreedom: df
    };
    
    return this.results.chiSquareTest;
  }

  // 3. Transition Matrix (Markov Chain)
  buildTransitionMatrix() {
    const matrix = {};
    const numbers = this.historicalData.map(entry => entry.number);
    
    // Initialize matrix
    for (let i = 0; i < 100; i++) {
      matrix[i] = new Array(100).fill(0);
    }
    
    // Count transitions
    for (let i = 1; i < numbers.length; i++) {
      const from = numbers[i - 1];
      const to = numbers[i];
      matrix[from][to]++;
    }
    
    // Convert counts to probabilities
    for (let i = 0; i < 100; i++) {
      const total = matrix[i].reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (let j = 0; j < 100; j++) {
          matrix[i][j] /= total;
        }
      }
    }
    
    this.results.transitionMatrix = matrix;
    return this.results.transitionMatrix;
  }

  // 4. Runs Test
  performRunsTest() {
    const numbers = this.historicalData.map(entry => entry.number);
    const median = math.median(numbers);
    
    // Convert to binary sequence (1 if above median, 0 otherwise)
    const binarySequence = numbers.map(n => n > median ? 1 : 0);
    
    // Count runs
    let runs = 1;
    for (let i = 1; i < binarySequence.length; i++) {
      if (binarySequence[i] !== binarySequence[i - 1]) {
        runs++;
      }
    }
    
    // Expected runs and variance
    const n1 = binarySequence.filter(b => b === 1).length;
    const n2 = binarySequence.length - n1;
    const expectedRuns = ((2 * n1 * n2) / (n1 + n2)) + 1;
    const variance = (2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / 
                    (Math.pow((n1 + n2), 2) * (n1 + n2 - 1));
    const z = (runs - expectedRuns) / Math.sqrt(variance);
    const pValue = 2 * (1 - math.erf(Math.abs(z) / Math.sqrt(2)));
    
    this.results.runsTest = {
      runs,
      expectedRuns,
      zScore: z,
      pValue,
      isRandom: pValue > 0.05
    };
    
    return this.results.runsTest;
  }

  // 4.1 Add Fourier Transform Analysis
  performSpectralAnalysis() {
    const numbers = this.historicalData.map(entry => entry.number);
    
    // Convert numbers to complex numbers (real part only)
    const complexNumbers = numbers.map(n => [n, 0]);
    
    // Perform FFT
    const phasors = fft(complexNumbers);
    
    // Get magnitudes of frequencies
    const magnitudes = phasors.map(([re, im]) => Math.sqrt(re * re + im * im));
    
    // Find dominant frequencies (excluding DC component)
    const dominantFreqs = magnitudes
      .map((mag, freq) => ({ freq, mag }))
      .slice(1, 11) // Take top 10 frequencies (excluding DC)
      .sort((a, b) => b.mag - a.mag);
    
    this.results.spectralAnalysis = {
      dominantFrequencies: dominantFreqs,
      signalEnergy: magnitudes.reduce((sum, mag) => sum + mag * mag, 0)
    };
    
    return this.results.spectralAnalysis;
  }
  
  // 4.2 Add Pattern Recognition
  findRecurringPatterns() {
    const numbers = this.historicalData.map(entry => entry.number);
    const patternLength = 3; // Look for patterns of 3 numbers
    const patterns = new Map();
    
    for (let i = 0; i < numbers.length - patternLength; i++) {
      const pattern = numbers.slice(i, i + patternLength).join(',');
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    // Convert to array and sort by frequency
    const sortedPatterns = Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 patterns
      .map(([pattern, count]) => ({
        pattern: pattern.split(',').map(Number),
        count,
        probability: count / (numbers.length - patternLength + 1)
      }));
    
    this.results.patterns = sortedPatterns;
    return this.results.patterns;
  }

  // 5. Trend Analysis
  analyzeTrends(windowSize = 10) {
    if (this.historicalData.length < windowSize) {
      return [];
    }

    const trends = [];
    const numbers = this.historicalData.map(entry => entry.number);
    
    // Calculate moving averages and trends
    for (let i = windowSize; i <= numbers.length; i++) {
      const window = numbers.slice(i - windowSize, i);
      const avg = window.reduce((sum, num) => sum + num, 0) / windowSize;
      const variance = window.reduce((sum, num) => sum + Math.pow(num - avg, 2), 0) / windowSize;
      const stdDev = Math.sqrt(variance);
      
      // Simple linear regression for trend
      const x = window.map((_, idx) => idx);
      const y = window;
      const regression = new SimpleLinearRegression(x, y);
      
      trends.push({
        endIndex: i - 1,
        average: avg,
        stdDev,
        slope: regression.slope,
        r2: regression.r2,
        direction: this.calculateTrendDirection(regression.slope, stdDev)
      });
    }
    
    this.results.trends = trends;
    return trends;
  }

  // 6. Calculate Prediction Accuracy
  calculateAccuracy() {
    if (this.historicalData.length < 20) {
      return null; // Not enough data
    }

    const testSize = Math.floor(this.historicalData.length * 0.2); // Last 20% for testing
    const testData = this.historicalData.slice(-testSize);
    let correctPredictions = 0;
    const accuracyData = [];

    for (let i = 0; i < testData.length - 1; i++) {
      const currentData = this.historicalData.slice(0, this.historicalData.length - testSize + i);
      const nextNumber = testData[i + 1].number;
      
      // Make prediction using the same methods as generatePredictions
      const tempPredictor = new MatkaPredictor();
      tempPredictor.historicalData = currentData;
      tempPredictor.performFrequencyAnalysis();
      tempPredictor.buildTransitionMatrix();
      
      const predictions = tempPredictor.generatePredictions();
      const topPrediction = predictions[0]?.number;
      
      if (topPrediction === nextNumber) {
        correctPredictions++;
      }
      
      accuracyData.push({
        actual: nextNumber,
        predicted: topPrediction,
        isCorrect: topPrediction === nextNumber
      });
    }

    const accuracy = (correctPredictions / (testData.length - 1)) * 100;
    this.results.accuracy = {
      accuracy,
      correct: correctPredictions,
      total: testData.length - 1,
      details: accuracyData
    };
    
    return this.results.accuracy;
  }

  // 7. Get Model Performance Metrics
  getModelMetrics() {
    if (!this.results.accuracy) {
      this.calculateAccuracy();
    }
    
    // Confusion matrix (simplified for 10 number ranges)
    const confusionMatrix = Array(10).fill().map(() => Array(10).fill(0));
    
    if (this.results.accuracy?.details) {
      this.results.accuracy.details.forEach(({ actual, predicted }) => {
        const actualRange = Math.floor(actual / 10);
        const predictedRange = predicted !== undefined ? Math.floor(predicted / 10) : 0;
        confusionMatrix[actualRange][predictedRange]++;
      });
    }
    
    const metrics = {
      accuracy: this.results.accuracy?.accuracy || 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      confusionMatrix,
      lastUpdated: new Date().toISOString()
    };
    
    // Calculate precision, recall, and F1 score (simplified)
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    for (let i = 0; i < 10; i++) {
      truePositives += confusionMatrix[i][i] || 0;
      for (let j = 0; j < 10; j++) {
        if (i !== j) {
          falsePositives += confusionMatrix[j][i] || 0;
          falseNegatives += confusionMatrix[i][j] || 0;
        }
      }
    }
    
    if (truePositives + falsePositives > 0) {
      metrics.precision = (truePositives / (truePositives + falsePositives)) * 100;
    }
    
    if (truePositives + falseNegatives > 0) {
      metrics.recall = (truePositives / (truePositives + falseNegatives)) * 100;
    }
    
    if (metrics.precision + metrics.recall > 0) {
      metrics.f1Score = (2 * metrics.precision * metrics.recall) / (metrics.precision + metrics.recall);
    }
    
    this.results.modelMetrics = metrics;
    return metrics;
  }

  // 8. Extract Pattern Insights
  extractPatternInsights() {
    if (!this.results.patterns) {
      this.findRecurringPatterns();
    }
    
    const insights = {
      mostCommonPattern: this.results.patterns[0],
      patternCount: this.results.patterns.length,
      patternDistribution: {},
      digitFrequencies: {}
    };
    
    // Analyze digit frequencies in patterns
    const digitCounts = new Array(10).fill(0);
    this.results.patterns.forEach(({ pattern, count }) => {
      pattern.forEach(digit => {
        digitCounts[digit % 10] += count;
      });
    });
    
    insights.digitFrequencies = digitCounts.map((count, digit) => ({
      digit,
      count,
      percentage: (count / (this.results.patterns.length * 3)) * 100 // 3 digits per pattern
    }));
    
    // Analyze pattern distribution
    const patternLengths = {};
    this.results.patterns.forEach(({ pattern }) => {
      const length = pattern.length;
      patternLengths[length] = (patternLengths[length] || 0) + 1;
    });
    
    insights.patternDistribution = patternLengths;
    return insights;
  }

  // 9. Get Data Range
  getDataRange() {
    if (this.historicalData.length === 0) {
      return null;
    }
    
    return {
      startDate: this.historicalData[this.historicalData.length - 1].date,
      endDate: this.historicalData[0].date,
      totalDays: moment(this.historicalData[0].date).diff(
        moment(this.historicalData[this.historicalData.length - 1].date),
        'days'
      ) + 1,
      recordCount: this.historicalData.length
    };
  }

  // Helper: Calculate trend direction
  calculateTrendDirection(slope, stdDev) {
    if (Math.abs(slope) < stdDev * 0.5) {
      return 'neutral';
    }
    return slope > 0 ? 'up' : 'down';
  }

  // Helper: Calculate trend strength (0-1)
  calculateTrendStrength(slope, window) {
    const maxSlope = window / 2; // Theoretical maximum slope
    return Math.min(1, Math.abs(slope) / maxSlope);
  }
  
  // 5. Generate Enhanced Predictions
  async generatePredictions() {
    try {
      // Load and prepare data
      await this.loadData();
      
      // Run analyses in parallel where possible
      await Promise.all([
        this.performFrequencyAnalysis(),
        this.performChiSquareTest(),
        this.buildTransitionMatrix(),
        this.performRunsTest(),
        this.performSpectralAnalysis(),
        this.findRecurringPatterns(),
        this.analyzeTrends(),
        this.calculateAccuracy(),
        this.getModelMetrics()
      ]);
      
      // Get the last number for transition prediction
      const lastNumber = this.historicalData[0]?.number || 0;
      
      // Get frequency-based predictions with trend consideration
      const frequencyPredictions = [...this.results.frequencyAnalysis]
        .map(pred => ({
          ...pred,
          // Boost score if positive trend
          score: pred.frequency * (1 + Math.max(0, pred.trend * 2))
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      
      // Get transition-based predictions with pattern consideration
      const transitionPredictions = this.results.transitionMatrix[lastNumber]
        ? this.results.transitionMatrix[lastNumber]
          .map((prob, number) => ({
            number,
            prob,
            // Check if this number completes a recurring pattern
            patternBoost: this.results.patterns.some(([pattern]) => {
              const nums = pattern.split(',').map(Number);
              return nums[nums.length - 1] === number;
            }) ? 1.2 : 1 // 20% boost for pattern matches
          }))
          .map(pred => ({
            ...pred,
            score: pred.prob * pred.patternBoost
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
        : [];
      
      // Combine predictions with dynamic weights
      const combinedScores = new Array(100).fill(0);
      const weights = {
        frequency: 0.35,  // Reduced from 0.4
        transition: 0.5,  // Increased from 0.6
        spectral: 0.15    // New weight for spectral analysis
      };
      
      // Add frequency scores
      frequencyPredictions.forEach((pred, index) => {
        combinedScores[pred.number] += (20 - index) * weights.frequency;
      });
      
      // Add transition scores
      transitionPredictions.forEach((pred, index) => {
        combinedScores[pred.number] += (20 - index) * weights.transition;
      });
      
      // Add spectral analysis influence
      if (this.results.spectralAnalysis) {
        const dominantFreq = this.results.spectralAnalysis.dominantFrequencies[0]?.freq || 1;
        const cycleLength = Math.round(this.historicalData.length / dominantFreq);
        
        // Boost numbers that appeared in the same position in previous cycles
        for (let i = 0; i < this.historicalData.length; i += cycleLength) {
          if (i < this.historicalData.length) {
            const num = this.historicalData[i].number;
            combinedScores[num] += weights.spectral * 10; // Small boost for cycle matches
          }
        }
      }
      
      // Get top 10 predictions with confidence scores
      const predictions = combinedScores
        .map((score, number) => {
          // Apply softmax to get probabilities
          const expScores = combinedScores.map(s => Math.exp(s));
          const sumExp = expScores.reduce((a, b) => a + b, 0);
          const probability = Math.exp(score) / sumExp;
          
          return {
            number,
            score,
            confidence: Math.min(99, Math.round(probability * 1000)) // Scale to 0-99%
          };
        })
        .filter(pred => !isNaN(pred.score) && !isNaN(pred.confidence))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      this.results.finalPredictions = predictions;
      
      return {
        summary: {
          totalRecords: this.historicalData.length,
          lastNumber,
          isRandom: this.results.chiSquareTest.isRandom,
          runsTest: this.results.runsTest,
          topPredictions: predictions,
          accuracy: this.results.accuracy,
          modelMetrics: this.results.modelMetrics,
          dataRange: this.getDataRange(),
          analysisTime: new Date().toISOString()
        },
        predictions,
        analysis: {
          frequency: this.results.frequencyAnalysis,
          transitionMatrix: this.results.transitionMatrix,
          patterns: this.results.patterns,
          spectral: this.results.spectralAnalysis,
          trends: this.results.trends,
          patternInsights: this.extractPatternInsights(),
          modelPerformance: this.results.modelMetrics
        }
      };
      
    } catch (error) {
      logger.error('Error generating predictions:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const predictor = new MatkaPredictor();

module.exports = predictor;
