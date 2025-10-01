import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PredictionsPage from '../pages/PredictionsPage';

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

vi.mock('../services/api', () => ({
  predictionApi: {
    getPredictions: vi.fn().mockRejectedValue(new Error('network')),
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

describe('PredictionsPage loading/error', () => {
  it('renders without crashing and handles errors', async () => {
    renderWithProviders(<PredictionsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Next Number Predictions/i)).toBeInTheDocument();
    });
  });
});


