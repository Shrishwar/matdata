import { MongoClient, Db, Collection } from 'mongodb';
import { logger } from '../../utils/logger.js';

const MONGODB_URI = 'mongodb+srv://matdata:matdata%40123@cluster0.bdtjcps.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'matka';
const COLLECTION_NAME = 'results';

class MongoService {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection | null = null;
  private static instance: MongoService;

  private constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  public static getInstance(): MongoService {
    if (!MongoService.instance) {
      MongoService.instance = new MongoService();
    }
    return MongoService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.collection = this.db.collection(COLLECTION_NAME);
      logger.info('Successfully connected to MongoDB');
    } catch (error) {
      logger.error('Error connecting to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  async getHistoricalData(days: number = 30): Promise<any[]> {
    if (!this.collection) {
      throw new Error('Database not connected');
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await this.collection
        .find({
          date: { $gte: startDate },
          number: { $exists: true, $ne: null }
        })
        .sort({ date: 1 })
        .toArray();

      logger.info(`Retrieved ${results.length} historical records`);
      return results;
    } catch (error) {
      logger.error('Error fetching historical data:', error);
      throw error;
    }
  }

  async savePrediction(prediction: any): Promise<void> {
    if (!this.collection) {
      throw new Error('Database not connected');
    }

    try {
      await this.collection.insertOne({
        ...prediction,
        timestamp: new Date(),
        type: 'prediction'
      });
      logger.info('Saved prediction to database');
    } catch (error) {
      logger.error('Error saving prediction:', error);
      throw error;
    }
  }
}

export const mongoService = MongoService.getInstance();
