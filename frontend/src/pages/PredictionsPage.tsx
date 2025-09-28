import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { predictionApi } from '../services/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Prediction {
  number: number;
  confidence: number;
}

const PredictionsPage = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'predictions' | 'analysis'>('predictions');
  const { token, user } = useAuth();

  const fetchPredictions = async () => {
    try {
      setIsLoading(true);
      const response = await predictionApi.getPredictions();
      
      if (response.success) {
        setPredictions(response.data.predictions);
        setAnalysis(response.data.analysis);
        setLastUpdated(new Date());
      } else {
        toast.error('Failed to fetch predictions');
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast.error('Error fetching predictions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPredictions();
    }
  }, [token]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-blue-100 text-blue-800';
    if (confidence >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Prepare data for charts
  const frequencyChartData = useMemo(() => {
    if (!analysis?.frequency) return null;
    
    const topNumbers = [...analysis.frequency]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
    
    return {
      labels: topNumbers.map(item => item.number.toString().padStart(2, '0')),
      datasets: [
        {
          label: 'Frequency %',
          data: topNumbers.map(item => (item.frequency * 100).toFixed(2)),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [analysis]);

  const trendChartData = useMemo(() => {
    if (!analysis?.frequency) return null;
    
    const trendingNumbers = [...analysis.frequency]
      .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))
      .slice(0, 10);
    
    return {
      labels: trendingNumbers.map(item => item.number.toString().padStart(2, '0')),
      datasets: [
        {
          label: 'Trend',
          data: trendingNumbers.map(item => (item.trend * 100).toFixed(2)),
          backgroundColor: trendingNumbers.map(item => 
            item.trend > 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderColor: trendingNumbers.map(item => 
            item.trend > 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)'
          ),
          borderWidth: 1,
        },
      ],
    };
  }, [analysis]);

  const formatNumber = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Next Number Predictions</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('predictions')}
              className={`px-4 py-2 rounded-md ${
                activeTab === 'predictions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Predictions
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-4 py-2 rounded-md ${
                activeTab === 'analysis'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Analysis
            </button>
            <button
              onClick={fetchPredictions}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>

        {lastUpdated && (
          <p className="text-sm text-gray-500 mb-6">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}

        {activeTab === 'predictions' ? (
          <>
            {isLoading && predictions.length === 0 ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {predictions.map((prediction, index) => (
                    <div 
                      key={prediction.number}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-transform transform hover:-translate-y-1"
                    >
                      <div className="p-4 text-center">
                        <div className="text-4xl font-bold text-gray-800 mb-2">
                          {formatNumber(prediction.number)}
                        </div>
                        <div className="text-sm text-gray-500">Prediction #{index + 1}</div>
                        <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                          prediction.confidence >= 80 ? 'bg-green-100 text-green-800' :
                          prediction.confidence >= 60 ? 'bg-blue-100 text-blue-800' :
                          prediction.confidence >= 40 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {prediction.confidence}% confidence
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {frequencyChartData && (
                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Top Numbers by Frequency</h3>
                    <div className="bg-white p-4 rounded-lg shadow">
                      <Bar
                        data={frequencyChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'top' as const,
                            },
                            title: {
                              display: true,
                              text: 'Most Frequent Numbers',
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Frequency %',
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-8">
            {trendChartData && (
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Number Trends</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Shows which numbers are trending up (green) or down (red) recently
                </p>
                <Bar
                  data={trendChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const value = context.raw as number;
                            return `Trend: ${value > 0 ? '+' : ''}${value}%`;
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Trend %',
                        },
                      },
                    },
                  }}
                />
              </div>
            )}

            {analysis?.patterns?.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Common Number Patterns</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Most frequently occurring number sequences
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.patterns.slice(0, 6).map(([pattern, count], index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          {pattern.split(',').map((num, i) => (
                            <span key={i} className="px-2 py-1 bg-white rounded-md shadow-sm text-sm font-medium">
                              {num.padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">{count}×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis?.spectral && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Spectral Analysis</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Detected periodic patterns in the number sequence
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Signal Strength:</span>
                    <span className="font-medium">
                      {Math.round(analysis.spectral.signalEnergy / 1000)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${Math.min(100, analysis.spectral.signalEnergy / 1000)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                These predictions are based on advanced statistical analysis of historical data. 
                They are for entertainment purposes only and do not guarantee future results.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionsPage;
