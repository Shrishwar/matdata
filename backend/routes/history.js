// Extend existing history route module only if needed by other imports
const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

// GET /api/history -> return history from DB only
router.get('/history', async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '200');
		const results = await Result.find({})
			.sort({ date: -1 })
			.limit(limit)
			.lean();

		const history = results.map(r => ({
			_id: r._id,
			date: r.date,
			open3: r.open3d,
			close3: r.close3d,
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

