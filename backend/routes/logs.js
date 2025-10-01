const express = require('express');
const router = express.Router();
const FetchLog = require('../models/FetchLog');

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


