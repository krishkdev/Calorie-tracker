import type { MealType } from '../db/types';

/** Local-time calendar day as 'YYYY-MM-DD'. Never use toISOString() here: that is UTC. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** Local midnight for a day key. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Inclusive list of day keys ending at `end`, oldest first. */
export function lastNDayKeys(n: number, end: string = todayKey()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(addDays(end, -i));
  return keys;
}

export function formatDayKey(key: string, today: string = todayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  const d = parseDayKey(key);
  const sameYear = d.getFullYear() === parseDayKey(today).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatShortDate(key: string): string {
  const d = parseDayKey(key);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export interface MealCutoffs {
  /** Hour (0-23) before which a meal counts as breakfast, etc. */
  breakfast: number;
  lunch: number;
  dinner: number;
}

export const DEFAULT_MEAL_CUTOFFS: MealCutoffs = { breakfast: 11, lunch: 16, dinner: 21 };

/** Guess the meal type from the clock so the user rarely has to pick it. */
export function guessMeal(
  d: Date = new Date(),
  cutoffs: MealCutoffs = DEFAULT_MEAL_CUTOFFS,
): MealType {
  const h = d.getHours();
  if (h < 4) return 'snack';
  if (h < cutoffs.breakfast) return 'breakfast';
  if (h < cutoffs.lunch) return 'lunch';
  if (h < cutoffs.dinner) return 'dinner';
  return 'snack';
}
