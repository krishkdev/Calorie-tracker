import { describe, expect, it } from 'vitest';
import { addDays, dayKey, formatDayKey, guessMeal, lastNDayKeys, parseDayKey } from './dates';

describe('dayKey', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 local on 2026-03-01: UTC may already be the next day depending on TZ.
    const d = new Date(2026, 2, 1, 23, 30);
    expect(dayKey(d)).toBe('2026-03-01');
    const early = new Date(2026, 2, 2, 0, 15);
    expect(dayKey(early)).toBe('2026-03-02');
  });

  it('round-trips through parseDayKey', () => {
    expect(dayKey(parseDayKey('2026-12-31'))).toBe('2026-12-31');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists the last N days oldest first', () => {
    expect(lastNDayKeys(3, '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('labels today and yesterday', () => {
    expect(formatDayKey('2026-05-10', '2026-05-10')).toBe('Today');
    expect(formatDayKey('2026-05-09', '2026-05-10')).toBe('Yesterday');
  });
});

describe('guessMeal', () => {
  it('maps hours to meals', () => {
    expect(guessMeal(new Date(2026, 0, 1, 8))).toBe('breakfast');
    expect(guessMeal(new Date(2026, 0, 1, 13))).toBe('lunch');
    expect(guessMeal(new Date(2026, 0, 1, 19))).toBe('dinner');
    expect(guessMeal(new Date(2026, 0, 1, 23))).toBe('snack');
  });
});
