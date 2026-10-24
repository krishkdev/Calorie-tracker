import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { mergeSettings, withFiberTarget } from './repo';
import { DEFAULT_SETTINGS } from './defaults';
import type { FoodEntry, Macros, Settings, WeightEntry } from './types';
import { lastNDayKeys, todayKey } from '../lib/dates';
import { fiberOf, sumMacros, ZERO_MACROS } from '../nutrition/totals';

/** undefined while loading, null when the user has not onboarded yet. */
export function useProfile() {
  return useLiveQuery(async () => {
    const p = await db.profile.get('me');
    return p ? withFiberTarget(p) : null;
  }, []);
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
  fiber: number;
  /** False for days with no entries at all, so averages can skip them. */
  logged: boolean;
}

/**
 * Today's day key, re-read when the app returns to the foreground and once a
 * minute, so screens left open across midnight move on to the new day.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()));
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

/** One row per day for the last N days (oldest first), zeros for days without entries. */
export function useDailyCalories(days: number): DailyCalories[] | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const keys = lastNDayKeys(days, today);
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
      return {
        dayKey,
        kcal: m.kcal,
        protein: m.proteinG,
        carbs: m.carbsG,
        fat: m.fatG,
        fiber: fiberOf(m),
        logged: byDay.has(dayKey),
      };
    });
  }, [days, today]);
}

/**
 * Weights in the last N days plus `lead` earlier days, so a trailing average
 * over the window's first points can use the weights logged just before it.
 */
export function useWeights(days: number, lead = 0): WeightEntry[] | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const keys = lastNDayKeys(days + lead, today);
    return db.weights
      .where('dayKey')
      .between(keys[0], keys[keys.length - 1], true, true)
      .sortBy('dayKey');
  }, [days, lead, today]);
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
