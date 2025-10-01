const { scrapeHistory, scrapeLatest, getLiveExtracted } = require('./scraper/dpbossScraper');
const FetchLog = require('../models/FetchLog');
const Result = require('../models/Result');
const { broadcastLatestUpdate } = require('../routes/results');

class DpbossSync {
  constructor(broadcastToWS = null) {
    this.intervalId = null;
    this.isRunning = false;
    this.fetchIntervalMinutes = process.env.FETCH_INTERVAL_MINUTES || 5; // Default 5 minutes
    this.previousLatest = null;
    this.broadcastToWS = broadcastToWS;
  }

  async start() {
    if (this.isRunning) {
      console.log('DPBoss sync is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting DPBoss sync service...');

    // Perform initial backfill
    try {
      console.log('Performing initial backfill...');
      const backfillCount = await scrapeHistory();
      console.log(`Backfill completed, processed ${backfillCount} results`);
    } catch (error) {
      console.error('Backfill failed:', error.message);
    }

    // Start periodic fetching
    this.intervalId = setInterval(async () => {
      try {
        await this.fetchLatest();
      } catch (error) {
        console.error('Periodic fetch failed:', error.message);
      }
    }, this.fetchIntervalMinutes * 60 * 1000);

    console.log(`DPBoss sync started, fetching every ${this.fetchIntervalMinutes} minutes`);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('DPBoss sync stopped');
  }

  async fetchLatest() {
    const method = 'scrapeLatest';
    const sourceUrl = 'https://dpboss.boston/panel-chart-record/main-bazar.php?full_chart';
    let rawHtml = '';
    let success = false;
    let errorMessage = null;
    let drawId = null;

    try {
      console.log('Fetching latest result...');
      const latest = await scrapeLatest();
      success = true;
      drawId = latest.drawId;
      rawHtml = latest.rawSource; // Assuming rawSource is the HTML

      // Check if there's a change
      const hasChanged = !this.previousLatest ||
        this.previousLatest.date.getTime() !== latest.date.getTime() ||
        this.previousLatest.open3d !== latest.open3d ||
        this.previousLatest.middle !== latest.middle ||
        this.previousLatest.close3d !== latest.close3d ||
        this.previousLatest.double !== latest.double;

      if (hasChanged) {
        console.log('Change detected, broadcasting update');
        this.previousLatest = latest;

        // Generate guesses
        const liveScraped = await getLiveExtracted();
        const liveMatch = latest.date.toDateString() === liveScraped.date.toDateString() &&
                          latest.open3d === liveScraped.open3d &&
                          latest.middle === liveScraped.middle &&
                          latest.close3d === liveScraped.close3d &&
                          latest.double === liveScraped.double;

        let liveHtmlSnippet = '';
        if (!liveMatch) {
          liveHtmlSnippet = `Date range row text: ${liveScraped.date} - Open: ${liveScraped.open3d}, Middle: ${liveScraped.middle}, Close: ${liveScraped.close3d}, Double: ${liveScraped.double}`;
        }

        // Get guesses (simplified, without backtest)
        const history = await Result.find().sort({ date: -1 }).limit(100);
        const guesses = this.generateSimpleGuesses(history, latest.double);

        // Broadcast to SSE clients
        broadcastLatestUpdate(latest, guesses, liveMatch, liveHtmlSnippet);

        // Broadcast to WebSocket clients if available
        if (this.broadcastToWS) {
          this.broadcastToWS({
            type: 'latest-update',
            latest,
            guesses,
            liveMatch,
            liveHtmlSnippet
          });
        }
      }

      console.log(`Latest result fetched: ${drawId}`);
    } catch (error) {
      errorMessage = error.message;
      console.error('Fetch latest failed:', errorMessage);
      rawHtml = errorMessage;
    }

    // Log the attempt
    try {
      await FetchLog.create({
        drawId: drawId || 'unknown',
        success,
        rawHtml,
        errorMessage,
        sourceUrl,
        method
      });
    } catch (logError) {
      console.error('Failed to log fetch attempt:', logError.message);
    }
  }

  generateSimpleGuesses(history, prevDouble) {
    if (history.length < 10) return [];

    const doubleFreq = {};
    for (let i = 0; i < 100; i++) doubleFreq[i.toString().padStart(2, '0')] = 0;
    history.forEach(r => doubleFreq[r.double.padStart(2, '0')]++);

    const maxFreq = Math.max(...Object.values(doubleFreq));
    const guesses = [];
    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        const dbl = `${t}${u}`;
        const score = maxFreq > 0 ? (doubleFreq[dbl] / maxFreq) * 100 : 0;
        guesses.push({ double: dbl, score });
      }
    }

    return guesses
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(g => ({ double: g.double, confidence: Math.round(g.score) + '%' }));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      fetchIntervalMinutes: this.fetchIntervalMinutes,
    };
  }
}

module.exports = DpbossSync;
