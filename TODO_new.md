# TODO: Fix Matka Site to Fetch Live DPBoss Data and Fix Prediction Buttons

## Step 1: Scraper Fixes
- Verify scrapeLatest and scrapeHistory fetch live DPBoss HTML for all panels.
- Add retry and fallback logic if missing.
- Validate parsed data strictly and log errors.
- Ensure skipping off-days in history scraping.

## Step 2: Sync Service
- Verify dpbossSync service runs every 2-5 minutes.
- Ensure initial backfill and periodic fetchLatest work correctly.
- Add error handling and logging.

## Step 3: API Fixes
- Verify /api/predictions/latest and /api/predictions/history return fresh data.
- Ensure /api/predictions/next uses hybrid logic correctly.
- Add no-cache headers in API responses.

## Step 4: Frontend Fixes
- Ensure API calls use no-cache headers.
- Fix buttons (Predictions, Analysis, Refresh, Hybrid Top 3) to call correct APIs.
- Remove old dummy chart logic if present.

## Step 5: Testing
- Test end-to-end for all panels.
- Confirm site shows exact latest DPBoss data within 2-5 minutes.
- Test prediction buttons for correct functionality.

## Step 6: Logging and Monitoring
- Add detailed logging in scraper, sync, API, and frontend.
- Monitor logs for errors or stale data.

---

## New Task: Remove Live DPBoss Verification Real-time Panel Chart from Home Page

## Step 1: Edit HomePage.tsx
- Remove the entire "Live DPBoss Verification" iframe section from frontend/src/pages/HomePage.tsx.

## Step 2: Verify Changes
- Ensure the home page loads correctly without the iframe.
- Confirm no other functionalities are broken.
