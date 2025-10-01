const express = require('express');
const router = express.Router();
const { PANEL_MAP, buildPanelUrl } = require('../services/scraper/dpbossScraper');

// GET /api/panels → available panels + DPBoss URLs
router.get('/', (req, res) => {
  const panels = Object.values(PANEL_MAP).map(p => ({
    key: p.key,
    name: p.name,
    url: buildPanelUrl(p.key)
  }));
  res.json({ success: true, panels });
});

module.exports = router;


