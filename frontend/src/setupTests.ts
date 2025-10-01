import '@testing-library/jest-dom';

import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';

// Simple EventSource mock to bypass TypeScript strictness
global.EventSource = class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Chart.js to prevent DOM access issues in tests
vi.mock('chart.js', () => {
  const registeredScales = new Map();

  class MockChart {
    constructor() {
      return {
        update: vi.fn(),
        destroy: vi.fn(),
        resize: vi.fn(),
        bindEvents: vi.fn(),
        bindResponsiveEvents: vi.fn(),
        _checkEventBindings: vi.fn(),
      };
    }
    static register = vi.fn((...items) => {
      items.forEach(item => {
        if (item && item.id) {
          registeredScales.set(item.id, item);
        }
      });
    });
  }

  // Create a mock registry with registered scales
  MockChart.registry = {
    _get: vi.fn((key) => registeredScales.get(key) || { id: key }),
    getScale: vi.fn((key) => registeredScales.get(key) || { id: key }),
  };

  // Pre-register common scales
  registeredScales.set('linear', { id: 'linear' });
  registeredScales.set('category', { id: 'category' });

  return {
    Chart: MockChart,
    CategoryScale: { id: 'category' },
    LinearScale: { id: 'linear' },
    BarElement: vi.fn(),
    PointElement: vi.fn(),
    LineElement: vi.fn(),
    Title: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
    ArcElement: vi.fn(),
    registerables: [],
  };
});

// Mock canvas getContext to prevent DOM context errors
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Array(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Array(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}));
