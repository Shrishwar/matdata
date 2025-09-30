import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import HistoryPage from '../pages/HistoryPage';

vi.mock('../services/api', () => ({
  resultsAPI: {
    getHistory: vi.fn().mockRejectedValue(new Error('network')),
  },
}));

describe('HistoryPage loading/error', () => {
  it('shows error banner on failure', async () => {
    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load history/i)).toBeInTheDocument();
    });
  });
});


