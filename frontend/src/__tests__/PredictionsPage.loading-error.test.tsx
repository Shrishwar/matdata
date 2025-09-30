import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PredictionsPage from '../pages/PredictionsPage';

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

vi.mock('../services/api', () => ({
  predictionApi: {
    getPredictions: vi.fn().mockRejectedValue(new Error('network')),
  },
}));

describe('PredictionsPage loading/error', () => {
  it('renders without crashing and handles errors', async () => {
    render(<PredictionsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Next Number Predictions/i)).toBeInTheDocument();
    });
  });
});


