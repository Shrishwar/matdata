const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeTable() {
  try {
    console.log('Fetching page...');
    const response = await axios.get('https://dpboss.boston/panel-chart-record/main-bazar.php?full_chart');
    const $ = cheerio.load(response.data);

    const table = $('table').first();
    if (table.length === 0) {
      console.log('No table found');
      return;
    }

    console.log('Table found. Analyzing rows...');
    const rows = table.find('tr').toArray();
    console.log(`Total rows: ${rows.length}`);

    // Log header row if exists
    const headerRow = $(rows[0]);
    const headerTds = headerRow.find('td, th');
    console.log(`Header columns: ${headerTds.length}`);
    headerTds.each((i, el) => {
      console.log(`Header ${i}: "${$(el).text().trim()}"`);
    });

    // Log last 3 data rows for structure
    const dataRows = rows.slice(-3).filter(row => $(row).find('td').length > 0);
    console.log(`\nLast 3 data rows:`);
    dataRows.forEach((row, rowIndex) => {
      const tds = $(row).find('td');
      console.log(`\nRow ${rows.length - dataRows.length + rowIndex + 1} (columns: ${tds.length}):`);
      tds.each((i, el) => {
        const text = $(el).text().trim();
        console.log(`  Col ${i}: "${text}"`);
      });
    });

    // Check for date range pattern in first column
    console.log('\nFirst column samples from last 5 rows:');
    rows.slice(-5).forEach((row, i) => {
      const firstTd = $(row).find('td').first();
      if (firstTd.length) {
        console.log(`Row ${rows.length - 5 + i + 1}: "${firstTd.text().trim()}"`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeTable();
