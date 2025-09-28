import MatkaPredictor from './dist/services/prediction/matkaPredictor.js';
import { logger } from './dist/utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import process from 'process';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

async function main() {
  try {
    logger.info('Starting DP Matka Prediction Engine...');
    
    // Initialize the prediction engine
    const engine = new MatkaPredictor();
    
    // Load some sample data
    logger.info('Loading historical data...');
    const historicalData = await engine.loadData('30d');
    logger.info(`Loaded ${historicalData.length} records`);
    
    // If no data was loaded, add some sample data for testing
    if (historicalData.length === 0) {
      logger.warn('No historical data found. Generating sample data...');
      // Add some sample data points
      for (let i = 0; i < 50; i++) {
        engine.historicalData.push({
          date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
          number: Math.floor(Math.random() * 100),
          open3: Math.floor(Math.random() * 1000),
          middle: Math.floor(Math.random() * 1000),
          double: Math.floor(Math.random() * 1000),
          tens: Math.floor(Math.random() * 10),
          units: Math.floor(Math.random() * 10)
        });
      }
      logger.info(`Generated ${engine.historicalData.length} sample records`);
    }
    
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
    
    logger.info('Prediction engine completed successfully');
    
    // Display analysis results
    console.log('\n=== Analysis Results ===');
    if (predictions.analysis) {
      if (predictions.analysis.trends && predictions.analysis.trends.length > 0) {
        console.log('\nTrend Analysis:');
        predictions.analysis.trends.forEach(trend => {
          console.log(`- ${trend.name}: ${trend.value}`);
        });
      }
      
      if (predictions.analysis.patterns && predictions.analysis.patterns.length > 0) {
        console.log('\nPatterns Found:');
        predictions.analysis.patterns.slice(0, 3).forEach((pattern, i) => {
          console.log(`${i + 1}. ${pattern.pattern}: ${pattern.count} occurrences`);
        });
      }
    }
    
    // Save predictions to a file
    const outputPath = join(__dirname, 'predictions.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      analysis: predictions.analysis
    }, null, 2));
    logger.info(`Predictions saved to: ${outputPath}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  logger.error('Error:', err);
  process.exit(1);
});
