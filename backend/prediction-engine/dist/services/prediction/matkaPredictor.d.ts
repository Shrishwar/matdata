interface HistoricalData {
    number: number;
    date: Date;
    timestamp?: Date;
    gameType?: string;
    openClose?: 'OPEN' | 'CLOSE';
    middle?: number;
    double?: number;
    tens: number;
    units: number;
}
interface Prediction {
    number: number;
    score: number;
    confidence: number;
}
interface AnalysisResults {
    frequencyAnalysis: {
        numberFreq: Map<number, number>;
        digitFreq: {
            tens: Map<number, number>;
            units: Map<number, number>;
        };
        histogram: {
            bins: string[];
            counts: number[];
        };
        overrepresented: {
            number: number;
            count: number;
        }[];
        underrepresented: {
            number: number;
            count: number;
        }[];
    };
    chiSquareTest: {
        chiSquare: number;
        pValue: number;
        isRandom: boolean;
        degreesOfFreedom: number;
        deviatingNumbers: {
            number: number;
            observed: number;
            expected: number;
        }[];
    };
    autocorrelation: {
        lags: number[];
        correlations: number[];
        graphData: {
            x: number[];
            y: number[];
        };
    };
    markovMatrix: {
        firstOrder: number[][];
        secondOrder: number[][][];
        steadyStateProbs: number[];
    };
    runsTest: {
        runs: number;
        expectedRuns: number;
        zScore: number;
        pValue: number;
        isRandom: boolean;
    };
    trendAnalysis: {
        smoothedSeries: number[];
        smoothedEnhanced: number[];
        trend: number;
        probableNumbers: number[];
    };
    bayesianUpdate: {
        updatedProbs: Map<number, number>;
    };
    digitCorrelation: {
        correlationMatrix: number[][];
        frequentPairs: {
            tens: number;
            units: number;
            count: number;
        }[];
    };
    mlClassifier: {
        model: any;
        featureImportance: number[];
        probs: Map<number, number>;
    };
    monteCarlo: {
        occurrence: Map<number, number>;
    };
    confidenceRanking: {
        rankedNumbers: {
            number: number;
            score: number;
            confidence: number;
        }[];
    };
    spectralAnalysis: {
        dominantFrequencies: number[];
        signalEnergy: number;
    };
    patterns: any[];
    trends: any[];
    finalPredictions: Prediction[];
    modelMetrics?: {
        accuracy: number;
        precision: number;
        recall: number;
        f1Score: number;
        confusionMatrix: number[][];
        lastUpdated: string;
    };
}
declare class MatkaPredictor {
    private historicalData;
    private results;
    /**
     * Load historical data from MongoDB
     * @param timeRange Time range to load data for (e.g., '30d' for 30 days)
     * @returns Array of historical data points
     */
    loadData(timeRange?: string): Promise<HistoricalData[]>;
    /**
     * Perform data preparation: clean and extract digits
     */
    private prepareData;
    /**
     * Perform frequency analysis
     */
    private performFrequencyAnalysis;
    /**
     * Perform chi-square test
     */
    private performChiSquareTest;
    /**
     * Approximate chi-square CDF (simplified)
     */
    private chiSquareCDF;
    /**
     * Perform autocorrelation analysis
     */
    private performAutocorrelationAnalysis;
    /**
     * Build Markov transition matrix
     */
    private buildMarkovMatrix;
    /**
     * Perform runs test
     */
    private performRunsTest;
    /**
     * Normal CDF approximation
     */
    private normalCDF;
    /**
     * Perform trend analysis (EMA and Exponential Smoothing)
     */
    private performTrendAnalysis;
    /**
     * Perform Bayesian updating
     */
    private performBayesianUpdate;
    /**
     * Perform digit correlation analysis
     */
    private performDigitCorrelation;
    /**
     * Train ML classifier (Decision Tree and Random Forest ensemble)
     */
    private trainMLClassifier;
    /**
     * Perform Monte Carlo simulation
     */
    private performMonteCarloSimulation;
    /**
     * Compute confidence scores and ranking
     */
    private computeConfidenceScores;
    /**
     * Generate ensemble predictions
     */
    private generateEnsemblePredictions;
    /**
     * Perform spectral analysis using Fast Fourier Transform (FFT)
     * @param data Array of numbers to analyze
     * @returns Array of frequency magnitudes
     */
    private performSpectralAnalysis;
    /**
     * Perform k-means clustering on the data
     * @param data 2D array of data points
     * @param numClusters Number of clusters to create
     * @returns Array of cluster assignments
     */
    private performClustering;
    /**
     * Generate predictions based on historical data
     * @param limit Maximum number of predictions to return
     * @returns Object containing predictions and analysis
     */
    generatePredictions(limit?: number): Promise<{
        summary: {
            totalRecords: number;
            lastNumber: number;
            isRandom: boolean;
            runsTest: AnalysisResults['runsTest'];
            topPredictions: Prediction[];
            accuracy?: number;
            modelMetrics?: AnalysisResults['modelMetrics'];
            dataRange?: {
                startDate: Date;
                endDate: Date;
                totalDays: number;
                recordCount: number;
            };
            analysisTime: string;
        };
        predictions: Prediction[];
        analysis: Partial<AnalysisResults>;
        predictionTable?: any[];
    }>;
}
export default MatkaPredictor;
