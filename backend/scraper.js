const axios = require('axios');
const cheerio = require('cheerio');
const Result = require('./models/Result');

const SCRAPE_URL = 'https://dpboss.boston/panel-chart-record/main-bazar.php?full_chart';

async function scrapeHistory() {
  try {
    console.log('Starting full history scrape for Main Bazar...');
    const response = await axios.get(SCRAPE_URL);
    const $ = cheerio.load(response.data);

    // Find the main table
    const table = $('table').first();
    if (table.length === 0) {
      throw new Error('No table found on the page');
    }

    const results = [];
    // Get all data rows (weeks), filter by sufficient td count
    const rows = table.find('tr').toArray().filter(row => {
      const tds = $(row).find('td');
      return tds.length >= 16; // Date + 5 days * 3 columns (Mon-Fri)
    });

    console.log(`Found ${rows.length} weekly rows`);

    rows.forEach((row, rowIndex) => {
      const tds = $(row).find('td');
      if (tds.length < 16) return;

      // Extract date range from first td, e.g., "22/09/2025 to 26/09/2025"
      const dateRangeStr = $(tds[0]).text().trim();
      console.log(`Row ${rowIndex} date range: ${dateRangeStr}`);

      const toIndex = dateRangeStr.indexOf('to');
      if (toIndex <= 0) {
        console.warn(`Invalid date range in row ${rowIndex}: ${dateRangeStr}`);
        return;
      }

      const startDateStr = dateRangeStr.substring(0, toIndex).trim();
      let startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime()) && startDateStr.includes('/')) {
        // Parse DD/MM/YYYY
        const parts = startDateStr.split('/');
        if (parts.length === 3) {
          startDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      }

      if (isNaN(startDate.getTime())) {
        console.warn(`Invalid start date in row ${rowIndex}: ${startDateStr}`);
        return;
      }

      // Extract Mon-Fri data: td[1-3] Mon, [4-6] Tue, [7-9] Wed, [10-12] Thu, [13-15] Fri
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + dayOffset); // Mon +0 = Mon, +1=Tue, ..., +4=Fri

        const openIdx = 1 + dayOffset * 3;
        const middleIdx = 2 + dayOffset * 3;
        const closeIdx = 3 + dayOffset * 3;

        const open3 = $(tds[openIdx]).text().trim();
        const middle = $(tds[middleIdx]).text().trim();
        const close3 = $(tds[closeIdx]).text().trim();
        const double = middle; // Jodi as double

        console.log(`Row ${rowIndex} Day ${dayOffset + 1} extracted: date=${dayDate.toISOString().split('T')[0]}, open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);

        // Validate
        if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
          const result = {
            date: dayDate,
            open3,
            middle,
            close3,
            double,
            finalNumber: null
          };
          results.push(result);

          // Upsert to DB
          const startOfDay = new Date(dayDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(dayDate);
          endOfDay.setHours(23, 59, 59, 999);

          Result.findOneAndUpdate(
            { date: { $gte: startOfDay, $lt: endOfDay } },
            result,
            { upsert: true, new: true }
          ).then(saved => console.log(`Saved/Updated ${dayDate.toISOString().split('T')[0]}`))
           .catch(err => console.error(`Error saving ${dayDate.toISOString().split('T')[0]}:`, err));
        } else {
          console.warn(`Invalid data in row ${rowIndex} day ${dayOffset + 1}: open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);
        }
      }
    });

    console.log(`Scraped and processed ${results.length} historical results.`);
    return results.length;
  } catch (error) {
    console.error('History scrape error:', error.message);
    throw error;
  }
}

async function scrapeLatest() {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting scrape for latest Main Bazar result... (attempt ${attempt}/${maxRetries})`);
      const response = await axios.get(SCRAPE_URL, { timeout: 10000 });
      const $ = cheerio.load(response.data);

    // Find the main table (assuming first table)
    const table = $('table').first();
    if (table.length === 0) {
      throw new Error('No table found on the page');
    }

    // Get all rows, filter data rows with sufficient td (Mon-Fri chart has 16 td)
    const rows = table.find('tr').toArray().filter(row => $(row).find('td').length >= 16);
    console.log(`Found ${rows.length} data rows in the table`);

    if (rows.length === 0) {
      throw new Error('No data rows found in table');
    }

    // Take the last row (latest week)
    const lastRow = $(rows[rows.length - 1]);
    const tds = lastRow.find('td');
    console.log(`Selected last row with ${tds.length} cells`);

    if (tds.length < 16) {
      throw new Error(`Insufficient columns in last row: expected >=16, got ${tds.length}`);
    }

    // Extract date range from first td
    const dateRangeStr = $(tds[0]).text().trim();
    console.log(`Date range: ${dateRangeStr}`);

    // Parse start date (Monday) from "DD/MM/YYYYtoDD/MM/YYYY" format, then +4 for Friday
    const toIndex = dateRangeStr.indexOf('to');
    if (toIndex <= 0) {
      throw new Error(`Invalid date range: ${dateRangeStr}`);
    }
    const startDateStr = dateRangeStr.substring(0, toIndex).trim();
    let startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime()) && startDateStr.includes('/')) {
      // Parse DD/MM/YYYY
      const parts = startDateStr.split('/');
      if (parts.length === 3) {
        startDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    }
    if (isNaN(startDate.getTime())) {
      throw new Error(`Invalid start date: ${startDateStr}`);
    }
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + 4); // Monday +4 = Friday

    // Extract latest day (Friday: indices 13=open3, 14=middle/jodi/double, 15=close3)
    const open3 = $(tds[13]).text().trim();
    const middle = $(tds[14]).text().trim();
    const close3 = $(tds[15]).text().trim();
    const double = middle; // Jodi as double

    console.log(`Extracted latest data: date=${date.toISOString().split('T')[0]}, open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);

    if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
      const result = {
        date,
        open3,
        middle,
        close3,
        double,
        finalNumber: null // Historical, no final
      };

      // Save or update in DB (upsert by date)
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
      throw new Error(`Invalid data in latest row: date=${date.toISOString().split('T')[0]}, open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);
    }
    } catch (error) {
      lastError = error;
      console.error(`Scrape attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('All scrape attempts failed');
  throw lastError;
}

async function getLiveExtracted() {
  try {
    console.log('Extracting live Main Bazar result without saving...');
    const response = await axios.get(SCRAPE_URL);
    const $ = cheerio.load(response.data);

    // Find the main table (assuming first table)
    const table = $('table').first();
    if (table.length === 0) {
      throw new Error('No table found on the page');
    }

    // Get all rows, filter data rows with sufficient td (Mon-Fri chart has 16 td)
    const rows = table.find('tr').toArray().filter(row => $(row).find('td').length >= 16);
    console.log(`Found ${rows.length} data rows in the table`);

    if (rows.length === 0) {
      throw new Error('No data rows found in table');
    }

    // Take the last row (latest week)
    const lastRow = $(rows[rows.length - 1]);
    const tds = lastRow.find('td');
    console.log(`Selected last row with ${tds.length} cells`);

    if (tds.length < 16) {
      throw new Error(`Insufficient columns in last row: expected >=16, got ${tds.length}`);
    }

    // Extract date range from first td
    const dateRangeStr = $(tds[0]).text().trim();
    console.log(`Date range: ${dateRangeStr}`);

    // Parse start date (Monday) from "DD/MM/YYYYtoDD/MM/YYYY" format, then +4 for Friday
    const toIndex = dateRangeStr.indexOf('to');
    if (toIndex <= 0) {
      throw new Error(`Invalid date range: ${dateRangeStr}`);
    }
    const startDateStr = dateRangeStr.substring(0, toIndex).trim();
    let startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime()) && startDateStr.includes('/')) {
      // Parse DD/MM/YYYY
      const parts = startDateStr.split('/');
      if (parts.length === 3) {
        startDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    }
    if (isNaN(startDate.getTime())) {
      throw new Error(`Invalid start date: ${startDateStr}`);
    }
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + 4); // Monday +4 = Friday

    // Extract latest day (Friday: indices 13=open3, 14=middle/jodi/double, 15=close3)
    const open3 = $(tds[13]).text().trim();
    const middle = $(tds[14]).text().trim();
    const close3 = $(tds[15]).text().trim();
    const double = middle; // Jodi as double

    console.log(`Extracted live data: date=${date.toISOString().split('T')[0]}, open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);

    if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
      const liveResult = {
        date,
        open3,
        middle,
        close3,
        double,
        finalNumber: null // Historical, no final
      };
      return liveResult;
    } else {
      throw new Error(`Invalid live data: date=${date.toISOString().split('T')[0]}, open3=${open3}, middle=${middle}, close3=${close3}, double=${double}`);
    }
  } catch (error) {
    console.error('Live extraction error:', error.message);
    throw error;
  }
}

module.exports = { scrapeHistory, scrapeLatest, getLiveExtracted };
