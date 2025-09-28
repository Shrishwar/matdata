declare module 'ml-regression' {
  export interface RegressionResult {
    predict(x: number): number;
    toString(precision?: number): string;
    toLaTeX(precision?: number): string;
    coefficients: number[];
  }

  export class SimpleLinearRegression {
    constructor(x: number[], y: number[]);
    predict(x: number): number;
    toString(precision?: number): string;
    toLaTeX(precision?: number): string;
    readonly slope: number;
    readonly intercept: number;
    readonly r2: number;
  }

  export class PolynomialRegression {
    constructor(x: number[], y: number[], degree: number);
    predict(x: number): number;
    toString(precision?: number): string;
    toLaTeX(precision?: number): string;
    readonly coefficients: number[];
    readonly r2: number;
  }

  export function createModel(regression: any, options: any): any;
}
