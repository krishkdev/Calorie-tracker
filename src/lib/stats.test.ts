import { describe, expect, it } from 'vitest';
import { trailingAverage } from './stats';

describe('trailingAverage', () => {
  it('averages only points inside the window and sorts by day', () => {
    const r = trailingAverage(
      [
        { dayKey: '2026-01-10', value: 80 },
        { dayKey: '2026-01-01', value: 82 },
        { dayKey: '2026-01-03', value: 81 },
      ],
      7,
    );
    expect(r.map((p) => p.dayKey)).toEqual(['2026-01-01', '2026-01-03', '2026-01-10']);
    expect(r[0].avg).toBe(82);
    expect(r[1].avg).toBe(81.5);
    // Jan 10 window covers Jan 4..10: only itself.
    expect(r[2].avg).toBe(80);
  });
});
