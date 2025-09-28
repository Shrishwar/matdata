declare class MongoService {
    private client;
    private db;
    private collection;
    private static instance;
    private constructor();
    static getInstance(): MongoService;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getHistoricalData(days?: number): Promise<any[]>;
    savePrediction(prediction: any): Promise<void>;
}
export declare const mongoService: MongoService;
export {};
