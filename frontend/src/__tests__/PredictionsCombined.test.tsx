import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PredictionsPage from '../pages/PredictionsPage';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true, latest: { date: new Date().toISOString(), middle: '45' } }) } as any));

vi.mock('../services/api', () => ({
  predictionApi: {
    getPredictions: vi.fn().mockResolvedValue({ success: true, data: { predictions: [], analysis: {}, predictionTable: [], summary: {} } }),
    getCombined: vi.fn().mockResolvedValue({ success: true, data: { top: [
      { number: 7, confidence: 82, human: ['gap ok'], system: ['prob 0.22'] },
      { number: 12, confidence: 78, human: ['freq good'], system: ['prob 0.20'] },
    ], provenance: { deterministic: true } } }),
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('PredictionsPage Hybrid Combined', () => {
  it('shows Hybrid Top 3 explanations', async () => {
    renderWithProviders(<PredictionsPage />);

    const btn = await screen.findByText('Hybrid Top 3');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/Hybrid Top 3/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('07')).toHaveLength(2); // One in predictions grid, one in hybrid section
    expect(screen.getByText('82%')).toBeInTheDocument();
  });
});


