# TODO: Fix Data Mismatch in History and Live DPBoss Verification

## Step 1: Verify Current Data Mismatch
- [x] Manually trigger fresh scrape via API (/fetch-latest and /scrape-history) and check logs for errors.
- [x] Use browser_action to load DPBoss URL and screenshot table for manual comparison.
- [x] Compare DB history (/results/history) with source screenshot to identify specific mismatches (dates, values). Mismatch confirmed: Future dates (e.g., 2025) scraped due to no future-skip logic; last source row is 22/09/2025-26/09/2025 with Friday: open3=678, middle=17, close3=700.

## Step 2: Debug Scraper
- [x] Update dpbossScraper.js: Add logging for full table HTML snippet, improve date parsing, handle variable columns.
- [x] Fix Friday extraction logic (dynamic offset), add Puppeteer retries.
- [x] Test scrapeLatest() and getLiveExtracted() isolated, log extracted data. Added future-date skips in scrapeHistory, getLiveExtracted, scrapeLatest, bulkScrape.

## Step 3: Update API for Better Verification
- [ ] Enhance /fetch-latest: Return full live row HTML/text if !liveMatch.
- [ ] Add /results/verify-live endpoint for side-by-side DB vs. live comparison.
- [ ] Update /results/history to optionally include latest data.

## Step 4: Frontend Improvements
- [ ] Add "Verify Live" button in HistoryPage.tsx to call /fetch-latest and display liveMatch status.
- [ ] Show mismatch details in a modal (live values).
- [ ] Integrate SSE for real-time updates on scrapes.

## Step 5: DB and Seeding
- [x] Run full scrapeHistory() to repopulate DB if stale. (Running; will skip futures now)
- [x] Add script to clear invalid entries (weekends, invalid formats). Cleared future results (0 deleted, but confirmed via query).

## Step 6: Testing and Monitoring
- [ ] Test end-to-end: Scrape → DB → API → Frontend.
- [ ] Add logging to backend/logs for scrape events.
- [ ] Confirm no mismatches post-fixes.
