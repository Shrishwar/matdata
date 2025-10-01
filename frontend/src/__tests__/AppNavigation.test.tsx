import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App navigation', () => {
  it('renders App and default route', () => {
    render(<App />);

    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
  });
});


