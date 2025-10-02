const { scrapeHistory, scrapeLatest, getLiveExtracted } = require('./services/scraper/dpbossScraper');

async function testScraper() {
  console.log('Testing scraper functions...');

  try {
    console.log('Testing scrapeHistory...');
    const historyCount = await scrapeHistory();
    console.log(`ScrapeHistory completed: ${historyCount} results`);
  } catch (error) {
    console.error('ScrapeHistory failed:', error.message);
  }

  try {
    console.log('Testing scrapeLatest...');
    const latest = await scrapeLatest();
    console.log('ScrapeLatest completed:', latest.drawId);
  } catch (error) {
    console.error('ScrapeLatest failed:', error.message);
  }

  try {
    console.log('Testing getLiveExtracted...');
    const live = await getLiveExtracted();
    console.log('GetLiveExtracted completed:', live.drawId);
  } catch (error) {
    console.error('GetLiveExtracted failed:', error.message);
  }

  console.log('Testing completed.');
}

testScraper();
