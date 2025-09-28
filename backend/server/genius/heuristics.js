const Result = require('../../models/Result');

class Heuristics {
  constructor() {
    this.digitRoot = (num) => (num > 0 ? ((num - 1) % 9) + 1 : 0);
  }

  async frequencyHeuristic(history, topK = 100) {
    const doubleFreq = {};
    history.forEach(r => {
      doubleFreq[r.double] = (doubleFreq[r.double] || 0) + 1;
    });

    const total = history.length;
    const scores = {};
    Object.keys(doubleFreq).forEach(dbl => {
      scores[dbl] = doubleFreq[dbl] / total;
    });

    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'frequency', count: doubleFreq[double] } }));
  }

  async independenceHeuristic(history, topK = 100) {
    const tensFreq = Array(10).fill(0);
    const unitsFreq = Array(10).fill(0);

    history.forEach(r => {
      tensFreq[parseInt(r.double[0])]++;
      unitsFreq[parseInt(r.double[1])]++;
    });

    const total = history.length;
    const scores = {};
    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        const dbl = `${t}${u}`;
        scores[dbl] = (tensFreq[t] / total) * (unitsFreq[u] / total);
      }
    }

    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'independence', tensFreq: tensFreq[parseInt(double[0])], unitsFreq: unitsFreq[parseInt(double[1])] } }));
  }

  async markov1Step(history, prevDouble, topK = 100) {
    const transitions = {};
    history.forEach((r, i) => {
      if (i < history.length - 1) {
        const curr = r.double;
        const next = history[i + 1].double;
        transitions[curr] = transitions[curr] || {};
        transitions[curr][next] = (transitions[curr][next] || 0) + 1;
      }
    });

    // Normalize
    Object.keys(transitions).forEach(prev => {
      const total = Object.values(transitions[prev]).reduce((s, c) => s + c, 0);
      Object.keys(transitions[prev]).forEach(next => {
        transitions[prev][next] /= total;
      });
    });

    const scores = transitions[prevDouble] || {};
    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'markov1', prev: prevDouble } }));
  }

  async markov2Step(history, prevDouble, topK = 100) {
    const transitions = {};
    history.forEach((r, i) => {
      if (i < history.length - 2) {
        const pair = `${r.double}-${history[i + 1].double}`;
        const next = history[i + 2].double;
        transitions[pair] = transitions[pair] || {};
        transitions[pair][next] = (transitions[pair][next] || 0) + 1;
      }
    });

    // Normalize
    Object.keys(transitions).forEach(pair => {
      const total = Object.values(transitions[pair]).reduce((s, c) => s + c, 0);
      Object.keys(transitions[pair]).forEach(next => {
        transitions[pair][next] /= total;
      });
    });

    const prevPair = history.length >= 2 ? `${history[history.length - 2].double}-${history[history.length - 1].double}` : null;
    const scores = prevPair && transitions[prevPair] ? transitions[prevPair] : {};

    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'markov2', prevPair } }));
  }

  async recencyWeightedFrequency(history, window = 30, decay = 0.95, topK = 100) {
    const scores = {};
    history.slice(-window).forEach((r, i) => {
      const weight = Math.pow(decay, window - 1 - i);
      scores[r.double] = (scores[r.double] || 0) + weight;
    });

    const totalWeight = Object.values(scores).reduce((s, w) => s + w, 0);
    Object.keys(scores).forEach(dbl => {
      scores[dbl] /= totalWeight;
    });

    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'recency', window, decay } }));
  }

  async pairGapRules(history, topK = 100) {
    // Simple pair rules: if last was XY, favor YX or similar
    const last = history[history.length - 1];
    if (!last) return [];

    const scores = {};
    const tens = parseInt(last.double[0]);
    const units = parseInt(last.double[1]);

    // Favor swap
    const swap = `${units}${tens}`;
    scores[swap] = 0.5;

    // Favor adjacent
    for (let d = -1; d <= 1; d++) {
      for (let dd = -1; dd <= 1; dd++) {
        const nt = (tens + d + 10) % 10;
        const nu = (units + dd + 10) % 10;
        const dbl = `${nt}${nu}`;
        scores[dbl] = (scores[dbl] || 0) + 0.1;
      }
    }

    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'pairGap', last: last.double } }));
  }

  async streakGapRules(history, topK = 100) {
    // If streak of same tens, break it
    const tensStreak = this.calculateStreak(history, r => parseInt(r.double[0]));
    const unitsStreak = this.calculateStreak(history, r => parseInt(r.double[1]));

    const scores = {};
    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        const dbl = `${t}${u}`;
        let score = 0;
        if (tensStreak.length >= 3 && t !== parseInt(history[history.length - 1].double[0])) score += 0.3;
        if (unitsStreak.length >= 3 && u !== parseInt(history[history.length - 1].double[1])) score += 0.3;
        scores[dbl] = score;
      }
    }

    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topK)
      .map(([double, score]) => ({ double, score, metadata: { type: 'streakGap', tensStreak: tensStreak.length, unitsStreak: unitsStreak.length } }));
  }

  calculateStreak(history, getter) {
    if (history.length === 0) return [];
    const streak = [history[history.length - 1]];
    for (let i = history.length - 2; i >= 0; i--) {
      if (getter(history[i]) === getter(streak[0])) {
        streak.unshift(history[i]);
      } else {
        break;
      }
    }
    return streak;
  }

  async getAllHeuristics(history, prevDouble, params = {}) {
    const window = params.window || 50;
    const topK = params.topK || 100;

    const hist = history.slice(-window);

    const heuristics = await Promise.all([
      this.frequencyHeuristic(hist, topK),
      this.independenceHeuristic(hist, topK),
      this.markov1Step(hist, prevDouble, topK),
      this.markov2Step(hist, topK),
      this.recencyWeightedFrequency(hist, params.recencyWindow || 30, params.decay || 0.95, topK),
      this.pairGapRules(hist, topK),
      this.streakGapRules(hist, topK)
    ]);

    return {
      frequency: heuristics[0],
      independence: heuristics[1],
      markov1: heuristics[2],
      markov2: heuristics[3],
      recency: heuristics[4],
      pairGap: heuristics[5],
      streakGap: heuristics[6]
    };
  }
}

module.exports = new Heuristics();
