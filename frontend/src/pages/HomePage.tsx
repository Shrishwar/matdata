import { useEffect, useState, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { resultsAPI, predictionApi } from '../services/api';
import HomePanelSelector from '../components/HomePanelSelector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowPathIcon, CheckCircleIcon, WifiIcon, ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/outline';

type Guess = {
  double: string;
  score: number;
  source: string;
  explain: {
    topFeatures: string[];
  };
};

type Result = {
  date: string;
  open3: string;
  middle: string;
  close3: string;
  double: string;
};

type LatestState = Result & { isLiveConfirmed?: boolean };

const HomePage = () => {
  const [upcoming, setUpcoming] = useState<any>(null);
  const [panel, setPanel] = useState<string>('MAIN_BAZAR');
  const [panelList, setPanelList] = useState<Array<{ key: string; name: string }>>([
    { key: 'MAIN_BAZAR', name: 'Main Bazar' },
    { key: 'KALYAN', name: 'Kalyan' },
    { key: 'MILAN', name: 'Milan' },
    { key: 'RAJDHANI', name: 'Rajdhani' },
  ]);
  const [latest, setLatest] = useState<LatestState | null>(null);
  const [latestGuess, setLatestGuess] = useState<any>(null);
  const [liveMatch, setLiveMatch] = useState<boolean | null>(null);
  const [liveHtmlSnippet, setLiveHtmlSnippet] = useState<string>('');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [backtest, setBacktest] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [livePredictions, setLivePredictions] = useState<any[]>([]);
  const [livePredictionsLoading, setLivePredictionsLoading] = useState(false);
  const [showLivePredictions, setShowLivePredictions] = useState(false);
  const sseCleanupRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  const setupSSE = () => {
    if (sseCleanupRef.current) {
      sseCleanupRef.current();
    }

    const cleanup = resultsAPI.subscribeToLatest(
      (data) => {
        if (data.type === 'connected') {
          setIsConnected(true);
          console.log('SSE connected');
        } else if (data.type === 'latest-update') {
          console.log('SSE update received:', data);
          setLatest({ ...data.latest, isLiveConfirmed: true });
          setGuesses(data.guesses || []);
          setLiveMatch(data.liveMatch);
          setLiveHtmlSnippet(data.liveHtmlSnippet || '');
          setLatestGuess(data.latest);
          lastUpdateRef.current = new Date();
          setError(null);
        }
      },
      (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
      }
    );

    sseCleanupRef.current = cleanup;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Load future first; guesses may fail independently
      try {
        const futureRes = await resultsAPI.getFuture();
        setUpcoming(futureRes.data);
      } catch (futureErr) {
        console.warn('Future endpoint failed, attempting client-side fallback');
        // Client-side fallback: compute date and fetch hybrid top 3
        const today = new Date();
        const dayOfWeek = today.getDay();
        let upcomingDate = new Date(today);
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          const daysToMonday = (1 - dayOfWeek + 7) % 7;
          upcomingDate.setDate(today.getDate() + (daysToMonday === 0 ? 7 : daysToMonday));
        }
        let predictedTop3: string[] = [];
        try {
          const resp = await predictionApi.getCombined(3, panel);
          if (resp.success) {
            predictedTop3 = resp.data.top.map((t: any) => t.number.toString().padStart(2, '0'));
          }
        } catch (e) {
          console.warn('Hybrid fallback failed');
        }
        setUpcoming({
          date: upcomingDate.toISOString().split('T')[0],
          open3: 'TBD',
          middle: 'TBD',
          close3: 'TBD',
          double: 'TBD',
          predictedTop3,
          finalNumber: predictedTop3[0]
        });
      }
      try {
        const guessRes = await resultsAPI.getGuesses();
        setGuesses(guessRes.data.guesses || []);
      } catch (e) {
        console.warn('Guesses failed, continuing with future only');
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

const fetchLatestAndPredict = async () => {
  try {
    setIsLoading(true);
    setError(null);
    const latestRes = await resultsAPI.fetchLatest();
    console.log('Latest API response:', latestRes.data); // Log full response for validation

    // Check if latest is live (today or yesterday for Friday results)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const latestDate = new Date(latestRes.data.date);
    const isLiveConfirmed = isToday(latestDate) || isYesterday(latestDate);

    setLatest({ ...latestRes.data, isLiveConfirmed });
    const guessRes = await resultsAPI.getGuesses(true);
    console.log('Guesses API response:', guessRes.data); // Log full new response
    setLatestGuess(guessRes.data.latest || latestRes.data);
    setLiveMatch(guessRes.data.liveMatch);
    setLiveHtmlSnippet(guessRes.data.liveHtmlSnippet || '');
    setGuesses(guessRes.data.guesses || []);
    setBacktest(guessRes.data.backtest || null);
    setMeta(guessRes.data.meta || null);
  } catch (err) {
    console.error('Failed to fetch latest and predict:', err);
    setError('Failed to fetch latest result. Please try again later.');
  } finally {
    setIsLoading(false);
  }
};

const fetchLivePredictions = async () => {
  try {
    setLivePredictionsLoading(true);
    setError(null);
    console.log('Fetching live predictions...');
    const response = await predictionApi.getLivePredictions(5, panel);
    console.log('Live predictions response:', response);

    if (response.success) {
      setLivePredictions(response.data.predictions || []);
      setShowLivePredictions(true);
    } else {
      setError('Failed to fetch live predictions');
    }
  } catch (err) {
    console.error('Failed to fetch live predictions:', err);
    setError('Failed to fetch live predictions. Please try again later.');
  } finally {
    setLivePredictionsLoading(false);
  }
};

  useEffect(() => {
    fetchData();
    setupSSE();

    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
      }
    };
  }, [panel]);

  // Format data for the chart
  const chartData = guesses.map(guess => ({
    name: guess.double,
    score: Math.round(guess.score * 100),
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <WifiIcon className="h-5 w-5 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
            )}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected ? 'Live Updates' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="space-x-2 flex items-center">
          <HomePanelSelector panels={panelList} value={panel} onChange={setPanel} />
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={fetchLatestAndPredict}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Fetch Today's Panel & Predict
          </button>
          <button
            onClick={fetchLivePredictions}
            disabled={livePredictionsLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <SparklesIcon className={`h-4 w-4 mr-2 ${livePredictionsLoading ? 'animate-spin' : ''}`} />
            Next Number Prediction
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {upcoming && (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Upcoming Result
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Next Main Bazar Panel
                </p>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700">
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {upcoming.date ? format(new Date(upcoming.date), 'MMM dd, yyyy') : 'TBD'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Date</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {upcoming.open3}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Open</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {upcoming.middle}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Middle</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {upcoming.close3}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Close</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {upcoming.finalNumber || (upcoming.predictedTop3?.[0] ?? 'TBD')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Final Number</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {upcoming?.predictedTop3 && upcoming.predictedTop3.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Today's Top 3 Predicted Numbers
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Auto-generated from DPBoss history
                </p>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700">
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {upcoming.predictedTop3.map((n: string, idx: number) => (
                      <div key={idx} className="text-center">
                        <div className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">{n}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pick #{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {latest && (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Latest Panel Result
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Today's Main Bazar Panel
                </p>
                {latest.isLiveConfirmed && (
                  <div className="mt-2 flex items-center text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">✅ Live Hit Confirmed</span>
                  </div>
                )}
                {liveMatch === false && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded">
                    <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                      <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">⚠️ Live Data Mismatch</span>
                    </div>
                    {liveHtmlSnippet && (
                      <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                        Debug: {liveHtmlSnippet}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700">
                <div className="p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {format(new Date(latest.date), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Date</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {latest.open3}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Open</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {latest.middle}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Middle</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {latest.close3}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Close</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {latest.double}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Double</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Top Entertainment Guesses
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Based on historical analysis and latest patterns
              </p>
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  ⚠️ <strong>Disclaimer:</strong> These are probabilistic guesses for entertainment only. No guarantee of accuracy or future results. Respect dpboss terms.
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {guesses.map((guess, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 overflow-hidden shadow rounded-lg"
                    >
                      <div className="px-4 py-5 sm:p-6 text-center">
                        <div className="text-5xl font-extrabold text-indigo-600 dark:text-indigo-400">
                          {guess.double}
                        </div>
                        <div className="mt-2">
                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Score
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                            {Math.round(guess.score * 100)}%
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {guess.source}
                          </div>
                          {guess.explain && guess.explain.topFeatures.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                              {guess.explain.topFeatures[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live DPBoss Verification Iframe */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Live DPBoss Verification
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Real-time panel chart from source (for manual verification)
              </p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <iframe
                  src="https://dpboss.boston/panel-chart-record/main-bazar.php"
                  width="100%"
                  height="400"
                  title="DPBoss Main Bazar Panel Chart"
                  className="border rounded-lg"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HomePage;
