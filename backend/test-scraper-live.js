const { scrapeLatest } = require('./services/scraper/dpbossScraper');

async function testScraper() {
  try {
    console.log('Testing scraper live data fetch...');
    const result = await scrapeLatest('MAIN_BAZAR');
    if (result) {
      console.log('SUCCESS: Scraper fetched live data');
      console.log('Panel:', result.panel);
      console.log('Date:', result.date);
      console.log('Double:', result.double);
      console.log('Open3d:', result.open3d);
      console.log('Close3d:', result.close3d);
    } else {
      console.log('FAILED: Scraper returned no result');
    }
  } catch (error) {
    console.error('ERROR: Scraper test failed:', error.message);
  }
}

testScraper();
