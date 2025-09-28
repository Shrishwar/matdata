const fs = require('fs');
const path = require('path');
const math = require('mathjs');
const { RandomForestClassifier } = require('ml-random-forest');
const { SimpleLinearRegression } = require('ml-regression');
const moment = require('moment');
const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class MatkaPredictionEngine {
  constructor() {
    this.historicalData = [];
    this.results = {
      frequencyAnalysis: {},
      chiSquareTest: {},
      autocorrelation: {},
      transitionMatrix: {},
      runsTest: {},
      movingAverages: {},
      bayesianPredictions: {},
      digitCorrelations: {},
      mlPredictions: {},
      monteCarloResults: {},
      finalPredictions: []
    };
  }

  // Load historical data from file or API
  async loadData(dataPath) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      this.historicalData = this.cleanData(data);
      logger.info(`Loaded ${this.historicalData.length} records`);
      return this.historicalData;
    } catch (error) {
      logger.error('Error loading data:', error);
      throw error;
    }
  }

  // Clean and preprocess data
  cleanData(data) {
    return data
      .filter(entry => 
        entry && 
        entry.number !== undefined && 
        entry.number >= 0 && 
        entry.number <= 99 &&
        entry.date
      )
      .map(entry => ({
        ...entry,
        date: moment(entry.date).toDate(),
        tens: Math.floor(entry.number / 10),
        units: entry.number % 10
      }));
  }

  // 1. Frequency Analysis
  performFrequencyAnalysis() {
    const frequency = new Array(100).fill(0);
    
    this.historicalData.forEach(entry => {
      frequency[entry.number]++;
    });
    
    this.results.frequencyAnalysis = frequency.map((count, number) => ({
      number,
      count,
      frequency: count / this.historicalData.length
    }));
    
    return this.results.frequencyAnalysis;
  }

  // 2. Chi-Square Test
  performChiSquareTest() {
    const expected = this.historicalData.length / 100; // Expected frequency for uniform distribution
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

  // 3. Autocorrelation Analysis
  performAutocorrelationAnalysis(maxLag = 10) {
    const lags = [];
    const numbers = this.historicalData.map(entry => entry.number);
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      const n = numbers.length - lag;
      
      for (let i = 0; i < n; i++) {
        sum += (numbers[i] - 49.5) * (numbers[i + lag] - 49.5);
      }
      
      const variance = numbers.reduce((acc, val) => acc + Math.pow(val - 49.5, 2), 0) / numbers.length;
      const correlation = sum / (n * variance);
      
      lags.push({ lag, correlation });
    }
    
    this.results.autocorrelation = lags;
    return this.results.autocorrelation;
  }

  // 4. Transition Matrix (Markov Chain)
  buildTransitionMatrix(order = 1) {
    const matrix = {};
    const numbers = this.historicalData.map(entry => entry.number);
    
    // Initialize matrix
    for (let i = 0; i < 100; i++) {
      matrix[i] = new Array(100).fill(0);
    }
    
    // Count transitions
    for (let i = order; i < numbers.length; i++) {
      const from = numbers[i - order];
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

  // 5. Runs Test
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

  // 6. Weighted Moving Average
  calculateMovingAverages(windowSize = 5) {
    const weights = Array.from({ length: windowSize }, (_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const numbers = this.historicalData.map(entry => entry.number);
    const movingAverages = [];
    
    for (let i = windowSize - 1; i < numbers.length; i++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += numbers[i - j] * weights[j];
      }
      movingAverages.push({
        index: i,
        date: this.historicalData[i].date,
        value: sum / totalWeight
      });
    }
    
    this.results.movingAverages = movingAverages;
    return this.results.movingAverages;
  }

  // 7. Bayesian Updating
  performBayesianUpdate() {
    // Prior: uniform distribution
    const prior = Array(100).fill(1/100);
    
    // Likelihood: frequency of each number
    const frequency = new Array(100).fill(0);
    this.historicalData.forEach(entry => {
      frequency[entry.number]++;
    });
    
    // Posterior: prior * likelihood
    const posterior = prior.map((p, i) => p * frequency[i]);
    const sum = posterior.reduce((a, b) => a + b, 0);
    
    // Normalize
    this.results.bayesianPredictions = posterior.map(p => p / sum);
    return this.results.bayesianPredictions;
  }

  // 8. Digit Correlation Analysis
  analyzeDigitCorrelations() {
    const digitPairs = Array(10).fill().map(() => Array(10).fill(0));
    
    this.historicalData.forEach(entry => {
      digitPairs[entry.tens][entry.units]++;
    });
    
    this.results.digitCorrelations = digitPairs;
    return this.results.digitCorrelations;
  }

  // 9. Machine Learning Predictions
  trainMLModel() {
    try {
      // Prepare features and labels
      const features = [];
      const labels = [];
      
      // Use last 5 numbers as features, predict next number
      for (let i = 5; i < this.historicalData.length; i++) {
        features.push([
          this.historicalData[i-5].number,
          this.historicalData[i-4].number,
          this.historicalData[i-3].number,
          this.historicalData[i-2].number,
          this.historicalData[i-1].number
        ]);
        labels.push(this.historicalData[i].number);
      }
      
      // Train Random Forest
      const options = {
        seed: 3,
        maxFeatures: 2,
        replacement: false,
        nEstimators: 200
      };
      
      const classifier = new RandomForestClassifier(options);
      classifier.train(features, labels);
      
      // Get predictions for all possible next numbers
      const lastFive = this.historicalData.slice(-5).map(entry => entry.number);
      const predictions = [];
      
      for (let i = 0; i < 100; i++) {
        const testFeatures = [...lastFive.slice(1), i];
        const prediction = classifier.predict([testFeatures]);
        predictions[i] = prediction[0];
      }
      
      this.results.mlPredictions = predictions;
      return this.results.mlPredictions;
      
    } catch (error) {
      logger.error('Error training ML model:', error);
      throw error;
    }
  }

  // 10. Monte Carlo Simulation
  runMonteCarloSimulation(iterations = 10000) {
    const frequency = new Array(100).fill(0);
    const transitionMatrix = this.results.transitionMatrix;
    
    // Start from last known number
    let current = this.historicalData[this.historicalData.length - 1].number;
    
    for (let i = 0; i < iterations; i++) {
      // Use transition matrix to get next number
      const probabilities = transitionMatrix[current] || Array(100).fill(0.01);
      const random = Math.random();
      let sum = 0;
      
      for (let j = 0; j < 100; j++) {
        sum += probabilities[j];
        if (random <= sum) {
          current = j;
          frequency[j]++;
          break;
        }
      }
    }
    
    // Convert counts to probabilities
    this.results.monteCarloResults = frequency.map(count => count / iterations);
    return this.results.monteCarloResults;
  }

  // 11. Generate Final Predictions
  generatePredictions() {
    // Combine all predictions with weights
    const combinedScores = new Array(100).fill(0);
    
    // Weights for different prediction methods
    const weights = {
      frequency: 0.2,
      transition: 0.3,
      bayesian: 0.1,
      ml: 0.3,
      monteCarlo: 0.1
    };
    
    // Normalize and combine scores
    for (let i = 0; i < 100; i++) {
      const freqScore = this.results.frequencyAnalysis[i]?.frequency || 0;
      const transScore = this.results.transitionMatrix[this.historicalData[this.historicalData.length - 1].number]?.[i] || 0;
      const bayesScore = this.results.bayesianPredictions[i] || 0;
      const mlScore = this.results.mlPredictions[i] || 0;
      const mcScore = this.results.monteCarloResults[i] || 0;
      
      combinedScores[i] = (
        freqScore * weights.frequency +
        transScore * weights.transition +
        bayesScore * weights.bayesian +
        mlScore * weights.ml +
        mcScore * weights.monteCarlo
      );
    }
    
    // Get top 10 predictions
    const predictions = combinedScores
      .map((score, number) => ({
        number,
        score,
        confidence: Math.min(100, Math.round(score * 10000) / 100) // Convert to percentage
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    this.results.finalPredictions = predictions;
    return this.results.finalPredictions;
  }

  // Run all analyses
  async runAllAnalyses(dataPath) {
    try {
      logger.info('Starting analysis...');
      
      // 1. Load and prepare data
      await this.loadData(dataPath);
      
      // 2. Perform statistical analyses
      this.performFrequencyAnalysis();
      this.performChiSquareTest();
      this.performAutocorrelationAnalysis();
      this.buildTransitionMatrix();
      this.performRunsTest();
      this.calculateMovingAverages();
      this.performBayesianUpdate();
      this.analyzeDigitCorrelations();
      
      // 3. Perform ML and simulation
      this.trainMLModel();
      this.runMonteCarloSimulation();
      
      // 4. Generate final predictions
      const predictions = this.generatePredictions();
      
      logger.info('Analysis completed successfully');
      
      return {
        summary: {
          totalRecords: this.historicalData.length,
          isRandom: this.results.chiSquareTest.isRandom,
          runsTest: this.results.runsTest,
          topPredictions: predictions
        },
        predictions,
        details: this.results
      };
      
    } catch (error) {
      logger.error('Error in analysis:', error);
      throw error;
    }
  }
}

// Export the prediction engine
module.exports = MatkaPredictionEngine;
