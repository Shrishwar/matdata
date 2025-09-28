import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
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

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login', credentials),
  register: (credentials: { username: string; password: string }) =>
    api.post('/auth/register', credentials),
  verify: () => api.get('/auth/verify'),
};

export const resultsAPI = {
  getResults: (params?: { page?: number; limit?: number }) =>
    api.get('/results', { params }),
  addResult: (data: { date?: string; open3: string; close3: string; middle: string; double: string }) =>
    api.post('/results', data),
  bulkImportResults: (data: any) => {
    if (data instanceof FormData) {
      // For file uploads, don't set Content-Type (let axios handle multipart)
      const config = { headers: { 'Content-Type': undefined } };
      return api.post('/results/bulk', data, config);
    } else {
      // For JSON array (backward compatibility)
      return api.post('/results/bulk', { results: data });
    }
  },
  getFuture: () =>
    api.get('/results/future'),
  getHistory: () =>
    api.get('/results/history'),
  getGuesses: (useLatest?: boolean) =>
    api.get('/results/guess', { params: useLatest ? { useLatest: 'true' } : {} }),
  fetchLatest: () =>
    api.get('/results/fetch-latest', { headers: { 'Cache-Control': 'no-cache' } }),
  subscribeToLatest: (onMessage: (data: any) => void, onError?: (error: Event) => void) => {
    const eventSource = new EventSource(`${API_BASE_URL}/results/stream/latest`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      if (onError) onError(error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  },
};

export default api;
