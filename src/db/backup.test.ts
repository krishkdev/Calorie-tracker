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
