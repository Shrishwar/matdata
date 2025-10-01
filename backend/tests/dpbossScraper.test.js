const fs = require('fs');
const path = require('path');

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue('<html></html>')
    }),
    close: jest.fn()
  })
}));

// Mock mongoose connection ready
const mongoose = require('mongoose');
Object.defineProperty(mongoose, 'connection', {
  value: { readyState: 1 },
});

// Mock Result writes
jest.mock('../models/Result', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({ ok: 1 })
}));

const axios = require('axios');
const { scrapeHistory } = require('../services/scraper/dpbossScraper');

describe('DPBoss scraper parser', () => {
  test('parses weekly table into canonical records', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample_main_bazar.html'), 'utf8');
    axios.get.mockResolvedValue({ data: html });

    const count = await scrapeHistory('MAIN_BAZAR');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});


