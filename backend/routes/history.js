// Extend existing history route module only if needed by other imports
const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

// GET /api/history -> return history from DB only (last 200 days)
router.get('/history', async (req, res) => {
	try {
		const moment = require('moment');
		const limit = parseInt(req.query.limit || '200');
		const panel = (req.query.panel || 'MAIN_BAZAR').toUpperCase();
		
		// Calculate date 200 days ago
		const twoHundredDaysAgo = moment().subtract(200, 'days').toDate();
		
		const results = await Result.find({ 
			panel,
			date: { $gte: twoHundredDaysAgo }
		})
		.sort({ date: -1 })
		.limit(limit)
		.lean();

		const history = results.map(r => ({
			_id: r._id,
			date: r.date,
			open3: r.open3d || r.open3,
			close3: r.close3d || r.close3,
			middle: r.middle,
			double: r.double,
			openSum: r.openSum,
			closeSum: r.closeSum,
		}));

		res.json({ history, total: history.length });
	} catch (error) {
		console.error('Error fetching history:', error);
		res.status(500).json({ message: 'Server error fetching history', error: error.message });
	}
});

module.exports = router;

