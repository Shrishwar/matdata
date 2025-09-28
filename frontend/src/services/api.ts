import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

// API methods
export const predictionApi = {
  // Get predictions for the next number with analysis
  getPredictions: async (limit: number = 10) => {
    try {
      const response = await api.get('/api/predictions/next', {
        params: { limit },
        timeout: 60000, // 1 minute timeout for predictions
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching predictions:', error);
      throw error;
    }
  },
  
  // Get detailed analysis (admin only)
  getAnalysis: async (timeRange: 'day' | 'week' | 'month' = 'day') => {
    try {
      const response = await api.get('/api/predictions/analysis', {
        params: { range: timeRange },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching analysis:', error);
      throw error;
    }
  },
  
  // Get historical predictions accuracy
  getAccuracy: async (days: number = 30) => {
    try {
      const response = await api.get('/api/predictions/accuracy', {
        params: { days },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
      throw error;
    }
  },
  
  // Get pattern analysis
  getPatterns: async (patternLength: number = 3) => {
    try {
      const response = await api.get('/api/predictions/patterns', {
        params: { length: patternLength },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching pattern analysis:', error);
      throw error;
    }
  },
  
  // Get spectral analysis
  getSpectralAnalysis: async () => {
    try {
      const response = await api.get('/api/predictions/spectral');
      return response.data;
    } catch (error) {
      console.error('Error fetching spectral analysis:', error);
      throw error;
    }
  },
  
  // Get model performance metrics
  getModelMetrics: async () => {
    try {
      const response = await api.get('/api/predictions/metrics');
      return response.data;
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      throw error;
    }
  },
};

export default api;
