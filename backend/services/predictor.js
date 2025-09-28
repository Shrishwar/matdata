const AnalysisRecord = require('../models/AnalysisRecord');
const Result = require('../models/Result');
const fs = require('fs');
const path = require('path');

class Predictor {
  constructor() {
    this.weights = {
      frequency: 0.3,
      independence: 0.2,
      markov: 0.3,
      ml: 0.2
    };
    this.mlModel = null; // Placeholder for loaded ML model
  }

  async loadMLModel() {
    // TODO: Load from models/ folder
    // For now, return null
    return null;
  }

  async generateCandidates() {
    // Get last 100 results for frequency
    const history = await Result.find().sort({ date: -1 }).limit(100).lean();
    if (history.length < 10) return [];

    const doubleFreq = {};
    const tensFreq = Array(10).fill(0);
    const unitsFreq = Array(10).fill(0);

    history.forEach(r => {
      doubleFreq[r.double] = (doubleFreq[r.double] || 0) + 1;
      tensFreq[parseInt(r.double[0])]++;
      unitsFreq[parseInt(r.double[1])]++;
    });

    const candidates = [];
    for (let t = 0; t < 10; t++) {
      for (let u = 0; u < 10; u++) {
        const dbl = `${t}${u}`;
        const freqScore = doubleFreq[dbl] || 0;
        const indScore = tensFreq[t] * unitsFreq[u];
        candidates.push({ double: dbl, freqScore, indScore });
      }
    }

    return candidates.sort((a, b) => b.freqScore - a.freqScore).slice(0, 50); // Top 50
  }

  async predictMarkov(candidates, prevDouble) {
    const history = await Result.find().sort({ date: -1 }).limit(50).lean();
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

    return candidates.map(c => ({
      ...c,
      markovScore: transitions[prevDouble] ? (transitions[prevDouble][c.double] || 0) : 0
    }));
  }

  async predictML(candidates, features) {
    // Placeholder for ML prediction
    // TODO: Use loaded model to score candidates
    return candidates.map(c => ({ ...c, mlScore: Math.random() })); // Random for now
  }

  async predictEnsemble(topK = 10) {
    const candidates = await this.generateCandidates();
    if (candidates.length === 0) return [];

    const latest = await Result.findOne().sort({ date: -1 });
    const prevDouble = latest ? latest.double : '00';

    let scored = await this.predictMarkov(candidates, prevDouble);
    scored = await this.predictML(scored, null); // TODO: pass features

    // Ensemble score
    scored = scored.map(c => ({
      ...c,
      score: this.weights.frequency * c.freqScore +
             this.weights.independence * c.indScore +
             this.weights.markov * c.markovScore +
             this.weights.ml * c.mlScore,
      source: 'ensemble'
    }));

    // Normalize scores to 0-1
    const maxScore = Math.max(...scored.map(c => c.score));
    scored.forEach(c => c.score = maxScore > 0 ? c.score / maxScore : 0);

    return scored.sort((a, b) => b.score - a.score).slice(0, topK).map(c => ({
      double: c.double,
      score: Math.round(c.score * 100) / 100,
      source: c.source,
      explain: {
        topFeatures: [
          `Frequency: ${c.freqScore}`,
          `Independence: ${c.indScore}`,
          `Markov: ${c.markovScore.toFixed(2)}`,
          `ML: ${c.mlScore.toFixed(2)}`
        ]
      }
    }));
  }

  updateWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }
}

module.exports = new Predictor();
