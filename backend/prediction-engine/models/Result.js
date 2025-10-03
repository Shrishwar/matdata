
const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  panel: { type: String, required: true },
  session: { type: String, required: true },
  drawId: { type: String, required: true, unique: true },
  datetime: { type: Date, required: true },
  date: { type: Date, required: true },
  open3d: { type: String, required: true },
  close3d: { type: String, required: true },
  middle: { type: String, required: true },
  double: { type: String, required: true },
  openSum: { type: Number, required: true },
  closeSum: { type: Number, required: true },
  rawHtml: { type: String },
  rawSource: { type: String },
  sourceUrl: { type: String },
  fetchedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Result', ResultSchema);
