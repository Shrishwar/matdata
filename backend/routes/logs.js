const express = require('express');
const router = express.Router();
const PredictionLog = require('../models/PredictionLog');
const FetchLog = require('../models/FetchLog');

// GET /api/predictions/log?drawId=... or ?panel=...&limit=...
router.get('/predictions/log', async (req, res) => {
  try {
    const { drawId } = req.query;
    const panel = (req.query.panel || '').toUpperCase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const query = {};
    if (drawId) query.drawId = drawId;
    if (panel) query.panel = panel;
    const logs = await PredictionLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch prediction logs' });
  }
});

// GET /api/logs?drawId=xxx
router.get('/', async (req, res) => {
	try {
		const { drawId, limit = 50 } = req.query;
		const query = {};
		if (drawId) query.drawId = drawId;
		const logs = await FetchLog.find(query)
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.lean();
		res.json({ ok: true, logs, total: logs.length });
	} catch (e) {
		res.status(500).json({ ok: false, message: 'Failed to fetch logs', error: e.message });
	}
});

module.exports = router;


