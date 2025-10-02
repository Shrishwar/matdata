# Matka Prediction System Implementation Plan

## Information Gathered
- **backend/services/scraper/dpbossScraper.js**: Scrapes DPBoss live panel chart for panels (Main Bazar, Kalyan, Milan, Rajdhani). Fetches historical data (last 1 year) skipping weekends/off-days. Fetches latest result with Python script fallback. Saves results to MongoDB with upsert logic.
- **backend/prediction-engine/src/services/prediction/matkaPredictor.ts**: Implements hybrid prediction pipeline with frequency/recency, Markov chains, statistical heuristics, time series (Holt-Winters, ARIMA, Bayesian), ML (Random Forest, XGBoost, LSTM), Monte Carlo, human rules (gap, hot/cold, repeat patterns, open-close sum). Generates ensemble predictions with confidence scores.
- **frontend/src/pages/PredictionsPage.tsx**: Frontend page for displaying predictions.
- **backend/routes/results.js**: API routes for results.
- **backend/routes/predictions.js**: API routes for predictions.

## Plan
1. **Backend API Endpoints**:
   - Add endpoint to fetch latest result for selected panel from DPBoss.
   - Add endpoint to fetch last 100 valid results (skip off-days) for selected panel.
   - Integrate MatkaPredictor to generate predictions based on fetched data for selected panel.

2. **Frontend UI Updates**:
   - Add panel selection dropdown (Main Bazar, Kalyan, Milan, Rajdhani) to PredictionsPage.
   - Embed DPBoss live panel chart iframe for selected panel.
   - Display latest result first, then prediction results.
   - Handle loading states and errors.

3. **Integration**:
   - On panel selection, fetch latest result and last 100 results, then run prediction pipeline.
   - Ensure off-days (Sat, Sun, no-result days) are skipped in data fetching.

## Dependent Files to be Edited
- `backend/routes/predictions.js`: Add new endpoints for panel-specific latest results, history, and predictions.
- `frontend/src/pages/PredictionsPage.tsx`: Add dropdown, iframe embedding, display logic for results and predictions.
- `backend/services/dpbossSync_new.js`: Potentially update for syncing selected panel data.

## Followup Steps
1. Implement backend API endpoints in `backend/routes/predictions.js`.
2. Update frontend `frontend/src/pages/PredictionsPage.tsx` with panel dropdown and DPBoss iframe.
3. Test end-to-end integration: select panel, fetch data, display results, run predictions.
4. Handle edge cases: no data, scraping failures, prediction errors.
5. Optimize performance: cache results, async prediction generation.
