import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addEntry,
  deleteEntry,
  entriesBetween,
  entriesForDay,
  getSettings,
  updateEntry,
  updateSettings,
  upsertWeight,
  weightsBetween,
} from './repo';

const egg = {
  name: 'Egg',
  portion: '1 large',
  quantity: 2,
  kcal: 78,
  proteinG: 6,
  carbsG: 1,
  fatG: 5,
  source: 'manual' as const,
};

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.weights.clear(), db.settings.clear()]);
});

describe('entries', () => {
  it('adds with computed totals and lists by day', async () => {
    const e = await addEntry({ dayKey: '2026-01-05', meal: 'breakfast', items: [egg] });
    expect(e.totals.kcal).toBe(156);
    expect(e.items[0].id).toBeTruthy();
    await addEntry({ dayKey: '2026-01-06', meal: 'lunch', items: [egg] });
    expect((await entriesForDay('2026-01-05')).map((x) => x.id)).toEqual([e.id]);
    expect(await entriesBetween('2026-01-01', '2026-01-31')).toHaveLength(2);
    expect(await entriesBetween('2026-01-06', '2026-01-06')).toHaveLength(1);
  });

  it('recomputes totals on update and deletes', async () => {
    const e = await addEntry({ dayKey: '2026-01-05', meal: 'dinner', items: [egg] });
    await updateEntry(e.id, { items: [{ ...egg, quantity: 1 }] });
    expect((await entriesForDay('2026-01-05'))[0].totals.kcal).toBe(78);
    await deleteEntry(e.id);
    expect(await entriesForDay('2026-01-05')).toHaveLength(0);
  });
});

describe('weights', () => {
  it('keeps one entry per day', async () => {
    await upsertWeight('2026-01-05', 80);
    await upsertWeight('2026-01-05', 79.5);
    await upsertWeight('2026-01-06', 79);
    const list = await weightsBetween('2026-01-01', '2026-01-31');
    expect(list.map((w) => w.weightKg)).toEqual([79.5, 79]);
  });
});

describe('settings', () => {
  it('returns defaults and merges patches', async () => {
    const s = await getSettings();
    expect(s.provider.preset).toBe('gemini');
    await updateSettings({ units: 'imperial' });
    const next = await getSettings();
    expect(next.units).toBe('imperial');
    expect(next.provider.model).toBe('gemini-3.5-flash-lite');
  });
});

describe('normalizeItem clamping', () => {
  it('never stores negative quantities or macros', async () => {
    const e = await addEntry({
      dayKey: '2026-01-07',
      meal: 'snack',
      items: [{ ...egg, quantity: -2, kcal: -50 }],
    });
    expect(e.items[0].quantity).toBe(0);
    expect(e.items[0].kcal).toBe(0);
    expect(e.totals.kcal).toBe(0);
  });
});
