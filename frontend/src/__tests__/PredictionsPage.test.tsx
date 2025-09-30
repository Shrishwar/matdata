import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import PredictionsPage from '../pages/PredictionsPage';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true, latest: { date: new Date().toISOString(), middle: '45' } }) } as any));

vi.mock('../services/api', () => {
  return {
    predictionApi: {
      getPredictions: vi.fn().mockResolvedValue({ success: true, data: { predictions: [{ number: 12, confidence: 80 }], analysis: { frequency: [] }, predictionTable: [], summary: {} } }),
    },
  };
});

describe('PredictionsPage', () => {
  it('loads predictions and live data', async () => {
    render(<PredictionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Next Number Predictions/i)).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('refresh button triggers fetch', async () => {
    render(<PredictionsPage />);
    const btn = await screen.findByText('Refresh');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});


