import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import DateNav from './DateNav';

function Calendar({ initial = '2026-10-23' }: { initial?: string }) {
  const [day, setDay] = useState(initial);
  return <DateNav dayKey={day} onChange={setDay} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 23, 12));
});
afterEach(() => vi.useRealTimers());

describe('weekly date navigation', () => {
  it('disables future dates and moves the selection when a past day is picked', () => {
    render(<Calendar />);
    expect(screen.getByRole('button', { name: /Saturday, October 24/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Wednesday, October 21/ }));
    expect(screen.getByRole('button', { name: /Wednesday, October 21/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Pick a date')).toHaveValue('2026-10-21');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByLabelText('Pick a date')).toHaveValue('2026-10-23');
  });

  it('reveals the previous week when stepping back across Monday', () => {
    render(<Calendar initial="2026-10-19" />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(screen.getByRole('button', { name: /Sunday, October 18/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Monday, October 12/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('button', { name: /Monday, October 19/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('updates the visible week when the date picker crosses a year boundary', () => {
    render(<Calendar />);
    fireEvent.change(screen.getByLabelText('Pick a date'), { target: { value: '2025-12-31' } });
    expect(screen.getByRole('button', { name: /Wednesday, December 31, 2025/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Thursday, January 1, 2026/ })).toBeEnabled();
  });
});
