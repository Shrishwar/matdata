import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { predictionApi } from '../services/api';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface Prediction {
  number: number;
  confidence: number;
}

const PANELS = [
  { key: 'MAIN_BAZAR', name: 'Main Bazar' },
  { key: 'KALYAN', name: 'Kalyan' },
  { key: 'MILAN', name: 'Milan' },
  { key: 'RAJDHANI', name: 'Rajdhani' }
];

const PredictionsPage = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [predictionTable, setPredictionTable] = useState<any[]>([]);
  const [liveData, setLiveData] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'predictions' | 'analysis'>('predictions');
  const [selectedPanel, setSelectedPanel] = useState('MAIN_BAZAR');
  const [latestResult, setLatestResult] = useState<any>(null);
  const [latestLoading, setLatestLoading] = useState(false);
  const { user } = useAuth();

  const fetchPredictions = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching predictions...');
      const response = await predictionApi.getPredictions(3, selectedPanel);
      console.log('Predictions response:', response);
      
      if (response.success) {
        setPredictions(response.data.predictions);
        setAnalysis(response.data.analysis);
        setPredictionTable(response.data.predictionTable || []);
        setLastUpdated(new Date());
      } else {
        // fallback to hybrid top 3
        try {
          const resp = await predictionApi.getCombined(3);
          if (resp.success) {
            setPredictions(resp.data.top.map((t: any) => ({ number: t.number, confidence: t.confidence })));
            setAnalysis({ combinedExplain: resp.data.top });
            setLastUpdated(new Date());
          } else {
            toast.error('Failed to fetch predictions');
          }
        } catch (e) {
          toast.error('Failed to fetch predictions');
        }
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast.error('Error fetching predictions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCombined = async () => {
    try {
      setIsLoading(true);
      const resp = await predictionApi.getCombined(3);
      if (resp.success) {
        setPredictions(resp.data.top.map((t: any) => ({ number: t.number, confidence: t.confidence })));
        setAnalysis({ combinedExplain: resp.data.top });
      }
    } catch (e) {
      console.error('Error fetching combined predictions', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLatestResult = async () => {
    try {
      setLatestLoading(true);
      console.log(`Fetching latest result for ${selectedPanel}...`);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/predictions/latest?panel=${selectedPanel}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();
      console.log('Latest result response:', data);

      if (data.success) {
        setLatestResult(data.data);
      } else {
        setLatestResult(null);
        toast.error(data.message || 'Failed to fetch latest result');
      }
    } catch (error) {
      console.error('Error fetching latest result:', error);
      setLatestResult(null);
      toast.error('Error fetching latest result');
    } finally {
      setLatestLoading(false);
    }
  };

  const fetchLiveData = async () => {
    try {
      setLiveLoading(true);
      console.log('Fetching live data...');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/results/fetch-latest`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();
      console.log('Live data response:', data);

      if (data.ok) {
        setLiveData(data.latest);
      } else {
        toast.error('Failed to fetch live DPBoss data');
      }
    } catch (error) {
      console.error('Error fetching live data:', error);
      toast.error('Error fetching live data');
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    fetchLatestResult();
    fetchPredictions();
  }, [selectedPanel]);

  // Auto-refresh every 5 minutes if data is loaded
  useEffect(() => {
    if (!isLoading && predictions.length > 0) {
      const interval = setInterval(() => {
        fetchPredictions();
        fetchLiveData();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [isLoading, predictions.length]);

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
    if (!analysis?.trendAnalysis?.smoothedSeries) return null;

    const smoothed = analysis.trendAnalysis.smoothedSeries.slice(-50); // Last 50 points
    const labels = smoothed.map((_: number, i: number) => i.toString());

    return {
      labels,
      datasets: [
        {
          label: 'Smoothed Trend',
          data: smoothed,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
        },
      ],
    };
  }, [analysis]);

  const autocorrelationChartData = useMemo(() => {
    if (!analysis?.autocorrelation?.graphData) return null;

    return {
      labels: analysis.autocorrelation.graphData.x.map((x: number) => x.toString()),
      datasets: [
        {
          label: 'Autocorrelation',
          data: analysis.autocorrelation.graphData.y,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
        },
      ],
    };
  }, [analysis]);

  const markovTableData = useMemo(() => {
    if (!analysis?.markovMatrix?.steadyStateProbs) return [];

    return analysis.markovMatrix.steadyStateProbs
      .map((prob: number, index: number) => ({ number: index, prob }))
      .sort((a: any, b: any) => b.prob - a.prob)
      .slice(0, 10);
  }, [analysis]);

  const ensembleTableData = predictionTable.slice(0, 10);

  const formatNumber = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Next Number Predictions</h1>
          <div className="flex space-x-4 items-center">
            <select
              value={selectedPanel}
              onChange={(e) => setSelectedPanel(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PANELS.map(panel => (
                <option key={panel.key} value={panel.key}>{panel.name}</option>
              ))}
            </select>
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
            <button
              onClick={fetchCombined}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              Hybrid Top 3
            </button>
          </div>
        </div>

        {lastUpdated && (
          <p className="text-sm text-gray-500 mb-6">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}

        {/* DPBoss Live Chart Iframe */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Live DPBoss Chart - {PANELS.find(p => p.key === selectedPanel)?.name}</h2>
          <div className="bg-white border rounded-lg p-4">
            <iframe
              src={`https://dpboss.boston/panel-chart-record/${selectedPanel.toLowerCase().replace('_', '-')}.php?full_chart`}
              width="100%"
              height="600"
              frameBorder="0"
              title={`DPBoss ${PANELS.find(p => p.key === selectedPanel)?.name} Chart`}
              className="rounded-lg"
            ></iframe>
          </div>
        </div>

        {/* Latest Result Display */}
        {latestResult && !latestLoading && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Latest {PANELS.find(p => p.key === selectedPanel)?.name} Result:</strong> {latestResult.double ? latestResult.double : 'N/A'}
                  {latestResult.date && <span className="ml-2">on {new Date(latestResult.date).toLocaleDateString()}</span>}
                  {latestResult.open3d && <span className="ml-2">(Open: {latestResult.open3d}, Close: {latestResult.close3d})</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {latestLoading && (
          <div className="mb-6 bg-gray-50 border-l-4 border-gray-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">Loading latest result...</p>
              </div>
            </div>
          </div>
        )}

        {liveData && !liveLoading && (
      <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-700">
              Latest DPBoss Result: <span className="font-medium">{liveData.middle ? liveData.middle : 'N/A'}</span>
              {liveData.date && <span className="ml-2">on {new Date(liveData.date).toLocaleDateString()}</span>}
            </p>
          </div>
        </div>
      </div>
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

                {analysis?.combinedExplain && (
                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Hybrid Top 5 (Human + System)</h3>
                    <div className="bg-white p-4 rounded-lg shadow">
                      <div className="space-y-4">
                        {(analysis.combinedExplain as Array<any>).map((item, idx) => (
                          <div key={idx} className="border rounded-md p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xl font-semibold">{item.number.toString().padStart(2, '0')}</div>
                              <div className="text-sm text-gray-600">{item.confidence}%</div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-sm font-medium text-gray-700">Human logic</div>
                                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                                  {item.human?.map((h: string, i: number) => (
                                    <li key={i}>{h}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-700">System logic</div>
                                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                                  {item.system?.map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
                  {analysis.patterns.slice(0, 6).map(([pattern, count]: [string, number], index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          {pattern.split(',').map((num: string, i: number) => (
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

            {analysis?.chiSquareTest && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Chi-Square Test</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Tests if numbers are randomly distributed
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Chi-Square Value:</span>
                    <span className="ml-2 font-medium">{analysis.chiSquareTest.chiSquare.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">P-Value:</span>
                    <span className="ml-2 font-medium">{analysis.chiSquareTest.pValue.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Is Random:</span>
                    <span className={`ml-2 font-medium ${analysis.chiSquareTest.isRandom ? 'text-green-600' : 'text-red-600'}`}>
                      {analysis.chiSquareTest.isRandom ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Degrees of Freedom:</span>
                    <span className="ml-2 font-medium">{analysis.chiSquareTest.degreesOfFreedom}</span>
                  </div>
                </div>
              </div>
            )}

            {autocorrelationChartData && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Autocorrelation Analysis</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Correlation between numbers at different lags
                </p>
                <Line
                  data={autocorrelationChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' as const },
                      title: { display: true, text: 'Autocorrelation Function' },
                    },
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Correlation' } },
                      x: { title: { display: true, text: 'Lag' } },
                    },
                  }}
                />
              </div>
            )}

            {analysis?.runsTest && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Runs Test</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Tests if the sequence is random by counting runs above/below median
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Runs:</span>
                    <span className="ml-2 font-medium">{analysis.runsTest.runs}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Expected Runs:</span>
                    <span className="ml-2 font-medium">{analysis.runsTest.expectedRuns.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Z-Score:</span>
                    <span className="ml-2 font-medium">{analysis.runsTest.zScore.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">P-Value:</span>
                    <span className="ml-2 font-medium">{analysis.runsTest.pValue.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Is Random:</span>
                    <span className={`ml-2 font-medium ${analysis.runsTest.isRandom ? 'text-green-600' : 'text-red-600'}`}>
                      {analysis.runsTest.isRandom ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {markovTableData.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Markov Chain Steady State</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Long-term probability distribution of numbers
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markovTableData.map((item: any) => (
                        <tr key={item.number} className="border-t">
                          <td className="px-4 py-2 text-sm">{formatNumber(item.number)}</td>
                          <td className="px-4 py-2 text-sm">{(item.prob * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {analysis?.digitCorrelation?.frequentPairs && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Digit Correlation</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Most frequent digit pairs (tens and units)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {analysis.digitCorrelation.frequentPairs.slice(0, 8).map((pair: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                      <div className="text-center">
                        <div className="text-lg font-medium">{pair.tens}{pair.units}</div>
                        <div className="text-sm text-gray-500">{pair.count} times</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis?.mlClassifier?.probs && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">ML Probabilities</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Machine learning predictions (Decision Tree + Random Forest ensemble)
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from((analysis.mlClassifier.probs as Map<number, number>).entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([number, prob]) => (
                        <tr key={number} className="border-t">
                          <td className="px-4 py-2 text-sm">{formatNumber(number)}</td>
                          <td className="px-4 py-2 text-sm">{(prob * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {analysis?.monteCarlo?.occurrence && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Monte Carlo Simulation</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Simulated occurrences from Markov chain transitions
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Simulated %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from((analysis.monteCarlo.occurrence as Map<number, number>).entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([number, occur]) => (
                        <tr key={number} className="border-t">
                          <td className="px-4 py-2 text-sm">{formatNumber(number)}</td>
                          <td className="px-4 py-2 text-sm">{(occur * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ensembleTableData.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Ensemble Prediction Table</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Combined scores from all analysis methods
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transition</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ML Prob</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Monte Carlo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Final Score</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ensembleTableData.map((item) => (
                        <tr key={item.number} className="border-t">
                          <td className="px-4 py-2 text-sm font-medium">{item.number}</td>
                          <td className="px-4 py-2 text-sm">{item.frequency.toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm">{item.transitionProb.toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm">{item.mlProb.toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm">{item.trendWeight}</td>
                          <td className="px-4 py-2 text-sm">{item.monteOccur.toFixed(1)}%</td>
                          <td className="px-4 py-2 text-sm">{item.finalScore.toFixed(3)}</td>
                          <td className="px-4 py-2 text-sm">{item.confidence.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          {/* Disclaimer removed as per user request */}
          {/* These predictions are based on advanced statistical analysis of historical data.
            They are for entertainment purposes only and do not guarantee future results. */}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionsPage;
