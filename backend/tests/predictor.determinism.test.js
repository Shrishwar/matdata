const MatkaPredictor = require('../prediction-engine/dist/services/prediction/matkaPredictor.js').default;

describe('Predictor determinism', () => {
  test('same input yields identical predictions', async () => {
    const series = Array.from({ length: 100 }, (_, i) => ({
      number: i % 100,
      date: new Date(2025, 0, 1 + i),
      tens: Math.floor((i % 100) / 10),
      units: (i % 100) % 10,
    }));

    const a = new MatkaPredictor();
    a.historicalData = series;
    const b = new MatkaPredictor();
    b.historicalData = series;

    const ra = await a.generatePredictions(10);
    const rb = await b.generatePredictions(10);

    const pickA = ra.predictions.map(p => `${p.number}:${Math.round(p.confidence)}`).join(',');
    const pickB = rb.predictions.map(p => `${p.number}:${Math.round(p.confidence)}`).join(',');
    expect(pickA).toEqual(pickB);
  });
});


