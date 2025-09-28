import MatkaPredictor from './services/prediction/matkaPredictor';
import { logger } from './utils/logger';
async function main() {
    try {
        logger.info('Starting Matka Prediction Engine...');
        const predictor = new MatkaPredictor();
        // Load data and generate predictions
        await predictor.loadData('30d');
        const predictions = await predictor.generatePredictions();
        logger.info('Predictions generated successfully');
        logger.info(`Top prediction: ${predictions.summary.topPredictions[0]?.number} with ${predictions.summary.topPredictions[0]?.confidence}% confidence`);
        return predictions;
    }
    catch (error) {
        logger.error('Error in prediction engine:', error);
        process.exit(1);
    }
}
// Run the prediction engine if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
export { default as MatkaPredictor } from './services/prediction/matkaPredictor';
export default { MatkaPredictor };
//# sourceMappingURL=index.js.map