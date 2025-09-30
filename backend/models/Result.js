const mongoose = require('mongoose');
const moment = require('moment');

const resultSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    default: Date.now,
  },
  open3: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{3}$/.test(v);
      },
      message: props => `${props.value} is not a valid 3-digit number!`
    }
  },
  close3: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{3}$/.test(v);
      },
      message: props => `${props.value} is not a valid 3-digit number!`
    }
  },
  middle: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid 2-digit number!`
    }
  },
  double: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid 2-digit number!`
    }
  },
  openSum: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return v >= 0 && v <= 27; // Sum of 3 digits 0-9
      },
      message: props => `${props.value} is not a valid digit sum!`
    }
  },
  closeSum: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return v >= 0 && v <= 27; // Sum of 3 digits 0-9
      },
      message: props => `${props.value} is not a valid digit sum!`
    }
  },
  finalNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid 2-digit number!`
    }
  },
  source: {
    type: String,
    default: 'dpboss',
  },
  scrapedAt: {
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

// Virtuals for calculated fields (openSum and closeSum are now stored fields)

resultSchema.virtual('openTens').get(function() {
  return this.open3 ? parseInt(this.open3[0], 10) : 0;
});

resultSchema.virtual('openUnits').get(function() {
  return this.open3 ? parseInt(this.open3[2], 10) : 0;
});

resultSchema.virtual('closeTens').get(function() {
  return this.close3 ? parseInt(this.close3[0], 10) : 0;
});

resultSchema.virtual('closeUnits').get(function() {
  return this.close3 ? parseInt(this.close3[2], 10) : 0;
});

resultSchema.virtual('doubleTens').get(function() {
  return this.double ? parseInt(this.double[0], 10) : 0;
});

resultSchema.virtual('doubleUnits').get(function() {
  return this.double ? parseInt(this.double[1], 10) : 0;
});

resultSchema.virtual('dayOfWeek').get(function() {
  return this.date ? this.date.getDay() : 0;
});

resultSchema.virtual('isWeekend').get(function() {
  return this.dayOfWeek === 0 || this.dayOfWeek === 6;
});

resultSchema.virtual('weekOfMonth').get(function() {
  return this.date ? Math.ceil((this.date.getDate() + this.date.getDay()) / 7) : 1;
});

resultSchema.virtual('digitRootOpen').get(function() {
  const sum = this.openSum;
  return sum > 0 ? (sum - 1) % 9 + 1 : 0;
});

resultSchema.virtual('digitRootClose').get(function() {
  const sum = this.closeSum;
  return sum > 0 ? (sum - 1) % 9 + 1 : 0;
});

// Ensure virtuals are included when converting to JSON
resultSchema.set('toJSON', { virtuals: true });
resultSchema.set('toObject', { virtuals: true });

// Index for faster lookups
resultSchema.index({ date: -1 });

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
      date: r.date,
      number: parseInt(r.close3) % 100, // Using close3 as the main number
      open3: r.open3,
      middle: r.middle,
      double: r.double,
      finalNumber: r.finalNumber
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
      date: r.date,
      number: parseInt(r.close3) % 100,
      open3: r.open3,
      middle: r.middle,
      double: r.double,
      finalNumber: r.finalNumber
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
      { $group: { _id: '$close3', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    return frequencies.map(f => ({
      number: parseInt(f._id) % 100,
      count: f.count
    }));
  } catch (error) {
    console.error('Error calculating number frequencies:', error);
    throw error;
  }
};



module.exports = Result;
