const mongoose = require('mongoose');

const fetchLogSchema = new mongoose.Schema({
  drawId: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  success: {
    type: Boolean,
    required: true,
  },
  rawHtml: {
    type: String,
    required: true,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  sourceUrl: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    required: true, // e.g., 'scrapeLatest', 'scrapeHistory'
  }
}, { timestamps: true });

fetchLogSchema.index({ drawId: 1, timestamp: -1 });

const FetchLog = mongoose.model('FetchLog', fetchLogSchema);

module.exports = FetchLog;
