import MatkaPredictor from './dist/services/prediction/matkaPredictor.js';
import { logger } from './dist/utils/logger.js';
import fs from 'fs';

async function testWithSampleData() {
  try {
    logger.info('Testing prediction engine with sample data...');

    // Initialize the prediction engine
    const engine = new MatkaPredictor();

    // Load sample data
    const sampleData = JSON.parse(fs.readFileSync('./sample-data.json', 'utf8'));
    logger.info(`Loaded ${sampleData.length} sample records`);

    // Convert sample data to the expected format
    engine.historicalData = sampleData.map(item => ({
      date: new Date(item.date),
      number: item.number,
      timestamp: new Date(item.date),
      gameType: 'MAIN_BAZAR',
      openClose: 'CLOSE',
      tens: Math.floor(item.number / 10),
      units: item.number % 10
    }));

    // Generate predictions
    logger.info('Generating predictions...');
    const predictions = await engine.generatePredictions(5);

    // Log the results
    console.log('\n=== Prediction Results ===');
    console.log(`Total records analyzed: ${predictions.summary.totalRecords}`);
    console.log(`Last number: ${predictions.summary.lastNumber}`);
    console.log('\nTop Predictions:');
    predictions.summary.topPredictions.forEach((pred, index) => {
      console.log(`${index + 1}. Number: ${pred.number.toString().padStart(2, '0')} (Confidence: ${pred.confidence}%)`);
    });

    logger.info('Test completed successfully');
    console.log('\nTest passed! The mathjs config issue has been fixed.');

  } catch (error) {
    logger.error('Error in test function:', error);
    console.error('Test failed:', error.message);
  }
}

testWithSampleData();
