const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const SCRAPE_URL = 'https://dpboss.boston/panel-chart-record/main-bazar.php?full_chart';

async function scrapeWithCheerio(url) {
  try {
    const response = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(response.data);
    return $;
  } catch (error) {
    console.error('Cheerio scrape failed:', error.message);
    return null;
  }
}

async function scrapeWithPuppeteer(url) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();
    const $ = cheerio.load(html);
    return $;
  } catch (error) {
    console.error('Puppeteer scrape failed:', error.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapePage(url) {
  let $ = await scrapeWithCheerio(url);
  if (!$ || $('table').length === 0) {
    console.log('Falling back to Puppeteer...');
    $ = await scrapeWithPuppeteer(url);
    if (!$ || $('table').length === 0) {
      throw new Error('Failed to scrape page with both methods');
    }
  }
  return $;
}

async function debugScrape() {
  try {
    console.log('Starting debug scrape...');
    const $ = await scrapePage(SCRAPE_URL);

    const table = $('table').first();
    if (table.length === 0) {
      console.log('No table found');
      return;
    }

    const rows = table.find('tr').toArray();
    console.log(`Total rows in table: ${rows.length}`);

    const dataRows = rows.filter(row => {
      const tds = $(row).find('td');
      return tds.length >= 16;
    });
    console.log(`Data rows (>=16 tds): ${dataRows.length}`);

    // Log first few data rows' td texts
    for (let i = 0; i < Math.min(3, dataRows.length); i++) {
      const row = dataRows[i];
      const tds = $(row).find('td');
      const texts = tds.map((j, el) => $(el).text().trim()).get();
      console.log(`Row ${i}: DateRange: "${texts[0]}", Full row: [${texts.join(', ')}]`);
    }

    // Log last row for latest
    if (dataRows.length > 0) {
      const lastRow = dataRows[dataRows.length - 1];
      const tds = $(lastRow).find('td');
      const texts = tds.map((j, el) => $(el).text().trim()).get();
      console.log(`Last Row: DateRange: "${texts[0]}", Full row: [${texts.join(', ')}]`);
    }

    // Also log the HTML of first table for inspection
    console.log('\nFirst table HTML snippet:');
    console.log(table.html().substring(0, 2000) + '...');

  } catch (error) {
    console.error('Debug scrape error:', error);
  }
}

debugScrape();
