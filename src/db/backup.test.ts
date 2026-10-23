import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup, validateBackup } from './backup';
import { db } from './db';
import { DEFAULT_SETTINGS } from './defaults';
import {
  addEntry,
  addFavorite,
  mergeSettings,
  saveProfile,
  updateSettings,
  upsertWeight,
} from './repo';

const egg = {
  name: 'Egg',
  portion: '1',
  quantity: 1,
  kcal: 78,
  proteinG: 6,
  carbsG: 1,
  fatG: 5,
  source: 'manual' as const,
};

beforeEach(async () => {
  await Promise.all([
    db.profile.clear(),
    db.settings.clear(),
    db.entries.clear(),
    db.weights.clear(),
    db.favorites.clear(),
  ]);
});

describe('backup', () => {
  it('round-trips data and strips the api key by default', async () => {
    await saveProfile({
      age: 30,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      activity: 'light',
      goal: 'maintain',
      rateKgPerWeek: 0,
      targets: { kcal: 2500, proteinG: 130, carbsG: 300, fatG: 70 },
      targetsOverridden: false,
      onboardedAt: 1,
    });
    await updateSettings({
      provider: {
        kind: 'openai-compatible',
        preset: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-secret',
        model: 'gpt-6-luna',
        supportsVision: true,
        jsonMode: true,
      },
    });
    await addEntry({ dayKey: '2026-02-01', meal: 'lunch', items: [egg] });
    await upsertWeight('2026-02-01', 80);
    await addFavorite('Egg', [{ ...egg, id: 'x' }]);

    const b = await exportBackup();
    expect(b.settings?.provider.apiKey).toBe('');
    expect(b.entries).toHaveLength(1);
    expect((await exportBackup({ includeApiKey: true })).settings?.provider.apiKey).toBe(
      'sk-secret',
    );

    // Simulate a fresh device, then import.
    await Promise.all([
      db.profile.clear(),
      db.entries.clear(),
      db.weights.clear(),
      db.favorites.clear(),
    ]);
    const json = JSON.parse(JSON.stringify(b));
    const summary = await importBackup(json, 'merge');
    expect(summary).toEqual({
      entries: 1,
      weights: 1,
      favorites: 1,
      profile: true,
      settings: true,
    });
    expect((await db.entries.toArray())[0].totals.kcal).toBe(78);
    // Existing key survives an import whose settings have no key.
    expect((await db.settings.get('app'))?.provider.apiKey).toBe('sk-secret');
  });

  it('replace mode wipes existing records and merge keeps them', async () => {
    await addEntry({ dayKey: '2026-02-01', meal: 'lunch', items: [egg] });
    const b = JSON.parse(JSON.stringify(await exportBackup()));
    await addEntry({ dayKey: '2026-02-02', meal: 'dinner', items: [egg] });
    await importBackup(b, 'merge');
    expect(await db.entries.count()).toBe(2);
    await importBackup(b, 'replace');
    expect(await db.entries.count()).toBe(1);
  });

  it('rejects foreign or newer files', () => {
    expect(() => validateBackup({ app: 'other' })).toThrow(/not exported/);
    expect(() => validateBackup({ app: 'calorie-tracker', schemaVersion: 99 })).toThrow(/newer/);
    expect(() => validateBackup('nope')).toThrow();
  });
});

describe('import hardening', () => {
  it('rebuilds malformed entries and drops unusable rows', async () => {
    const summary = await importBackup(
      {
        app: 'calorie-tracker',
        schemaVersion: 1,
        entries: [
          { id: 'ok', dayKey: '2026-03-03', meal: 'lunch', items: [{ name: 'Soup', kcal: 120 }] },
          {
            id: 'no-totals',
            dayKey: '2026-03-03',
            meal: 'weird',
            items: [{ name: 7, kcal: '30' }],
          },
          { id: 'bad-day', dayKey: 'garbage', meal: 'lunch', items: [] },
          { dayKey: '2026-03-03', meal: 'lunch', items: [] },
        ],
        weights: [
          { id: 'w1', dayKey: '2026-03-03', loggedAt: 1, weightKg: 'NaN' },
          { id: 'w2', dayKey: '2026-03-04', loggedAt: 1, weightKg: 70 },
        ],
        favorites: [{ id: 'f', name: 'X', items: [{ name: '', kcal: 1 }, { name: 'Y' }] }],
        profile: { age: 1 },
      },
      'merge',
    );
    expect(summary).toEqual({
      entries: 2,
      weights: 1,
      favorites: 1,
      profile: false,
      settings: false,
    });
    const rows = await db.entries.toArray();
    const fixed = rows.find((r) => r.id === 'no-totals')!;
    expect(fixed.totals.kcal).toBe(30);
    expect(fixed.meal).toBe('snack');
    expect(fixed.items[0].name).toBe('7');
    expect((await db.favorites.get('f'))!.items.map((i) => i.name)).toEqual(['Y']);
  });
});

describe('importBackup hardening', () => {
  const entry = (extra: Record<string, unknown> = {}) => ({
    id: 'e1',
    dayKey: '2024-01-02',
    loggedAt: 1,
    meal: 'lunch',
    items: [{ id: 'i1', name: 'Rice', portion: 150, kcal: 200 }],
    totals: { kcal: 200, proteinG: 0, carbsG: 0, fatG: 0 },
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  });
  const file = (over: Record<string, unknown>) => ({
    app: 'calorie-tracker',
    schemaVersion: 1,
    exportedAt: '',
    profile: null,
    settings: null,
    entries: [],
    weights: [],
    favorites: [],
    ...over,
  });

  it('coerces a numeric portion instead of aborting', async () => {
    const s = await importBackup(file({ entries: [entry()] }), 'replace');
    expect(s.entries).toBe(1);
    expect((await db.entries.get('e1'))?.items[0].portion).toBe('150');
  });

  it('skips a corrupt thumbnail but keeps the entry', async () => {
    await importBackup(
      file({ entries: [entry({ photoThumb: 'data:image/jpeg;base64,@@@' })] }),
      'replace',
    );
    expect((await db.entries.get('e1'))?.photoThumb).toBeUndefined();
  });

  it('merge keeps an existing thumbnail when the backup has none', async () => {
    await importBackup(file({ entries: [entry()] }), 'replace');
    await db.entries.update('e1', { photoThumb: new Blob(['x'], { type: 'image/jpeg' }) });
    await importBackup(file({ entries: [entry()] }), 'merge');
    // fake-indexeddb stores Blobs as plain objects; present is what matters here.
    expect((await db.entries.get('e1'))?.photoThumb).toBeDefined();
  });

  it('drops an implausible profile', async () => {
    const s = await importBackup(
      file({ profile: { targets: { kcal: 2000 }, weightKg: 80, activity: 'couch', sex: 'x' } }),
      'replace',
    );
    expect(s.profile).toBe(false);
    expect(await db.profile.get('me')).toBeUndefined();
  });

  it('skips future days and counts one weight per day', async () => {
    const s = await importBackup(
      file({
        entries: [entry({ dayKey: '2099-01-01' })],
        weights: [
          { id: 'w1', dayKey: '2024-01-01', weightKg: 70, loggedAt: 1 },
          { id: 'w2', dayKey: '2024-01-01', weightKg: 71, loggedAt: 2 },
          { id: 'w3', dayKey: '2099-01-01', weightKg: 72, loggedAt: 3 },
        ],
      }),
      'replace',
    );
    expect(s.entries).toBe(0);
    expect(s.weights).toBe(1);
    expect((await db.weights.toArray()).map((w) => w.weightKg)).toEqual([71]);
  });

  it('only carries the current key over for the same preset', async () => {
    await db.settings.put(
      mergeSettings({
        provider: { ...DEFAULT_SETTINGS.provider, preset: 'gemini', apiKey: 'AIza-x' },
      }),
    );
    await importBackup(
      file({ settings: { provider: { preset: 'openai', apiKey: '', model: 'gpt-6-luna' } } }),
      'merge',
    );
    expect((await db.settings.get('app'))?.provider.apiKey).toBe('');
  });

  it('sanitises units, theme and meal cutoffs', () => {
    const s = mergeSettings({
      units: 'lbs' as never,
      theme: null as never,
      mealCutoffs: { breakfast: 'x' as never, lunch: 14, dinner: 99 } as never,
    });
    expect(s.units).toBe('metric');
    expect(s.theme).toBe('system');
    expect(s.mealCutoffs.lunch).toBe(14);
    expect(s.mealCutoffs.breakfast).toBe(DEFAULT_SETTINGS.mealCutoffs.breakfast);
    expect(s.mealCutoffs.dinner).toBe(DEFAULT_SETTINGS.mealCutoffs.dinner);
  });
});
