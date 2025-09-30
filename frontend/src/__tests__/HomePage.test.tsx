import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import HomePage from '../pages/HomePage';

vi.mock('../services/api', () => {
  return {
    resultsAPI: {
      getFuture: vi.fn().mockResolvedValue({ success: true, data: { date: new Date().toISOString(), open3: 'TBD', middle: 'TBD', close3: 'TBD', double: 'TBD' } }),
      getGuesses: vi.fn().mockResolvedValue({ success: true, data: { ok: true, guesses: [{ double: '12', score: 0.78, source: 'test', explain: { topFeatures: ['freq:0.5'] } }] } }),
      fetchLatest: vi.fn().mockResolvedValue({ success: true, data: { date: new Date().toISOString(), open3: '123', middle: '45', close3: '678', double: '12' } }),
      subscribeToLatest: vi.fn().mockImplementation(() => () => {}),
      getHistory: vi.fn(),
    },
    predictionApi: {
      getLivePredictions: vi.fn().mockResolvedValue({ success: true, data: { predictions: [{ number: 12, confidence: 80 }], analysis: {}, provenance: {} } }),
    },
  };
});

describe('HomePage', () => {
  it('renders and fetches future + guesses on load', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Upcoming Result/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Top Entertainment Guesses/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it("Fetch Today's Panel & Predict triggers latest and guesses", async () => {
    render(<HomePage />);

    const btn = await screen.findByText("Fetch Today's Panel & Predict");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/Latest Panel Result/i)).toBeInTheDocument();
    });
  });
});


