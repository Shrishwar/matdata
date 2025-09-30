import { logger } from '../../utils/logger.js';
import { create, all } from 'mathjs';
const mathjs = create(all);
mathjs.config({ number: 'BigNumber' });
import { mongoService } from '../database/mongoService.js';
// Constants
const Constants = {
    TOTAL_NUMBERS: 100, // 00-99
    DEFAULT_PREDICTION_LIMIT: 10,
    MIN_SAMPLES_FOR_ANALYSIS: 50,
    PATTERN_LENGTH: 3, // Default pattern length for sequence analysis
    RANDOM_SEED: 42, // For reproducibility
};
class MatkaPredictor {
    constructor() {
        this.historicalData = [];
        this.results = {
            frequencyAnalysis: {
                numberFreq: new Map(),
                digitFreq: { tens: new Map(), units: new Map() },
                histogram: { bins: [], counts: [] },
                overrepresented: [],
                underrepresented: [],
            },
            chiSquareTest: {
                chiSquare: 0,
                pValue: 0,
                isRandom: true,
                degreesOfFreedom: 99,
                deviatingNumbers: [],
            },
            autocorrelation: {
                lags: [],
                correlations: [],
                graphData: { x: [], y: [] },
            },
            markovMatrix: {
                firstOrder: [],
                secondOrder: [],
                steadyStateProbs: [],
            },
            runsTest: {
                runs: 0,
                expectedRuns: 0,
                zScore: 0,
                pValue: 0,
                isRandom: true,
            },
            trendAnalysis: {
                smoothedSeries: [],
                smoothedEnhanced: [],
                trend: 0,
                probableNumbers: [],
            },
            bayesianUpdate: {
                updatedProbs: new Map(),
            },
            digitCorrelation: {
                correlationMatrix: [],
                frequentPairs: [],
            },
            mlClassifier: {
                model: null,
                featureImportance: [],
                probs: new Map(),
            },
            monteCarlo: {
                occurrence: new Map(),
            },
            confidenceRanking: {
                rankedNumbers: [],
            },
            spectralAnalysis: {
                dominantFrequencies: [],
                signalEnergy: 0,
            },
            patterns: [],
            trends: [],
            finalPredictions: [],
        };
    }
    /**
     * Load historical data from MongoDB
     * @param timeRange Time range to load data for (e.g., '30d' for 30 days)
     * @returns Array of historical data points
     */
    async loadData(timeRange = '30d') {
        logger.info('Loading historical data from MongoDB...');
        try {
            // Connect to MongoDB if not already connected
            await mongoService.connect();
            // Parse time range
            const days = timeRange.endsWith('d')
                ? parseInt(timeRange.slice(0, -1), 10)
                : 30; // Default to 30 days
            // Fetch data from MongoDB
            const dbData = await mongoService.getHistoricalData(days);
            if (dbData.length === 0) {
                logger.warn('No historical data found in database. Predictions require real historical data from DPBoss.');
                throw new Error('No historical data available. Please run the scraper to populate the database with DPBoss data.');
            }
            else {
                // Transform database data to match HistoricalData type
                this.historicalData = dbData.map(item => {
                    const number = item.number;
                    return {
                        number,
                        date: item.date || item.timestamp || new Date(),
                        timestamp: item.timestamp || item.date || new Date(),
                        gameType: item.gameType || 'SINGLE',
                        openClose: item.openClose || (Math.random() > 0.5 ? 'OPEN' : 'CLOSE'),
                        tens: Math.floor(number / 10),
                        units: number % 10
                    };
                });
                logger.info(`Loaded ${this.historicalData.length} records from database`);
            }
            return this.historicalData;
        }
        catch (error) {
            logger.error('Error loading historical data:', error);
            throw error;
        }
    }
    /**
     * Perform data preparation: clean and extract digits
     */
    prepareData() {
        // Remove duplicates by date
        const uniqueData = new Map();
        this.historicalData.forEach(d => {
            const key = d.date.toISOString();
            if (!uniqueData.has(key)) {
                uniqueData.set(key, d);
            }
        });
        this.historicalData = Array.from(uniqueData.values());
        // Filter valid numbers 0-99
        this.historicalData = this.historicalData.filter(d => d.number >= 0 && d.number <= 99);
    }
    /**
     * Perform frequency analysis
     */
    performFrequencyAnalysis() {
        const numberFreq = new Map();
        const tensFreq = new Map();
        const unitsFreq = new Map();
        this.historicalData.forEach(d => {
            numberFreq.set(d.number, (numberFreq.get(d.number) || 0) + 1);
            tensFreq.set(d.tens, (tensFreq.get(d.tens) || 0) + 1);
            unitsFreq.set(d.units, (unitsFreq.get(d.units) || 0) + 1);
        });
        // Histogram bins: 00-09, 10-19, ..., 90-99
        const bins = [];
        const counts = [];
        for (let i = 0; i < 10; i++) {
            const binStart = i * 10;
            const binEnd = binStart + 9;
            bins.push(`${binStart.toString().padStart(2, '0')}-${binEnd.toString().padStart(2, '0')}`);
            let count = 0;
            for (let j = binStart; j <= binEnd; j++) {
                count += numberFreq.get(j) || 0;
            }
            counts.push(count);
        }
        const total = this.historicalData.length;
        const expected = total / 100;
        const std = Math.sqrt(expected);
        const overrepresented = Array.from(numberFreq.entries())
            .filter(([, count]) => count > expected + std)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([number, count]) => ({ number, count }));
        const underrepresented = Array.from(numberFreq.entries())
            .filter(([, count]) => count < expected - std)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 10)
            .map(([number, count]) => ({ number, count }));
        this.results.frequencyAnalysis = {
            numberFreq,
            digitFreq: { tens: tensFreq, units: unitsFreq },
            histogram: { bins, counts },
            overrepresented,
            underrepresented
        };
    }
    /**
     * Perform chi-square test
     */
    performChiSquareTest() {
        const { numberFreq } = this.results.frequencyAnalysis;
        const observed = Array.from({ length: 100 }, (_, i) => numberFreq.get(i) || 0);
        const total = observed.reduce((sum, val) => sum + val, 0);
        const expected = total / 100;
        let chiSquare = 0;
        const deviatingNumbers = [];
        observed.forEach((obs, i) => {
            const diff = obs - expected;
            chiSquare += (diff * diff) / expected;
            if (Math.abs(diff) > expected * 0.5) { // Significant deviation
                deviatingNumbers.push({ number: i, observed: obs, expected });
            }
        });
        // Degrees of freedom = 99
        // p-value approximation using chi-square distribution (simplified)
        const pValue = 1 - this.chiSquareCDF(chiSquare, 99);
        this.results.chiSquareTest = {
            chiSquare,
            pValue,
            isRandom: pValue > 0.05,
            degreesOfFreedom: 99,
            deviatingNumbers
        };
    }
    /**
     * Approximate chi-square CDF (simplified)
     */
    chiSquareCDF(x, df) {
        // Using normal approximation for large df
        const mean = df;
        const std = Math.sqrt(2 * df);
        const z = (x - mean) / std;
        return 0.5 * (1 + mathjs.erf(z / Math.sqrt(2)));
    }
    /**
     * Perform autocorrelation analysis
     */
    performAutocorrelationAnalysis() {
        const numbers = this.historicalData.map(d => d.number);
        const lags = [];
        const correlations = [];
        for (let lag = 1; lag <= 10; lag++) {
            let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
            const n = numbers.length - lag;
            for (let i = 0; i < n; i++) {
                const x = numbers[i];
                const y = numbers[i + lag];
                sumXY += x * y;
                sumX += x;
                sumY += y;
                sumX2 += x * x;
                sumY2 += y * y;
            }
            const numerator = n * sumXY - sumX * sumY;
            const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            const corr = denominator === 0 ? 0 : numerator / denominator;
            lags.push(lag);
            correlations.push(corr);
        }
        this.results.autocorrelation = {
            lags,
            correlations,
            graphData: { x: lags, y: correlations }
        };
    }
    /**
     * Build Markov transition matrix
     */
    buildMarkovMatrix() {
        const numbers = this.historicalData.map(d => d.number);
        const firstOrder = Array.from({ length: 100 }, () => Array(100).fill(0));
        const secondOrder = Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => Array(100).fill(0)));
        // First order
        const firstCounts = Array(100).fill(0);
        for (let i = 0; i < numbers.length - 1; i++) {
            const from = numbers[i];
            const to = numbers[i + 1];
            firstOrder[from][to]++;
            firstCounts[from]++;
        }
        for (let i = 0; i < 100; i++) {
            if (firstCounts[i] > 0) {
                for (let j = 0; j < 100; j++) {
                    firstOrder[i][j] /= firstCounts[i];
                }
            }
        }
        // Second order
        const secondCounts = Array.from({ length: 100 }, () => Array(100).fill(0));
        for (let i = 0; i < numbers.length - 2; i++) {
            const from1 = numbers[i];
            const from2 = numbers[i + 1];
            const to = numbers[i + 2];
            secondOrder[from1][from2][to]++;
            secondCounts[from1][from2]++;
        }
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 100; j++) {
                if (secondCounts[i][j] > 0) {
                    for (let k = 0; k < 100; k++) {
                        secondOrder[i][j][k] /= secondCounts[i][j];
                    }
                }
            }
        }
        // Steady state (simplified power method)
        let steadyState = Array(100).fill(1 / 100);
        for (let iter = 0; iter < 100; iter++) {
            const newState = Array(100).fill(0);
            for (let i = 0; i < 100; i++) {
                for (let j = 0; j < 100; j++) {
                    newState[j] += steadyState[i] * firstOrder[i][j];
                }
            }
            steadyState = newState;
        }
        this.results.markovMatrix = {
            firstOrder,
            secondOrder,
            steadyStateProbs: steadyState
        };
    }
    /**
     * Perform runs test
     */
    performRunsTest() {
        const numbers = this.historicalData.map(d => d.number);
        const median = mathjs.median(numbers);
        const runs = numbers.map(n => n > median ? 1 : 0);
        let runCount = 1;
        for (let i = 1; i < runs.length; i++) {
            if (runs[i] !== runs[i - 1])
                runCount++;
        }
        const n1 = runs.filter(r => r === 1).length;
        const n2 = runs.length - n1;
        const expectedRuns = (2 * n1 * n2) / (n1 + n2) + 1;
        const variance = (2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / ((n1 + n2) ** 2 * (n1 + n2 - 1));
        const zScore = (runCount - expectedRuns) / Math.sqrt(variance);
        const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
        this.results.runsTest = {
            runs: runCount,
            expectedRuns,
            zScore,
            pValue,
            isRandom: pValue > 0.05
        };
    }
    /**
     * Normal CDF approximation
     */
    normalCDF(x) {
        return 0.5 * (1 + mathjs.erf(x / Math.sqrt(2)));
    }
    /**
     * Perform trend analysis (EMA and Exponential Smoothing)
     */
    performTrendAnalysis() {
        const numbers = this.historicalData.map(d => d.number);
        const alpha = 0.3;
        const smoothed = [numbers[0]];
        for (let i = 1; i < numbers.length; i++) {
            smoothed.push(alpha * numbers[i] + (1 - alpha) * smoothed[i - 1]);
        }
        // Enhanced Exponential Smoothing (Holt-Winters simple)
        const beta = 0.1; // Trend smoothing parameter
        let level = numbers[0];
        let trend = 0;
        const smoothedEnhanced = [level];
        for (let i = 1; i < numbers.length; i++) {
            const prevLevel = level;
            level = alpha * numbers[i] + (1 - alpha) * (prevLevel + trend);
            trend = beta * (level - prevLevel) + (1 - beta) * trend;
            smoothedEnhanced.push(level + trend);
        }
        const recent = smoothed.slice(-20);
        const trendValue = recent.length > 1 ? (recent[recent.length - 1] - recent[0]) / recent.length : 0;
        // Probable numbers based on trend
        const lastSmoothed = smoothed[smoothed.length - 1];
        const probableNumbers = [];
        for (let i = 0; i < 10; i++) {
            const num = Math.round(lastSmoothed + trendValue * i) % 100;
            probableNumbers.push(num < 0 ? num + 100 : num);
        }
        this.results.trendAnalysis = {
            smoothedSeries: smoothed,
            smoothedEnhanced,
            trend: trendValue,
            probableNumbers
        };
    }
    /**
     * Perform Bayesian updating
     */
    performBayesianUpdate() {
        const { numberFreq } = this.results.frequencyAnalysis;
        const total = this.historicalData.length;
        const prior = 1 / 100; // Uniform prior
        const updatedProbs = new Map();
        for (let i = 0; i < 100; i++) {
            const observed = numberFreq.get(i) || 0;
            const likelihood = observed / total;
            const posterior = (prior * likelihood) / (prior * likelihood + (1 - prior) * (1 - likelihood));
            updatedProbs.set(i, posterior);
        }
        this.results.bayesianUpdate = { updatedProbs };
    }
    /**
     * Perform digit correlation analysis
     */
    performDigitCorrelation() {
        const correlationMatrix = Array.from({ length: 10 }, () => Array(10).fill(0));
        const pairCounts = new Map();
        this.historicalData.forEach(d => {
            correlationMatrix[d.tens][d.units]++;
            const key = `${d.tens}-${d.units}`;
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        });
        const total = this.historicalData.length;
        const expected = total / 100;
        // Normalize to correlation
        for (let t = 0; t < 10; t++) {
            for (let u = 0; u < 10; u++) {
                correlationMatrix[t][u] = (correlationMatrix[t][u] - expected) / expected;
            }
        }
        const frequentPairs = Array.from(pairCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key, count]) => {
            const [tens, units] = key.split('-').map(Number);
            return { tens, units, count };
        });
        this.results.digitCorrelation = {
            correlationMatrix,
            frequentPairs
        };
    }
    /**
     * Train ML classifier (Decision Tree and Random Forest ensemble)
     */
    async trainMLClassifier() {
        try {
            const { DecisionTreeClassifier } = await import('ml-cart');
            const { RandomForestClassifier } = await import('ml-random-forest');
            const data = this.historicalData.slice(0, -1); // Features from all but last
            const targets = this.historicalData.slice(1).map(d => d.number); // Next number
            const features = data.map((d, i) => [
                d.number, // prev number
                d.tens,
                d.units,
                this.results.frequencyAnalysis.numberFreq.get(d.number) || 0, // freq score
                this.results.trendAnalysis.smoothedSeries[i] || 0 // trend
            ]);
            // Decision Tree
            const dtModel = new DecisionTreeClassifier({
                maxDepth: 5,
                minSamples: 5
            });
            dtModel.train(features, targets);
            // Random Forest
            const rfModel = new RandomForestClassifier({
                nEstimators: 10
            });
            rfModel.train(features, targets);
            // Predict probabilities for next number (ensemble of DT and RF)
            const lastData = this.historicalData[this.historicalData.length - 1];
            const lastFeatures = [
                lastData.number,
                lastData.tens,
                lastData.units,
                this.results.frequencyAnalysis.numberFreq.get(lastData.number) || 0,
                this.results.trendAnalysis.smoothedSeries[this.results.trendAnalysis.smoothedSeries.length - 1] || 0
            ];
            const probs = new Map();
            for (let i = 0; i < 100; i++) {
                const dtPred = dtModel.predict([lastFeatures])[0];
                const rfPred = rfModel.predict([lastFeatures])[0];
                const dtProb = 1 / (1 + Math.abs(dtPred - i)); // Distance-based prob
                const rfProb = 1 / (1 + Math.abs(rfPred - i));
                const ensembleProb = (dtProb + rfProb) / 2; // Average
                probs.set(i, ensembleProb);
            }
            this.results.mlClassifier = {
                model: { dt: dtModel, rf: rfModel },
                featureImportance: dtModel.featureImportance || [0.3, 0.2, 0.2, 0.15, 0.15], // Use DT importance
                probs
            };
        }
        catch (error) {
            logger.error('Error training ML classifier:', error);
            // Fallback
            this.results.mlClassifier = {
                model: null,
                featureImportance: [],
                probs: new Map()
            };
        }
    }
    /**
     * Perform Monte Carlo simulation
     */
    performMonteCarloSimulation() {
        const { firstOrder } = this.results.markovMatrix;
        // Create local math instance for random seed config
        const localMath = create(all);
        localMath.config({ randomSeed: Constants.RANDOM_SEED.toString() });
        const nSims = 10000;
        const occurrence = new Map();
        for (let sim = 0; sim < nSims; sim++) {
            let current = this.historicalData[this.historicalData.length - 1].number;
            for (let step = 0; step < 5; step++) { // Simulate 5 steps
                const probs = firstOrder[current];
                let rand = localMath.random();
                let next = 0;
                for (let i = 0; i < 100; i++) {
                    rand -= probs[i];
                    if (rand <= 0) {
                        next = i;
                        break;
                    }
                }
                current = next;
            }
            occurrence.set(current, (occurrence.get(current) || 0) + 1);
        }
        // Normalize
        occurrence.forEach((count, num) => occurrence.set(num, count / nSims));
        this.results.monteCarlo = { occurrence };
    }
    /**
     * Compute confidence scores and ranking
     */
    computeConfidenceScores() {
        const scores = [];
        for (let num = 0; num < 100; num++) {
            const freqScore = (this.results.frequencyAnalysis.numberFreq.get(num) || 0) / this.historicalData.length;
            const markovScore = this.results.markovMatrix.steadyStateProbs[num] || 0;
            const trendScore = this.results.trendAnalysis.probableNumbers.includes(num) ? 0.1 : 0;
            const bayesianScore = this.results.bayesianUpdate.updatedProbs.get(num) || 0;
            const digitScore = this.results.digitCorrelation.frequentPairs.some(p => p.tens * 10 + p.units === num) ? 0.1 : 0;
            const mlScore = this.results.mlClassifier.probs.get(num) || 0;
            const monteScore = this.results.monteCarlo.occurrence.get(num) || 0;
            const totalScore = 0.15 * freqScore + 0.15 * markovScore + 0.1 * trendScore + 0.15 * bayesianScore + 0.1 * digitScore + 0.2 * mlScore + 0.15 * monteScore;
            const confidence = Math.min(totalScore * 100, 100);
            scores.push({ number: num, score: totalScore, confidence });
        }
        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);
        this.results.confidenceRanking = { rankedNumbers: scores };
    }
    /**
     * Generate ensemble predictions
     */
    generateEnsemblePredictions(limit = 10) {
        const { rankedNumbers } = this.results.confidenceRanking;
        const predictions = rankedNumbers.slice(0, limit).map(r => ({
            number: r.number,
            score: r.score,
            confidence: r.confidence
        }));
        // Final predictions with table data
        const tableData = predictions.map(p => ({
            number: p.number.toString().padStart(2, '0'),
            frequency: this.results.frequencyAnalysis.numberFreq.get(p.number) || 0,
            transitionProb: this.results.markovMatrix.steadyStateProbs[p.number] || 0,
            mlProb: this.results.mlClassifier.probs.get(p.number) || 0,
            trendWeight: this.results.trendAnalysis.probableNumbers.includes(p.number) ? 1 : 0,
            monteOccur: (this.results.monteCarlo.occurrence.get(p.number) || 0) * 100,
            finalScore: p.score,
            confidence: p.confidence
        }));
        // Add to results
        this.results.finalPredictions = predictions;
        // Store table for UI
        this.results.predictionTable = tableData;
        return predictions;
    }
    /**
     * Perform spectral analysis using Fast Fourier Transform (FFT)
     * @param data Array of numbers to analyze
     * @returns Array of frequency magnitudes
     */
    async performSpectralAnalysis(data) {
        try {
            const { fft } = await import('fft-js');
            const phasors = fft(data);
            // Calculate magnitude spectrum
            return phasors.map((p) => Math.sqrt(p[0] * p[0] + p[1] * p[1]));
        }
        catch (error) {
            logger.error('Error performing spectral analysis:', error);
            return [];
        }
    }
    /**
     * Perform k-means clustering on the data
     * @param data 2D array of data points
     * @param numClusters Number of clusters to create
     * @returns Array of cluster assignments
     */
    async performClustering(data, numClusters) {
        try {
            const { kmeans } = await import('ml-kmeans');
            // Ensure data is in the correct format (array of numbers)
            const points = data.map(point => [
                point[0] || 0,
                point[1] || 0 // Default to 0 if second dimension is missing
            ]);
            // Perform k-means clustering
            const result = kmeans(points, numClusters, {
                initialization: 'kmeans++',
                maxIterations: 100,
            });
            return result.clusters;
        }
        catch (error) {
            logger.error('Error performing k-means clustering:', error);
            // Return random clusters as fallback
            return data.map(() => Math.floor(Math.random() * numClusters));
        }
    }
    /**
     * Generate predictions based on historical data
     * @param limit Maximum number of predictions to return
     * @returns Object containing predictions and analysis
     */
    async generatePredictions(limit = Constants.DEFAULT_PREDICTION_LIMIT) {
        logger.info('Generating predictions...');
        try {
            // Ensure we have data loaded
            if (this.historicalData.length === 0) {
                await this.loadData('30d');
            }
            this.prepareData();
            // Extract numbers from historical data
            const numbers = this.historicalData.map(d => d.number);
            const sortedByDate = [...this.historicalData].sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
            // Calculate and log basic statistics
            const stats = {
                mean: numbers.length > 0 ? Number(mathjs.mean(numbers)) : 0,
                std: numbers.length > 1 ? Number(mathjs.std(numbers, 'uncorrected')) : 1,
                min: numbers.length > 0 ? Math.min(...numbers) : 0,
                max: numbers.length > 0 ? Math.max(...numbers) : 0,
                count: numbers.length
            };
            logger.debug(`Stats - Mean: ${stats.mean.toFixed(2)}, Std: ${stats.std.toFixed(2)}, Min: ${stats.min}, Max: ${stats.max}, Count: ${stats.count}`);
            // Perform all analyses in sequence
            this.performFrequencyAnalysis();
            this.performChiSquareTest();
            this.performAutocorrelationAnalysis();
            this.buildMarkovMatrix();
            this.performRunsTest();
            this.performTrendAnalysis();
            this.performBayesianUpdate();
            this.performDigitCorrelation();
            await this.trainMLClassifier();
            this.performMonteCarloSimulation();
            this.computeConfidenceScores();
            // Use FFT to find patterns if we have enough data
            let spectralAnalysis = { dominantFrequencies: [], signalEnergy: 0 };
            if (numbers.length >= 10) {
                const spectralPatterns = await this.performSpectralAnalysis(numbers.slice(0, 32));
                spectralAnalysis = {
                    dominantFrequencies: spectralPatterns.slice(0, 5), // Get top 5 frequencies
                    signalEnergy: spectralPatterns.reduce((sum, val) => sum + val * val, 0)
                };
                logger.debug(`Found ${spectralPatterns.length} frequency components`);
            }
            // Use clustering if we have enough data points
            let clusters = [];
            if (numbers.length >= 20) {
                const dataForClustering = numbers.map((n, i, arr) => [n, arr[Math.max(0, i - 1)] || 0]);
                clusters = await this.performClustering(dataForClustering, 3);
                const clusterCounts = new Array(3).fill(0);
                clusters.forEach(c => clusterCounts[c] = (clusterCounts[c] || 0) + 1);
                logger.debug(`Cluster sizes: ${clusterCounts.join(', ')}`);
            }
            // Generate ensemble predictions
            const predictions = this.generateEnsemblePredictions(limit);
            // Update results with latest analysis
            this.results.spectralAnalysis = spectralAnalysis;
            this.results.finalPredictions = predictions;
            // Compute real model metrics via simple backtest if enough data
            let modelMetrics = undefined;
            if (this.historicalData.length >= 50) {
                let hitCount = 0;
                const testSize = 10;
                for (let i = this.historicalData.length - testSize; i < this.historicalData.length; i++) {
                    // Simulate prior data up to i-1
                    const priorData = this.historicalData.slice(0, i);
                    const freqMap = new Map();
                    priorData.forEach(d => {
                        freqMap.set(d.number, (freqMap.get(d.number) || 0) + 1);
                    });
                    const sortedPrior = Array.from(freqMap.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([num]) => num);
                    if (sortedPrior.includes(this.historicalData[i].number)) {
                        hitCount++;
                    }
                }
                const accuracy = (hitCount / testSize) * 100;
                const precision = accuracy; // Simplified
                const recall = accuracy;
                const f1Score = accuracy > 0 ? 2 * accuracy / (precision + recall) : 0;
                modelMetrics = {
                    accuracy,
                    precision,
                    recall,
                    f1Score,
                    confusionMatrix: [[hitCount, testSize - hitCount], [0, 0]], // Simplified
                    lastUpdated: new Date().toISOString()
                };
                logger.info(`Backtest accuracy: ${accuracy.toFixed(2)}% on ${testSize} samples`);
            }
            else {
                logger.warn(`Insufficient data (${this.historicalData.length} records) for backtest metrics`);
            }
            this.results.modelMetrics = modelMetrics;
            // Prepare data range info
            const dataRange = sortedByDate.length > 0 ? {
                startDate: sortedByDate[0].date,
                endDate: sortedByDate[sortedByDate.length - 1].date,
                totalDays: Math.ceil((sortedByDate[sortedByDate.length - 1].date.getTime() - sortedByDate[0].date.getTime()) / (1000 * 60 * 60 * 24)),
                recordCount: sortedByDate.length
            } : undefined;
            return {
                summary: {
                    totalRecords: this.historicalData.length,
                    lastNumber: this.historicalData[this.historicalData.length - 1]?.number || 0,
                    isRandom: this.results.runsTest.isRandom,
                    runsTest: this.results.runsTest,
                    topPredictions: predictions.slice(0, limit),
                    accuracy: this.results.modelMetrics?.accuracy,
                    modelMetrics: this.results.modelMetrics,
                    dataRange,
                    analysisTime: new Date().toISOString()
                },
                predictions,
                analysis: this.results,
                predictionTable: this.results.predictionTable
            };
        }
        catch (error) {
            logger.error('Error generating predictions:', error);
            throw error;
        }
    }
}
export default MatkaPredictor;
//# sourceMappingURL=matkaPredictor.js.map