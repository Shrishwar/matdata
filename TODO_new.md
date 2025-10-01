# Matka Prediction System Patch TODO

## Backend Service
- [x] Modify dpbossScraper.js to add dpbossFetch() service that runs every X minutes (configurable), fetches latest from DPBoss, parses canonical record, idempotent insert into results collection.
- [x] Add logging for each fetch with timestamps and raw HTML payload.

## API Routes
- [x] Ensure GET /api/history returns sorted draws from DB (check if /api/results/history is correct).
- [x] Change GET /api/predictions/next to POST /api/predictions/next, trigger prediction pipeline on latest DB data, return top 5-10 with probability/explanation.

## Sync
- [x] Implement websocket server for real-time updates; modify frontend to subscribe and auto-append new draws.
- [x] Modify frontend HistoryPage to subscribe to websocket and auto-append new draws in correct order.

## Prediction
- [x] Ensure prediction pipeline is deterministic: frequency, markov, autocorr, ML ensemble (DecisionTree+RandomForest), Monte Carlo (seed=42).
- [x] On new draw insert, trigger pipeline automatically.
- [x] Return top 5-10 predicted numbers with probability and explanation.

## Frontend
- [x] HistoryPage subscribes to websocket → auto-append new draws.
- [x] PredictionsPage: add "Generate Next Prediction" button → calls POST /api/predictions/next → shows top predictions + explanation + charts.

## Stability
- [x] If DPBoss unreachable → return 503 with message, do not fallback to random.
- [x] Add logs for each prediction with timestamps.

## Testing
- [ ] Test DPBoss fetch and DB insert.
- [ ] Verify websocket updates frontend.
- [ ] Confirm predictions are deterministic and from real data.
- [ ] Audit logs for fetches and predictions.
