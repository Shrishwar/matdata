interface HistoricalData {
    number: number;
    date: Date;
    timestamp?: Date;
    gameType?: string;
    openClose?: 'OPEN' | 'CLOSE';
    middle?: number;
    double?: number;
    tens?: number;
    units?: number;
}
interface Prediction {
    number: number;
    score: number;
    confidence: number;
}
interface AnalysisResults {
    frequencyAnalysis: any[];
    chiSquareTest: {
        chiSquare: number;
        pValue: number;
        isRandom: boolean;
        degreesOfFreedom: number;
    };
    transitionMatrix: Record<number, number[]>;
    runsTest: {
        runs: number;
        expectedRuns: number;
        zScore: number;
        pValue: number;
        isRandom: boolean;
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
    }>;
}
export default MatkaPredictor;
