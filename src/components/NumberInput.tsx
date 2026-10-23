import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

/**
 * A controlled number field that lets the user clear it and type freely.
 * The text the user sees is kept as a string draft; the parent only ever
 * receives finite numbers (an empty field reports 0). Without this, clearing a
 * controlled numeric input snaps back to "0" and typing "2" shows "02".
 */
export default function NumberInput({ value, onChange, ...rest }: Props) {
  const [draft, setDraft] = useState(() => format(value));
  const [seen, setSeen] = useState(value);
  // Adopt outside changes (steppers, unit switches) unless the draft already
  // means the same number, so "1." or "" survive the round trip.
  if (value !== seen) {
    setSeen(value);
    if (parse(draft) !== value) setDraft(format(value));
  }
  return (
    <input
      {...rest}
      type="number"
      value={draft}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = parse(text);
        if (n !== value) onChange(n);
      }}
    />
  );
}

function parse(text: string): number {
  if (text.trim() === '') return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function format(n: number): string {
  return Number.isFinite(n) ? String(n) : '';
}
