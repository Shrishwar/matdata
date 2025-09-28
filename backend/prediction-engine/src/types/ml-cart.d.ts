declare module 'ml-cart' {
  export class DecisionTreeClassifier {
    constructor(options?: {
      maxDepth?: number;
      minSamples?: number;
    });
    train(features: number[][], targets: number[]): void;
    predict(features: number[][]): number[];
    featureImportance?: number[];
  }
}
