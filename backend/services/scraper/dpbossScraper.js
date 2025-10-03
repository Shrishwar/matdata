const axios = require('axios');
const cheerio = require('cheerio');
const Result = require('../../models/Result');
const puppeteer = require('puppeteer'); // Fallback for dynamic content
const config = require('../../server/genius/config');
const mongoose = require('mongoose');

// Panel mapping and URL helpers
const PANEL_MAP = {
  MAIN_BAZAR: {
    key: 'MAIN_BAZAR',
    name: 'Main Bazar',
    path: 'main-bazar.php'
  },
  KALYAN: {
    key: 'KALYAN',
    name: 'Kalyan',
    path: 'kalyan.php'
  },
  MILAN: {
    key: 'MILAN',
    name: 'Milan',
    path: 'milan.php'
  },
  RAJDHANI: {
    key: 'RAJDHANI',
    name: 'Rajdhani',
    path: 'rajdhani.php'
  }
};

function getPanelConfig(panel = 'MAIN_BAZAR') {
  const upper = String(panel || '').toUpperCase();
  return PANEL_MAP[upper] || PANEL_MAP.MAIN_BAZAR;
}

function buildPanelUrl(panel = 'MAIN_BAZAR') {
  const cfg = getPanelConfig(panel);
  return `https://dpboss.boston/panel-chart-record/${cfg.path}?full_chart`;
}

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

async function scrapeHistory(panel = 'MAIN_BAZAR') {
  try {
    console.log('Starting full history scrape for Main Bazar...');

    // Wait for mongoose connection readyState to be 1 (connected)
    const maxWaitMs = 10000;
    const intervalMs = 200;
    let waitedMs = 0;
    while (mongoose.connection.readyState !== 1) {
      if (waitedMs >= maxWaitMs) {
        throw new Error('MongoDB connection not ready after waiting');
      }
      console.log('Waiting for MongoDB connection to be ready...');
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      waitedMs += intervalMs;
    }

    const sourceUrl = buildPanelUrl(panel);
    const $ = await scrapePage(sourceUrl);

    // Log raw HTML for debugging
    const rawHtml = $.html();
    console.log('Raw HTML length:', rawHtml.length);

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

    // Calculate cutoff date 1 year ago from today
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setFullYear(today.getFullYear() - 1);

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const tds = $(row).find('td');
      if (tds.length < 16) continue;

      const dateRangeStr = $(tds[0]).text().trim();
      console.log(`Row ${rowIndex} date range: ${dateRangeStr}`);

      // Validate date range format
      const dateRangeRegex = /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\s*[Tt][Oo]\s*\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/;
      if (!dateRangeRegex.test(dateRangeStr)) {
        console.warn(`Skipping invalid date range in row ${rowIndex}: ${dateRangeStr}`);
        continue;
      }

      const toIndex = dateRangeStr.toLowerCase().indexOf('to');
      const startDateStr = dateRangeStr.substring(0, toIndex).trim();
      console.log(`Parsing start date: ${startDateStr}`);
      let startDate;
      if (startDateStr.includes('/') || startDateStr.includes('-')) {
        const parts = startDateStr.includes('/') ? startDateStr.split('/') : startDateStr.split('-');
        if (parts.length === 3) {
          const [p1, p2, year] = parts;
          // Always assume DD/MM/YYYY or DD-MM-YYYY for this site
          startDate = new Date(`${year}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`);
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

      // Skip rows older than cutoff date (1 year ago)
      if (startDate < cutoffDate) {
        console.log(`Skipping row ${rowIndex} with start date ${startDate.toISOString().split('T')[0]} older than cutoff ${cutoffDate.toISOString().split('T')[0]}`);
        continue;
      }

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

        const open3 = $(tds[openIdx]).text().replace(/\s+/g, '');
        const middle = $(tds[middleIdx]).text().replace(/\s+/g, '');
        const close3 = $(tds[closeIdx]).text().replace(/\s+/g, '');
        const double = middle;

        console.log(`Row ${rowIndex} Day ${dayOffset + 1}: date=${dayDate.toISOString().split('T')[0]}, open3='${open3}' (len:${open3.length}), middle='${middle}' (len:${middle.length}), close3='${close3}' (len:${close3.length}), double='${double}' (len:${double.length})`);

        if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
          const open3d = open3;
          const close3d = close3;
          const openSum = parseInt(open3d[0]) + parseInt(open3d[1]) + parseInt(open3d[2]);
          const closeSum = parseInt(close3d[0]) + parseInt(close3d[1]) + parseInt(close3d[2]);
          const drawId = `${getPanelConfig(panel).key}_${dayDate.toISOString().split('T')[0]}_${'NIGHT'}`;
          const datetime = dayDate;
          const rawSource = $(row).html();
          const fetchedAt = new Date();

          const result = {
            panel: getPanelConfig(panel).key,
            session: 'NIGHT',
            drawId,
            datetime,
            date: dayDate,
            open3d,
            close3d,
            middle,
            double,
            openSum,
            closeSum,
            rawHtml: rawSource,
            rawSource,
            sourceUrl,
            fetchedAt
          };
          results.push(result);

          // Upsert to DB by drawId
          let retryCount = 0;
          const maxRetries = 3;
          while (retryCount < maxRetries) {
            try {
              await Result.findOneAndUpdate(
                { drawId },
                result,
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
              console.log(`Saved/Updated ${drawId}`);
              break; // Success, exit retry loop
            } catch (err) {
              retryCount++;
              console.error(`Error saving ${drawId} (attempt ${retryCount}/${maxRetries}):`, err.message);
              if (retryCount < maxRetries) {
                // Wait longer between retries
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              } else {
                console.error(`Failed to save ${drawId} after ${maxRetries} attempts`);
              }
            }
          }
          // Add delay between saves to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 500));
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

const { execFile } = require('child_process');
const path = require('path');

async function getLiveExtracted(panel = 'MAIN_BAZAR') {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting live extraction for latest ${getPanelConfig(panel).name} result... (attempt ${attempt}/${maxRetries})`);

      // Run Python script to fetch live data
      const pythonScriptPath = path.resolve(__dirname, 'fetch_live_data.py');
      const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3'; // Use 'python' on Windows, 'python3' on Unix-like systems

      const liveData = await new Promise((resolve, reject) => {
        execFile(pythonExecutable, [pythonScriptPath], (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Python script error: ${stderr || error.message}`));
          } else {
            try {
              const data = JSON.parse(stdout);
              resolve(data);
            } catch (parseError) {
              reject(new Error(`Failed to parse Python script output: ${parseError.message}`));
            }
          }
        });
      });

      if (!liveData || liveData.error) {
        throw new Error(`Python script error: ${liveData.error}`);
      }

      if (!liveData.drawId) {
        throw new Error('Invalid live data from Python script');
      }

      // Validate and process liveData fields
      const datetime = new Date(liveData.datetime);
      if (isNaN(datetime.getTime())) {
        throw new Error(`Invalid datetime from live data: ${liveData.datetime}`);
      }

      const result = {
        panel: getPanelConfig(panel).key,
        session: 'NIGHT',
        drawId: liveData.drawId || `${getPanelConfig(panel).key}_${datetime.toISOString().split('T')[0]}_NIGHT`,
        datetime,
        date: new Date(datetime.toISOString().split('T')[0]),
        open3d: liveData.open3 || liveData.open3d || '',
        close3d: liveData.close3 || liveData.close3d || '',
        middle: liveData.middle || liveData.double,
        double: liveData.double,
        openSum: liveData.openSum ?? 0,
        closeSum: liveData.closeSum ?? 0,
        rawHtml: liveData.rawHtml || liveData.rawSource,
        rawSource: liveData.rawSource,
        sourceUrl: liveData.sourceUrl || buildPanelUrl(panel),
        fetchedAt: new Date(liveData.fetchedAt || Date.now())
      };

      console.log('Live result extracted from Python script:', result);
      return result;
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

async function scrapeLatest(panel = 'MAIN_BAZAR') {
  const maxRetries = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting scrape for latest ${getPanelConfig(panel).name} result... (attempt ${attempt}/${maxRetries})`);
      const sourceUrl = buildPanelUrl(panel);
      const $ = await scrapePage(sourceUrl);

      // Log raw HTML
      const rawHtml = $.html();
      console.log('Raw HTML length:', rawHtml.length);

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
          const [p1, p2, year] = parts;
          if (parseInt(p1) > 12) {
            // Assume DD/MM/YYYY
            startDate = new Date(`${year}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`);
          } else {
            // Assume MM/DD/YYYY
            startDate = new Date(`${year}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`);
          }
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

      const open3 = $(tds[13]).text().replace(/\s+/g, '');
      const middle = $(tds[14]).text().replace(/\s+/g, '');
      const close3 = $(tds[15]).text().replace(/\s+/g, '');
      const double = middle;

      if (/^\d{3}$/.test(open3) && /^\d{2}$/.test(middle) && /^\d{3}$/.test(close3) && /^\d{2}$/.test(double)) {
        const open3d = open3;
        const close3d = close3;
        const openSum = parseInt(open3d[0]) + parseInt(open3d[1]) + parseInt(open3d[2]);
        const closeSum = parseInt(close3d[0]) + parseInt(close3d[1]) + parseInt(close3d[2]);
        const drawId = `${getPanelConfig(panel).key}_${date.toISOString().split('T')[0]}_${'NIGHT'}`;
        const datetime = date;
        const rawSource = $(lastRow).html();
        const fetchedAt = new Date();

        const result = {
          panel: getPanelConfig(panel).key,
          session: 'NIGHT',
          drawId,
          datetime,
          date,
          open3d,
          close3d,
          middle,
          double,
          openSum,
          closeSum,
          rawHtml: rawSource,
          rawSource,
          sourceUrl,
          fetchedAt
        };

        const savedResult = await Result.findOneAndUpdate(
          { drawId },
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

async function bulkScrape(days = 90, panel = 'MAIN_BAZAR') {
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
      // Check if already exists by drawId pattern
      const dateStr = currentDate.toISOString().split('T')[0];
      const existing = await Result.findOne({
        drawId: { $regex: `^${dateStr}-` }
      });

      if (!existing) {
        // Scrape and save - simplified, use getLiveExtracted for now
        const result = await getLiveExtracted(panel);
        if (result && result.datetime.toDateString() === currentDate.toDateString()) {
          await Result.findOneAndUpdate(
            { drawId: result.drawId },
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
  // Parse CSV and save results - assuming CSV has new format: drawId,datetime,number,tens,units,rawSource,sourceUrl,fetchedAt
  const lines = csvData.split('\n').filter(line => line.trim());
  let count = 0;

  for (const line of lines.slice(1)) { // Skip header
    const [drawId, datetimeStr, numberStr, tensStr, unitsStr, rawSource, sourceUrl, fetchedAtStr] = line.split(',');
    const datetime = new Date(datetimeStr);
    const number = parseInt(numberStr);
    const tens = parseInt(tensStr);
    const units = parseInt(unitsStr);
    const fetchedAt = new Date(fetchedAtStr);

    if (isNaN(datetime.getTime()) || isNaN(number) || isNaN(tens) || isNaN(units)) continue;

    const result = {
      drawId: drawId.trim(),
      datetime,
      number,
      tens,
      units,
      rawSource: rawSource.trim(),
      sourceUrl: sourceUrl.trim(),
      fetchedAt
    };

    await Result.findOneAndUpdate(
      { drawId },
      result,
      { upsert: true, new: true }
    );
    count++;
  }

  console.log(`CSV upload completed, added ${count} results`);
  return count;
}

async function dpbossFetch(panel = 'MAIN_BAZAR') {
  try {
    console.log('Starting DPBoss fetch for latest result...');
    const result = await scrapeLatest(panel);
    console.log('DPBoss fetch completed:', result ? result.drawId : 'No new result');
    return result;
  } catch (error) {
    console.error('DPBoss fetch failed:', error.message);
    throw error;
  }
}

module.exports = { PANEL_MAP, getPanelConfig, buildPanelUrl, scrapeHistory, scrapeLatest, getLiveExtracted, bulkScrape, uploadCsvFallback, dpbossFetch };
