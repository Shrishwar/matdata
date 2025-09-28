Debug Checklist for "Failed to load history" and "No results found":

1. Backend Debugging:
   - Add console.log(results.length) in /api/results route to verify DB data retrieval
   - Check MongoDB connection and 'results' collection has documents (use MongoDB Compass or shell)
   - If DB empty, verify scraper.js upsert logic and run seed.js to populate
   - Test /api/results manually with curl/Postman: curl http://localhost:5000/api/results

2. Frontend Debugging:
   - In HistoryPage.tsx, add console.error for actual error message instead of generic "Failed to load"
   - Add loading state to prevent premature "No results found"
   - Inspect network tab in browser dev tools for fetch('/api/results') call
   - Check if API_BASE_URL is correct (should be http://localhost:5000/api)

3. Extra Checks:
   - CORS: Ensure backend has cors() middleware enabled
   - Proxy: No proxy needed since frontend runs on different port
   - Manual test: Use Postman to GET http://localhost:5000/api/results, verify JSON response

Code Changes:

Backend (/api/results route):
- Add logging: console.log(`Fetched ${results.length} results from DB`);
- Handle empty: if (results.length === 0) return res.json({ results: [], message: 'No results yet' });

Frontend (HistoryPage.tsx):
- Add error logging: console.error('Failed to fetch results:', err.response?.data || err.message);
- Add loading: const [loading, setLoading] = useState(true); setLoading(false) in finally
- Show loading: {loading ? 'Loading...' : results.length === 0 ? 'No results yet' : <table>}

Example Code:
```js
// Backend
router.get('/', async (req, res) => {
  try {
    const results = await Result.find().sort({ date: -1 }).limit(50).lean();
    console.log(`Fetched ${results.length} results from DB`);
    res.json({ results, totalResults: results.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Frontend
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await resultsAPI.getResults();
      setResults(response.data.results);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch results:', err.response?.data || err.message);
      setError('Failed to load history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  fetchResults();
}, []);

return (
  <div>
    {loading ? (
      <p>Loading...</p>
    ) : error ? (
      <p>{error}</p>
    ) : results.length === 0 ? (
      <p>No results yet</p>
    ) : (
      <table>...</table>
    )}
  </div>
);
