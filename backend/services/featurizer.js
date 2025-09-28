const Result = require('../models/Result');
const AnalysisRecord = require('../models/AnalysisRecord');
const config = require('../server/genius/config');

class Featurizer {
  constructor() {
    this.digitRoot = (num) => (num > 0 ? ((num - 1) % 9) + 1 : 0);
  }

  async computeFeaturesForDate(date) {
    const result = await Result.findOne({ date }).lean();
    if (!result) return null;

    const allResults = await Result.find({ date: { $lte: date } }).sort({ date: -1 }).limit(200).lean();
    const index = allResults.findIndex(r => r.date.getTime() === date.getTime());
    if (index === -1) return null;

    const history = allResults.slice(index + 1); // Past results

    const features = {
      date: result.date,
      open3: result.open3,
      close3: result.close3,
      middle: result.middle,
      double: result.double,
      open_sum: this.sumDigits(result.open3),
      close_sum: this.sumDigits(result.close3),
      digit_root_open: this.digitRoot(this.sumDigits(result.open3)),
      digit_root_close: this.digitRoot(this.sumDigits(result.close3)),
      open_tens: parseInt(result.open3[0]),
      open_units: parseInt(result.open3[2]),
      close_tens: parseInt(result.close3[0]),
      close_units: parseInt(result.close3[2]),
      double_tens: parseInt(result.double[0]),
      double_units: parseInt(result.double[1]),
      day_of_week: result.date.getDay(),
      is_weekend: [0, 6].includes(result.date.getDay()),
      week_of_month: Math.ceil((result.date.getDate() + result.date.getDay()) / 7),
      recency_index: Math.floor((new Date() - result.date) / (1000 * 60 * 60 * 24)),
      last_7_double_counts: this.countDoubles(history.slice(0, 7)),
      last_14_double_counts: this.countDoubles(history.slice(0, 14)),
      last_30_double_counts: this.countDoubles(history.slice(0, 30)),
      open_sum_ma7: this.movingAverage(history.slice(0, 7).map(r => this.sumDigits(r.open3))),
      open_sum_ma14: this.movingAverage(history.slice(0, 14).map(r => this.sumDigits(r.open3))),
      open_sum_ma30: this.movingAverage(history.slice(0, 30).map(r => this.sumDigits(r.open3))),
      close_sum_ma7: this.movingAverage(history.slice(0, 7).map(r => this.sumDigits(r.close3))),
      close_sum_ma14: this.movingAverage(history.slice(0, 14).map(r => this.sumDigits(r.close3))),
      close_sum_ma30: this.movingAverage(history.slice(0, 30).map(r => this.sumDigits(r.close3))),
      double_tens_ma7: this.movingAverage(history.slice(0, 7).map(r => parseInt(r.double[0]))),
      double_tens_ma14: this.movingAverage(history.slice(0, 14).map(r => parseInt(r.double[0]))),
      double_tens_ma30: this.movingAverage(history.slice(0, 30).map(r => parseInt(r.double[0]))),
      double_units_ma7: this.movingAverage(history.slice(0, 7).map(r => parseInt(r.double[1]))),
      double_units_ma14: this.movingAverage(history.slice(0, 14).map(r => parseInt(r.double[1]))),
      double_units_ma30: this.movingAverage(history.slice(0, 30).map(r => parseInt(r.double[1]))),
      tens_frequency: this.frequency(history.slice(0, 30).map(r => parseInt(r.double[0])), 10),
      units_frequency: this.frequency(history.slice(0, 30).map(r => parseInt(r.double[1])), 10),
      transition_prob_from_prev: history.length > 0 ? this.transitionProb(history[0].double, result.double) : 0,
      avg_transition_prob: this.avgTransitionProb(history, result.double),
      double_streak: this.streak(history, r => r.double === result.double),
      tens_streak: this.streak(history, r => parseInt(r.double[0]) === parseInt(result.double[0])),
      units_streak: this.streak(history, r => parseInt(r.double[1]) === parseInt(result.double[1])),
      sum_product: this.sumDigits(result.open3) * this.sumDigits(result.close3),
      sum_diff: Math.abs(this.sumDigits(result.open3) - this.sumDigits(result.close3)),
      double_sum: parseInt(result.double[0]) + parseInt(result.double[1]),
      label: result.double
    };

    return features;
  }

  sumDigits(str) {
    return str.split('').reduce((sum, d) => sum + parseInt(d), 0);
  }

  countDoubles(history) {
    const counts = {};
    history.forEach(r => {
      counts[r.double] = (counts[r.double] || 0) + 1;
    });
    return counts;
  }

  movingAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  frequency(values, max) {
    const freq = new Array(max).fill(0);
    values.forEach(v => freq[v]++);
    const total = values.length;
    return total > 0 ? freq.map(f => f / total) : freq;
  }

  transitionProb(prev, curr) {
    // Simple: if prev == curr, 1, else 0.5
    return prev === curr ? 1 : 0.5;
  }

  avgTransitionProb(history, curr) {
    if (history.length === 0) return 0;
    let sum = 0;
    history.forEach(r => sum += this.transitionProb(r.double, curr));
    return sum / history.length;
  }

  streak(history, condition) {
    let streak = 1;
    for (let i = 0; i < history.length; i++) {
      if (condition(history[i])) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  async populateAnalysisRecords() {
    const results = await Result.find().sort({ date: 1 });
    for (const result of results) {
      const features = await this.computeFeaturesForDate(result.date);
      if (features) {
        await AnalysisRecord.findOneAndUpdate(
          { date: result.date },
          features,
          { upsert: true, new: true }
        );
        console.log(`Processed ${result.date.toISOString().split('T')[0]}`);
      }
    }
    console.log('Analysis records populated');
  }

  async getFeaturesForPrediction() {
    const latest = await Result.findOne().sort({ date: -1 });
    if (!latest) return null;
    return await this.computeFeaturesForDate(latest.date);
  }

  async buildDataset(outputPath = './data/dataset.csv') {
    const fs = require('fs');
    const path = require('path');

    const records = await AnalysisRecord.find().sort({ date: 1 });
    if (records.length === 0) {
      console.log('No analysis records found');
      return;
    }

    // Flatten features for CSV
    const csvLines = [];
    const headers = Object.keys(records[0].toObject()).filter(k => k !== '_id' && k !== '__v' && k !== 'createdAt' && k !== 'updatedAt');
    csvLines.push(headers.join(','));

    for (const record of records) {
      const row = headers.map(h => {
        const val = record[h];
        if (typeof val === 'object') {
          return JSON.stringify(val).replace(/"/g, '""');
        }
        return val;
      });
      csvLines.push(row.join(','));
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, csvLines.join('\n'));
    console.log(`Dataset exported to ${outputPath} with ${records.length} rows`);
  }

  // Enhanced features with seasonality and transition matrix
  async computeEnhancedFeaturesForDate(date) {
    const baseFeatures = await this.computeFeaturesForDate(date);
    if (!baseFeatures) return null;

    const result = await Result.findOne({ date }).lean();
    const history = await Result.find({ date: { $lt: date } }).sort({ date: -1 }).limit(config.windows.k30).lean();

    // Seasonality features
    const month = result.date.getMonth();
    const dayOfMonth = result.date.getDate();
    baseFeatures.month_sin = Math.sin(2 * Math.PI * month / 12);
    baseFeatures.month_cos = Math.cos(2 * Math.PI * month / 12);
    baseFeatures.day_sin = Math.sin(2 * Math.PI * dayOfMonth / 31);
    baseFeatures.day_cos = Math.cos(2 * Math.PI * dayOfMonth / 31);

    // Transition matrix features
    const transitionMatrix = this.buildTransitionMatrix(history);
    baseFeatures.transition_matrix_features = this.extractTransitionFeatures(transitionMatrix, result.double);

    // Pair/gap features
    baseFeatures.pair_features = this.computePairFeatures(history, result.double);

    return baseFeatures;
  }

  buildTransitionMatrix(history) {
    const matrix = {};
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].double;
      const curr = history[i].double;
      matrix[prev] = matrix[prev] || {};
      matrix[prev][curr] = (matrix[prev][curr] || 0) + 1;
    }

    // Normalize
    Object.keys(matrix).forEach(prev => {
      const total = Object.values(matrix[prev]).reduce((s, c) => s + c, 0);
      Object.keys(matrix[prev]).forEach(curr => {
        matrix[prev][curr] /= total;
      });
    });

    return matrix;
  }

  extractTransitionFeatures(matrix, currentDouble) {
    const features = {};
    // Average transition prob to current
    let sumProb = 0;
    let count = 0;
    Object.keys(matrix).forEach(prev => {
      if (matrix[prev][currentDouble]) {
        sumProb += matrix[prev][currentDouble];
        count++;
      }
    });
    features.avg_transition_to_current = count > 0 ? sumProb / count : 0;

    // Entropy of transitions
    features.transition_entropy = Object.values(matrix).reduce((ent, probs) => {
      const probsArr = Object.values(probs);
      const h = -probsArr.reduce((s, p) => s + p * Math.log2(p), 0);
      return ent + h;
    }, 0) / Object.keys(matrix).length;

    return features;
  }

  computePairFeatures(history, currentDouble) {
    const features = {};
    if (history.length === 0) return features;

    const prev = history[0].double;
    features.is_swap = prev[0] === currentDouble[1] && prev[1] === currentDouble[0];
    features.tens_diff = Math.abs(parseInt(prev[0]) - parseInt(currentDouble[0]));
    features.units_diff = Math.abs(parseInt(prev[1]) - parseInt(currentDouble[1]));
    features.sum_diff = Math.abs((parseInt(prev[0]) + parseInt(prev[1])) - (parseInt(currentDouble[0]) + parseInt(currentDouble[1])));

    return features;
  }
}

module.exports = new Featurizer();
