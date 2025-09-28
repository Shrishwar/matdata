const mongoose = require('mongoose');

const analysisRecordSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  // Basic features from Result
  open3: { type: String, required: true },
  close3: { type: String, required: true },
  middle: { type: String, required: true },
  double: { type: String, required: true },
  // Computed sums and roots
  open_sum: { type: Number, required: true },
  close_sum: { type: Number, required: true },
  digit_root_open: { type: Number, required: true },
  digit_root_close: { type: Number, required: true },
  // Tens and units
  open_tens: { type: Number, required: true },
  open_units: { type: Number, required: true },
  close_tens: { type: Number, required: true },
  close_units: { type: Number, required: true },
  double_tens: { type: Number, required: true },
  double_units: { type: Number, required: true },
  // Temporal features
  day_of_week: { type: Number, required: true }, // 0=Sun, 1=Mon, ..., 6=Sat
  is_weekend: { type: Boolean, required: true },
  week_of_month: { type: Number, required: true },
  recency_index: { type: Number, default: 0 }, // Days since today, negative for future
  // Last K features (JSON objects for counts of each double in last K days)
  last_7_double_counts: { type: Object, default: {} }, // e.g., {"53": 2, "17": 1}
  last_14_double_counts: { type: Object, default: {} },
  last_30_double_counts: { type: Object, default: {} },
  // Moving averages (last 7/14/30 for sums, double_tens, double_units)
  open_sum_ma7: { type: Number, default: 0 },
  open_sum_ma14: { type: Number, default: 0 },
  open_sum_ma30: { type: Number, default: 0 },
  close_sum_ma7: { type: Number, default: 0 },
  close_sum_ma14: { type: Number, default: 0 },
  close_sum_ma30: { type: Number, default: 0 },
  double_tens_ma7: { type: Number, default: 0 },
  double_tens_ma14: { type: Number, default: 0 },
  double_tens_ma30: { type: Number, default: 0 },
  double_units_ma7: { type: Number, default: 0 },
  double_units_ma14: { type: Number, default: 0 },
  double_units_ma30: { type: Number, default: 0 },
  // Frequencies (normalized 0-1 for tens/units in last 30)
  tens_frequency: { type: [Number], required: true }, // Array of 10 values for 0-9
  units_frequency: { type: [Number], required: true },
  // Transition features (prob from prev double to this, or avg transition prob)
  transition_prob_from_prev: { type: Number, default: 0 },
  avg_transition_prob: { type: Number, default: 0 },
  // Streak features
  double_streak: { type: Number, default: 1 }, // Consecutive same double
  tens_streak: { type: Number, default: 1 },
  units_streak: { type: Number, default: 1 },
  // Engineered combined
  sum_product: { type: Number, required: true }, // open_sum * close_sum
  sum_diff: { type: Number, required: true }, // abs(open_sum - close_sum)
  double_sum: { type: Number, required: true }, // double_tens + double_units
  // For ML label (actual double for training)
  label: { type: String, required: true }, // The double value
  // Explainability
  contributions: [{ component: String, value: Number }], // Array of {component: 'heuristic'|'ml', value: score}
  shap_values: { type: Object, default: {} } // SHAP feature importance object
}, { timestamps: true });

// Indexes for ML queries
analysisRecordSchema.index({ date: -1 });
analysisRecordSchema.index({ day_of_week: 1 });
analysisRecordSchema.index({ double: 1 });

const AnalysisRecord = mongoose.model('AnalysisRecord', analysisRecordSchema);

module.exports = AnalysisRecord;
