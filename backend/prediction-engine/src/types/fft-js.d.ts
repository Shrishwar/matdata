declare module 'fft-js' {
  export type Phasor = [number, number];
  
  export function fft(vector: number[]): Phasor[];
  export function ifft(phasors: Phasor[]): number[];
  export function fft(real: number[], imaginary: number[]): Phasor[];
  export function ifft(real: number[], imaginary: number[]): Phasor[];
  
  export const util: {
    fft: (vector: number[] | number[][]) => Phasor[];
    ifft: (phasors: Phasor[]) => number[];
    toComplexArray: {
      (real: number[]): Phasor[];
      (real: number[], imaginary: number[]): Phasor[];
    };
    toComplexNumbers: (phasors: Phasor[]) => { real: number[]; imaginary: number[] };
  };
}
