const mongoose = require('mongoose');
const moment = require('moment');

const resultSchema = new mongoose.Schema({
  // Canonical identifiers
  panel: {
    type: String,
    required: false, // backfill existing docs
    index: true,
    default: 'MAIN_BAZAR'
  },
  session: {
    type: String,
    required: false,
    enum: ['MORNING', 'DAY', 'NIGHT'],
    default: 'NIGHT',
    index: true
  },
  drawId: {
    type: String,
    required: true,
  },
  datetime: {
    type: Date,
    required: true,
  },
  // drawDate alias for canonical JSON shape
  date: {
    type: Date,
    required: true,
  },
  // Canonical field names with backward compatibility
  open3: { type: String, required: false },
  close3: { type: String, required: false },
  open3d: { type: String, required: true },
  close3d: { type: String, required: true },
  middle: {
    type: String,
    required: true,
  },
  double: {
    type: String,
    required: true,
  },
  openSum: {
    type: Number,
    required: true,
  },
  closeSum: {
    type: Number,
    required: true,
  },
  rawHtml: { type: String, required: false },
  rawSource: {
    type: String,
    required: true,
  },
  sourceUrl: {
    type: String,
    required: true,
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

// Estimation metadata
resultSchema.add({
  isEstimated: { type: Boolean, default: false },
  estimatedFrom: { type: String, default: null },
  confirmedAt: { type: Date, default: null }
});

// Virtuals
resultSchema.virtual('dayOfWeek').get(function() {
  return this.datetime ? this.datetime.getDay() : 0;
});

resultSchema.virtual('isWeekend').get(function() {
  return this.dayOfWeek === 0 || this.dayOfWeek === 6;
});

resultSchema.virtual('weekOfMonth').get(function() {
  return this.datetime ? Math.ceil((this.datetime.getDate() + this.datetime.getDay()) / 7) : 1;
});

// Ensure virtuals are included when converting to JSON
resultSchema.set('toJSON', { virtuals: true });
resultSchema.set('toObject', { virtuals: true });

// Compound unique index on drawId and date
resultSchema.index({ drawId: 1, date: 1 }, { unique: true });
resultSchema.index({ panel: 1, date: -1 });

// Index for faster lookups
resultSchema.index({ datetime: -1 });

const Result = mongoose.model('Result', resultSchema);

/**
 * Get historical results within a specific time range
 * @param {string} timeRange - Time range (e.g., '7d', '30d', '1y')
 * @returns {Promise<Array>} Array of historical results
 */
resultSchema.statics.getHistoricalData = async function(timeRange = '30d') {
  try {
    let query = {};

    // Parse time range (e.g., '7d', '1m', '1y')
    if (timeRange) {
      const amount = parseInt(timeRange);
      const unit = timeRange.replace(/\d+/g, '').toLowerCase();

      // Convert to moment.js units
      let momentUnit;
      switch(unit) {
        case 'd': momentUnit = 'days'; break;
        case 'w': momentUnit = 'weeks'; break;
        case 'm': momentUnit = 'months'; break;
        case 'y': momentUnit = 'years'; break;
        default: momentUnit = 'days';
      }

      const startDate = moment().subtract(amount, momentUnit).toDate();
      query.date = { $gte: startDate };
    }

    // Get and sort results by date (ascending)
    const results = await this.find(query)
      .sort({ date: 1 })
      .lean();

    // Transform results to include only needed fields
    return results.map(r => ({
      drawId: r.drawId,
      date: r.date,
      panel: r.panel || 'MAIN_BAZAR',
      session: r.session || 'NIGHT',
      open3d: r.open3d,
      close3d: r.close3d,
      open3: r.open3 || r.open3d,
      close3: r.close3 || r.close3d,
      middle: r.middle,
      double: r.double,
      openSum: r.openSum,
      closeSum: r.closeSum,
      rawHtml: r.rawHtml || r.rawSource,
      rawSource: r.rawSource,
      sourceUrl: r.sourceUrl,
      fetchedAt: r.fetchedAt
    }));
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};

/**
 * Get the latest results
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of recent results
 */
resultSchema.statics.getLatestResults = async function(limit = 100) {
  try {
    const results = await this.find({})
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return results.map(r => ({
      drawId: r.drawId,
      date: r.date,
      panel: r.panel || 'MAIN_BAZAR',
      session: r.session || 'NIGHT',
      open3d: r.open3d,
      close3d: r.close3d,
      open3: r.open3 || r.open3d,
      close3: r.close3 || r.close3d,
      middle: r.middle,
      double: r.double,
      openSum: r.openSum,
      closeSum: r.closeSum,
      rawHtml: r.rawHtml || r.rawSource,
      rawSource: r.rawSource,
      sourceUrl: r.sourceUrl,
      fetchedAt: r.fetchedAt
    })).reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error fetching latest results:', error);
    throw error;
  }
};

/**
 * Get statistics about the results
 * @returns {Promise<Object>} Statistics about the results
 */
resultSchema.statics.getStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          firstDate: { $min: '$date' },
          lastDate: { $max: '$date' },
          // Add more aggregations as needed
        }
      }
    ]);
    
    return stats[0] || {};
  } catch (error) {
    console.error('Error fetching result stats:', error);
    throw error;
  }
};

/**
 * Get number frequencies within a time range
 * @param {string} timeRange - Time range (e.g., '7d', '30d', '1y')
 * @returns {Promise<Array>} Array of number frequencies
 */
resultSchema.statics.getNumberFrequencies = async function(timeRange = '30d') {
  try {
    let match = {};
    
    if (timeRange) {
      const amount = parseInt(timeRange);
      const unit = timeRange.replace(/\d+/g, '').toLowerCase();
      const startDate = moment().subtract(amount, unit).toDate();
      match.date = { $gte: startDate };
    }
    
    const frequencies = await this.aggregate([
      { $match: match },
      { $group: { _id: '$double', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    return frequencies.map(f => ({
      number: f._id,
      count: f.count
    }));
  } catch (error) {
    console.error('Error calculating number frequencies:', error);
    throw error;
  }
};



module.exports = Result;
