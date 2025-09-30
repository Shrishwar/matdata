import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import HistoryPage from '../pages/HistoryPage';

vi.mock('../services/api', () => ({
  resultsAPI: {
    getHistory: vi.fn().mockResolvedValue({ success: true, data: { history: [
      { _id: '1', date: new Date().toISOString(), open3: '123', close3: '456', middle: '45', double: '12', openSum: 6, closeSum: 15 },
    ] } }),
  },
}));

describe('HistoryPage', () => {
  it('renders history table rows', async () => {
    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/Past Results/i)).toBeInTheDocument();
    });

    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
  });
});


