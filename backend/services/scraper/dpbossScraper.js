const axios = require('axios');
const cheerio = require('cheerio');
const Result = require('../../models/Result');
const puppeteer = require('puppeteer'); // Fallback for dynamic content
const config = require('../../server/genius/config');

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

async function scrapeHistory() {
  try {
    console.log('Starting full history scrape for Main Bazar...');
    const $ = await scrapePage(SCRAPE_URL);

    const table = $('table').first();
    if (table.length === 0) {
      throw new Error('No table found on the page');
    }

    const results = [];
    const rows = table.find('tr').toArray().filter(row => {
      const tds = $(row).find('td');
      return tds.length >= 16;
    });

    console.log(`Found ${rows.length} weekly rows`);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const tds = $(row).find('td');
      if (tds.length < 16) continue;

      const dateRangeStr = $(tds[0]).text().trim();
      console.log(`Row ${rowIndex} date range: ${dateRangeStr}`);

      // Validate date range format
      const dateRangeRegex = /^\d{1,2}\/\d{1,2}\/\d{4}to\d{1,2}\/\d{1,2}\/\d{4}$/;
      if (!dateRangeRegex.test(dateRangeStr)) {
        console.warn(`Skipping invalid date range in row ${rowIndex}: ${dateRangeStr}`);
        continue;
      }

      const toIndex = dateRangeStr.indexOf('to');
      const startDateStr = dateRangeStr.substring(0, toIndex).trim();
      console.log(`Parsing start date: ${startDateStr}`);
      let startDate;
      if (startDateStr.includes('/')) {
        const parts = startDateStr.split('/');
        if (parts.length === 3) {
          const [p1, p2, year] = parts;
          if (parseInt(p1) > 12) {
            // Assume DD/MM/YYYY
            startDate = new Date(`${year}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`);
          } else {
            // Assume MM/DD/YYYY
            startDate = new Date(`${year}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`);
          }
        } else {
          startDate = new Date(startDateStr);
        }
      } else {
        startDate = new Date(startDateStr);
      }

      if (isNaN(startDate.getTime())) {
        console.warn(`Invalid start date in row ${rowIndex}: ${startDateStr}`);
        continue;
      }

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      for (let dayOffset = 0; dayOffset < 5; dayOffset++) { // Mon-Fri
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + dayOffset);

        if (dayDate > today) {
          console.log(`Skipping future date: ${dayDate.toISOString().split('T')[0]}`);
          continue;
        }

        const openIdx = 1 + dayOffset * 3;
        const middleIdx = 2 + dayOffset * 3;
        const closeIdx = 3 + dayOffset * 3;

        const open3 = $(tds[openIdx]).text().trim();
        const middle = $(tds[middleIdx]).text().trim();
        const close3 = $(tds[closeIdx]).text().trim();
        const double = middle;

        console.log(`Row ${rowIndex} Day ${dayOffset + 1}: date=${dayDate.toISOString().split('T')[0]}, open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);

        if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
          const result = {
            date: dayDate,
            open3,
            middle,
            close3,
            double,
            finalNumber: null,
            source: 'dpboss',
            scrapedAt: new Date()
          };
          results.push(result);

          // Upsert to DB
          const startOfDay = new Date(dayDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(dayDate);
          endOfDay.setHours(23, 59, 59, 999);

          await Result.findOneAndUpdate(
            { date: { $gte: startOfDay, $lt: endOfDay } },
            result,
            { upsert: true, new: true }
          ).then(saved => console.log(`Saved/Updated ${dayDate.toISOString().split('T')[0]}`))
           .catch(err => console.error(`Error saving ${dayDate.toISOString().split('T')[0]}:`, err));
        } else {
          console.warn(`Invalid data in row ${rowIndex} day ${dayOffset + 1}`);
        }
      }
    }

    console.log(`Scraped and processed ${results.length} historical results.`);
    return results.length;
  } catch (error) {
    console.error('History scrape error:', error.message);
    throw error;
  }
}

async function getLiveExtracted() {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting live extraction for latest Main Bazar result... (attempt ${attempt}/${maxRetries})`);
      const $ = await scrapePage(SCRAPE_URL);

      const table = $('table').first();
      if (table.length === 0) {
        throw new Error('No table found on the page');
      }

      const rows = table.find('tr').toArray().filter(row => $(row).find('td').length >= 16);
      if (rows.length === 0) {
        throw new Error('No data rows found in table');
      }

      const lastRow = $(rows[rows.length - 1]);
      const tds = lastRow.find('td');
      if (tds.length < 16) {
        throw new Error(`Insufficient columns in last row: ${tds.length}`);
      }

      const dateRangeStr = $(tds[0]).text().trim();
      console.log(`Live extraction date range: ${dateRangeStr}`);
      const toIndex = dateRangeStr.indexOf('to');
      if (toIndex <= 0) {
        throw new Error(`Invalid date range: ${dateRangeStr}`);
      }
      const startDateStr = dateRangeStr.substring(0, toIndex).trim();
      console.log(`Parsing start date: ${startDateStr}`);
      let startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime()) && startDateStr.includes('/')) {
        const parts = startDateStr.split('/');
        if (parts.length === 3) {
          startDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        }
      }
      if (isNaN(startDate.getTime())) {
        throw new Error(`Invalid start date: ${startDateStr}`);
      }
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + 4); // Friday

      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error(`Latest date is in the future: ${date.toISOString().split('T')[0]}. No live data available yet.`);
      }

      const open3 = $(tds[13]).text().trim();
      const middle = $(tds[14]).text().trim();
      const close3 = $(tds[15]).text().trim();
      const double = middle;

      if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
        const result = {
          date,
          open3,
          middle,
          close3,
          double,
          finalNumber: null,
          source: 'dpboss',
          scrapedAt: new Date()
        };

        console.log('Live result extracted:', result);
        return result;
      } else {
        throw new Error(`Invalid data in latest row`);
      }
    } catch (error) {
      lastError = error;
      console.error(`Live extraction attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('All live extraction attempts failed');
  throw lastError;
}

async function scrapeLatest() {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting scrape for latest Main Bazar result... (attempt ${attempt}/${maxRetries})`);
      const $ = await scrapePage(SCRAPE_URL);

      const table = $('table').first();
      if (table.length === 0) {
        throw new Error('No table found on the page');
      }

      const rows = table.find('tr').toArray().filter(row => $(row).find('td').length >= 16);
      if (rows.length === 0) {
        throw new Error('No data rows found in table');
      }

      const lastRow = $(rows[rows.length - 1]);
      const tds = lastRow.find('td');
      if (tds.length < 16) {
        throw new Error(`Insufficient columns in last row: ${tds.length}`);
      }

      const dateRangeStr = $(tds[0]).text().trim();
      console.log(`Scrape latest date range: ${dateRangeStr}`);
      const toIndex = dateRangeStr.indexOf('to');
      if (toIndex <= 0) {
        throw new Error(`Invalid date range: ${dateRangeStr}`);
      }
      const startDateStr = dateRangeStr.substring(0, toIndex).trim();
      console.log(`Parsing start date: ${startDateStr}`);
      let startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime()) && startDateStr.includes('/')) {
        const parts = startDateStr.split('/');
        if (parts.length === 3) {
          startDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        }
      }
      if (isNaN(startDate.getTime())) {
        throw new Error(`Invalid start date: ${startDateStr}`);
      }
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + 4); // Friday

      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error(`Latest date is in the future: ${date.toISOString().split('T')[0]}. No live data to scrape yet.`);
      }

      const open3 = $(tds[13]).text().trim();
      const middle = $(tds[14]).text().trim();
      const close3 = $(tds[15]).text().trim();
      const double = middle;

      if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
        const result = {
          date,
          open3,
          middle,
          close3,
          double,
          finalNumber: null,
          source: 'dpboss',
          scrapedAt: new Date()
        };

        const startOfDay = new Date(result.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(result.date);
        endOfDay.setHours(23, 59, 59, 999);

        const savedResult = await Result.findOneAndUpdate(
          { date: { $gte: startOfDay, $lt: endOfDay } },
          result,
          { upsert: true, new: true }
        );

        console.log('Latest result scraped and saved:', savedResult);
        return savedResult;
      } else {
        throw new Error(`Invalid data in latest row`);
      }
    } catch (error) {
      lastError = error;
      console.error(`Scrape attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('All scrape attempts failed');
  throw lastError;
}

async function bulkScrape(days = 90) {
  // Scrape last N days, with rate limiting
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  console.log(`Starting bulk scrape from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  let currentDate = new Date(startDate);
  let count = 0;

  while (currentDate <= endDate) {
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      // Skip weekends
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    try {
      // Check if already exists
      const existing = await Result.findOne({
        date: {
          $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
          $lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
        }
      });

      if (!existing) {
        // Scrape and save
        const $ = await scrapePage(SCRAPE_URL);
        // Extract for this date - simplified, assume latest is current
        const result = await getLiveExtracted();
        if (result && result.date.toDateString() === currentDate.toDateString()) {
          await Result.findOneAndUpdate(
            { date: { $gte: new Date(result.date.getFullYear(), result.date.getMonth(), result.date.getDate()), $lt: new Date(result.date.getFullYear(), result.date.getMonth(), result.date.getDate() + 1) } },
            result,
            { upsert: true, new: true }
          );
          count++;
        } else {
          console.log(`No matching result for ${currentDate.toISOString().split('T')[0]}`);
        }
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, config.scraping.rateLimitDelay));

    } catch (error) {
      console.error(`Error scraping ${currentDate.toISOString().split('T')[0]}:`, error.message);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`Bulk scrape completed, added ${count} results`);
  return count;
}

async function uploadCsvFallback(csvData) {
  // Parse CSV and save results
  const lines = csvData.split('\n').filter(line => line.trim());
  let count = 0;

  for (const line of lines.slice(1)) { // Skip header
    const [dateStr, open3, middle, close3, double] = line.split(',');
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) continue;

    const result = {
      date,
      open3: open3.trim(),
      middle: middle.trim(),
      close3: close3.trim(),
      double: double.trim(),
      finalNumber: null,
      source: 'csv',
      scrapedAt: new Date()
    };

    if (/^\d{3}$/.test(result.open3) && /^\d{2}$/.test(result.middle) && /^\d{3}$/.test(result.close3) && /^\d{2}$/.test(result.double)) {
      await Result.findOneAndUpdate(
        { date: { $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()), $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) } },
        result,
        { upsert: true, new: true }
      );
      count++;
    }
  }

  console.log(`CSV upload completed, added ${count} results`);
  return count;
}

module.exports = { scrapeHistory, scrapeLatest, getLiveExtracted, bulkScrape, uploadCsvFallback };
