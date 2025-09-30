import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import HomePage from '../pages/HomePage';

vi.mock('../services/api', () => ({
  resultsAPI: {
    getFuture: vi.fn().mockRejectedValue(new Error('network')),
    getGuesses: vi.fn().mockRejectedValue(new Error('network')),
    subscribeToLatest: vi.fn().mockImplementation(() => () => {}),
  },
  predictionApi: {
    getLivePredictions: vi.fn(),
  },
}));

describe('HomePage loading/error', () => {
  it('shows error banner on load failure', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load data/i)).toBeInTheDocument();
    });
  });
});


