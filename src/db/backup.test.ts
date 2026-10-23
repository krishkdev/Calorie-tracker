import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup, validateBackup } from './backup';
import { db } from './db';
import { addEntry, addFavorite, saveProfile, updateSettings, upsertWeight } from './repo';

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
