import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  it('renders the bottom navigation', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });
});
