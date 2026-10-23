import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import NumberInput from './NumberInput';

function Harness({ initial = 1 }: { initial?: number }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <NumberInput aria-label="Qty" value={v} onChange={setV} />
      <button type="button" onClick={() => setV(v + 1)}>
        inc
      </button>
      <output>{v}</output>
    </>
  );
}

describe('NumberInput', () => {
  it('can be cleared and retyped without leading zeros', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Qty') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('0');
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2');
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('2');
  });

  it('keeps a partial decimal while typing and adopts outside changes', () => {
    render(<Harness initial={1} />);
    const input = screen.getByLabelText('Qty') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.5' } });
    expect(input.value).toBe('1.5');
    expect(screen.getByRole('status', { hidden: true }).textContent).toBe('1.5');
    fireEvent.click(screen.getByText('inc'));
    expect(input.value).toBe('2.5');
  });
});
