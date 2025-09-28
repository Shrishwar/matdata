module.exports = {
  windows: {
    k7: 7,
    k14: 14,
    k30: 30,
    historyLimit: 200
  },
  ensembleWeights: {
    frequency: 0.15,
    independence: 0.10,
    markov1: 0.20,
    markov2: 0.15,
    recency: 0.15,
    pairGap: 0.10,
    streakGap: 0.10,
    ml: 0.05
  },
  recency: {
    window: 30,
    decay: 0.95
  },
  scraping: {
    maxRetries: 3,
    timeout: 15000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  ml: {
    modelPath: './models/xgb_model_latest.joblib',
    featureListPath: './models/feature_list.json',
    shapExplainerPath: './models/shap_explainer.pkl'
  },
  cache: {
    ttl: 300000 // 5 minutes
  }
};
