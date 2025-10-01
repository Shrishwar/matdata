import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Prediction {
  number: number;
  score: number;
  confidence: number;
}

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout
});

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { status, data } = error.response;
      
      if (status === 401) {
        // Handle unauthorized access
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      const errorMessage = typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message: string }).message
        : 'An error occurred';
        
      toast.error(errorMessage);
    } else if (error.request) {
      // The request was made but no response was received
      toast.error('No response from server. Please check your connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      toast.error('Request setup error');
    }
    
    return Promise.reject(error);
  }
);

interface ApiResponse<T> {
  success: boolean;
  data: T;
  status?: number;
}

interface Prediction {
  number: number;
  confidence: number;
  score: number;
}

// Analysis interfaces
interface FrequencyAnalysis {
  numberFreq: Map<number, number>;
  digitFreq: { tens: Map<number, number>; units: Map<number, number> };
  histogram: { bins: string[]; counts: number[] };
  overrepresented: { number: number; count: number }[];
  underrepresented: { number: number; count: number }[];
}

interface ChiSquareTest {
  chiSquare: number;
  pValue: number;
  isRandom: boolean;
  degreesOfFreedom: number;
  deviatingNumbers: { number: number; observed: number; expected: number }[];
}

interface Autocorrelation {
  lags: number[];
  correlations: number[];
  graphData: { x: number[]; y: number[] };
}

interface MarkovMatrix {
  firstOrder: number[][];
  secondOrder: number[][][];
  steadyStateProbs: number[];
}

interface RunsTest {
  runs: number;
  expectedRuns: number;
  zScore: number;
  pValue: number;
  isRandom: boolean;
}

interface TrendAnalysis {
  smoothedSeries: number[];
  smoothedEnhanced: number[];
  trend: number;
  probableNumbers: number[];
}

interface BayesianUpdate {
  updatedProbs: Map<number, number>;
}

interface DigitCorrelation {
  correlationMatrix: number[][];
  frequentPairs: { tens: number; units: number; count: number }[];
}

interface MLClassifier {
  model: any;
  featureImportance: number[];
  probs: Map<number, number>;
}

interface MonteCarlo {
  occurrence: Map<number, number>;
}

interface ConfidenceRanking {
  rankedNumbers: { number: number; score: number; confidence: number }[];
}

interface SpectralAnalysis {
  dominantFrequencies: number[];
  signalEnergy: number;
}

interface AnalysisResults {
  frequencyAnalysis: FrequencyAnalysis;
  chiSquareTest: ChiSquareTest;
  autocorrelation: Autocorrelation;
  markovMatrix: MarkovMatrix;
  runsTest: RunsTest;
  trendAnalysis: TrendAnalysis;
  bayesianUpdate: BayesianUpdate;
  digitCorrelation: DigitCorrelation;
  mlClassifier: MLClassifier;
  monteCarlo: MonteCarlo;
  confidenceRanking: ConfidenceRanking;
  spectralAnalysis: SpectralAnalysis;
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

interface PredictionTableItem {
  number: string;
  frequency: number;
  transitionProb: number;
  mlProb: number;
  trendWeight: number;
  monteOccur: number;
  finalScore: number;
  confidence: number;
}

// API methods
export const predictionApi = {
  // Get predictions for the next number with analysis
  getPredictions: async (limit: number = 10): Promise<ApiResponse<{
    predictions: Prediction[];
    analysis: AnalysisResults;
    predictionTable: PredictionTableItem[];
    summary: any;
  }>> => {
    try {
      const response = await api.get('/api/predictions/next', {
        params: { limit },
        timeout: 60000, // 1 minute timeout for predictions
      });
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching predictions:', error);
      throw error;
    }
  },

  // Get hybrid combined predictions (top 5 by default)
  getCombined: async (limit: number = 5): Promise<ApiResponse<{ top: Array<{ number: number; confidence: number; human: string[]; system: string[] }>; provenance: any }>> => {
    try {
      const response = await api.get('/api/predictions/combined', { params: { limit } });
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching combined predictions:', error);
      throw error;
    }
  },

  // Get live predictions based on DPBoss live chart data
  getLivePredictions: async (limit: number = 5): Promise<ApiResponse<{
    predictions: Prediction[];
    analysis: Partial<AnalysisResults>;
    provenance: any;
  }>> => {
    try {
      const response = await api.get('/api/predictions/live', {
        params: { limit },
        timeout: 60000,
      });
      return { success: response.data.success, data: response.data, status: response.status };
    } catch (error) {
      console.error('Error fetching live predictions:', error);
      throw error;
    }
  },

  // Get detailed analysis (admin only)
  getAnalysis: async (timeRange: 'day' | 'week' | 'month' = 'day'): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/predictions/analysis', {
        params: { range: timeRange },
      });
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching analysis:', error);
      throw error;
    }
  },

  // Get historical predictions accuracy
  getAccuracy: async (days: number = 30): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/predictions/accuracy', {
        params: { days },
      });
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
      throw error;
    }
  },

  // Get pattern analysis
  getPatterns: async (patternLength: number = 3): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/predictions/patterns', {
        params: { length: patternLength },
      });
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching pattern analysis:', error);
      throw error;
    }
  },

  // Get spectral analysis
  getSpectralAnalysis: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/predictions/spectral');
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching spectral analysis:', error);
      throw error;
    }
  },

  // Get model performance metrics
  getModelMetrics: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/predictions/metrics');
      return { success: response.data.success, data: response.data.data, status: response.status };
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      throw error;
    }
  },
};

export const resultsAPI = {
  // Get upcoming panel info
  getFuture: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/results/future');
      return { success: true, data: response.data.upcoming, status: response.status };
    } catch (error) {
      console.error('Error fetching future results:', error);
      throw error;
    }
  },

  // Get guesses
  getGuesses: async (forcePredict: boolean = false): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/results/guess', {
        params: { useLatest: forcePredict },
      });
      return { success: response.data.ok === true, data: response.data, status: response.status };
    } catch (error) {
      console.error('Error fetching guesses:', error);
      throw error;
    }
  },

  // Fetch latest result
  fetchLatest: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/api/results/fetch-latest', { headers: { 'Cache-Control': 'no-cache' } });
      return { success: response.data.ok === true, data: response.data.latest, status: response.status };
    } catch (error) {
      console.error('Error fetching latest result:', error);
      throw error;
    }
  },

  // Subscribe to latest updates via SSE
  subscribeToLatest: (
    onData: (data: any) => void,
    onError: (error: Event | string) => void
  ): (() => void) => {
    const eventSource = new EventSource(`${API_URL}/api/results/stream/latest`);
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
      onData({ type: 'connected' });
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onData({ type: 'latest-update', ...data });
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      onError(error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      console.log('SSE connection closed');
    };
  },

  // Get historical results
  getHistory: async (limit: number = 50): Promise<ApiResponse<{ history: any[] }>> => {
    try {
      const response = await api.get('/api/history', {
        params: { limit },
      });
      return { success: true, data: { history: response.data.history }, status: response.status };
    } catch (error) {
      console.error('Error fetching history:', error);
      throw error;
    }
  },
};

export default api;
