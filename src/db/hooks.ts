import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { mergeSettings } from './repo';
import { DEFAULT_SETTINGS } from './defaults';
import type { FoodEntry, Macros, Settings, WeightEntry } from './types';
import { lastNDayKeys } from '../lib/dates';
import { sumMacros, ZERO_MACROS } from '../nutrition/totals';

/** undefined while loading, null when the user has not onboarded yet. */
export function useProfile() {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

/** Stored settings, or undefined while the first read is in flight. */
export function useSettingsLoaded(): Settings | undefined {
  return useLiveQuery(async () => {
    const stored = await db.settings.get('app');
    return stored ? mergeSettings(stored) : DEFAULT_SETTINGS;
  }, []);
}

/** Settings with defaults while loading; use useSettingsLoaded to tell the two apart. */
export function useSettings(): Settings {
  return useSettingsLoaded() ?? DEFAULT_SETTINGS;
}

export function useDayEntries(dayKey: string): FoodEntry[] | undefined {
  return useLiveQuery(() => db.entries.where('dayKey').equals(dayKey).sortBy('loggedAt'), [dayKey]);
}

export function useDayTotals(dayKey: string): Macros {
  const entries = useDayEntries(dayKey);
  if (!entries) return ZERO_MACROS;
  return sumMacros(entries.map((e) => e.totals));
}

export function useEntry(id: string | undefined): FoodEntry | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.entries.get(id)) ?? null) : null), [id]);
}

export interface DailyCalories {
  dayKey: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** One row per day for the last N days (oldest first), zeros for days without entries. */
export function useDailyCalories(days: number): DailyCalories[] | undefined {
  return useLiveQuery(async () => {
    const keys = lastNDayKeys(days);
    const entries = await db.entries
      .where('dayKey')
      .between(keys[0], keys[keys.length - 1], true, true)
      .toArray();
    const byDay = new Map<string, Macros[]>();
    for (const e of entries) {
      const list = byDay.get(e.dayKey) ?? [];
      list.push(e.totals);
      byDay.set(e.dayKey, list);
    }
    return keys.map((dayKey) => {
      const m = sumMacros(byDay.get(dayKey) ?? []);
      return { dayKey, kcal: m.kcal, protein: m.proteinG, carbs: m.carbsG, fat: m.fatG };
    });
  }, [days]);
}

export function useWeights(days: number): WeightEntry[] | undefined {
  return useLiveQuery(async () => {
    const keys = lastNDayKeys(days);
    return db.weights
      .where('dayKey')
      .between(keys[0], keys[keys.length - 1], true, true)
      .sortBy('dayKey');
  }, [days]);
}

export function useLatestWeight(): WeightEntry | null | undefined {
  return useLiveQuery(async () => (await db.weights.orderBy('dayKey').last()) ?? null, []);
}

export function useFavorites(limit = 50) {
  return useLiveQuery(
    () => db.favorites.orderBy('lastUsedAt').reverse().limit(limit).toArray(),
    [limit],
  );
}
