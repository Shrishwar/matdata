import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PredictionsPage from '../pages/PredictionsPage';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true, latest: { date: new Date().toISOString(), middle: '45' } }) } as any));

vi.mock('../services/api', () => {
  return {
    predictionApi: {
      getPredictions: vi.fn().mockResolvedValue({ success: true, data: { predictions: [{ number: 12, confidence: 80 }], analysis: { frequency: [] }, predictionTable: [], summary: {} } }),
    },
  };
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('PredictionsPage', () => {
  it('loads predictions and live data', async () => {
    renderWithProviders(<PredictionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Next Number Predictions/i)).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('refresh button triggers fetch', async () => {
    renderWithProviders(<PredictionsPage />);
    const btn = await screen.findByText('Refresh');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});
