const mongoose = require('mongoose');

const predictionLogSchema = new mongoose.Schema({
  drawId: { type: String, index: true },
  panel: { type: String, index: true },
  request: {
    type: String,
    enum: ['next', 'live', 'combined', 'full'],
    required: true
  },
  type: { type: String, enum: ['open', 'close', 'double', 'all'], default: 'double' },
  inputRange: {
    startDate: Date,
    endDate: Date,
    recordCount: Number
  },
  modelVersion: { type: String, default: '1.0.0' },
  seed: { type: Number, default: 42 },
  weights: { type: Object, default: {} },
  predictions: [
    {
      number: String,
      confidencePct: Number,
      explanations: [String]
    }
  ],
  analysisSummary: { type: Object, default: {} },
  provenance: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

predictionLogSchema.index({ panel: 1, createdAt: -1 });

const PredictionLog = mongoose.model('PredictionLog', predictionLogSchema);
module.exports = PredictionLog;


