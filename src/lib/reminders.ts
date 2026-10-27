import { DEFAULT_REMINDERS } from '../db/defaults';
import type { MealType, ReminderMeal, ReminderSettings } from '../db/types';
import { dayKey as dayKeyFor } from './dates';

/**
 * Pure scheduling logic for "time to log food" reminders. Nothing here touches
 * the Notifications API, so it is fully unit-tested; the hook in
 * src/notifications decides how to surface what this computes.
 */

export const REMINDER_MEALS: ReminderMeal[] = ['breakfast', 'lunch', 'dinner'];

/** A reminder is considered missed (and no longer worth sending) after this long. */
export const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000;

export interface ReminderSlot {
  meal: ReminderMeal;
  at: Date;
  /** Stable id per meal per day; used to deduplicate notifications. */
  key: string;
}

/** 'HH:MM' → minutes after midnight, or null when malformed. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes after midnight → 'HH:MM'. */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Normalise whatever is stored (old versions, hand-edited backups). */
export function sanitizeReminders(raw: Partial<ReminderSettings> | undefined): ReminderSettings {
  const times = { ...DEFAULT_REMINDERS.times };
  for (const meal of REMINDER_MEALS) {
    const v = raw?.times?.[meal];
    if (v === '') times[meal] = '';
    else {
      const minutes = parseTime(v);
      if (minutes !== null) times[meal] = formatTime(minutes);
    }
  }
  return {
    enabled: raw?.enabled === true,
    times,
    skipIfLogged: raw?.skipIfLogged !== false,
  };
}

/** The reminder times on a given local day, in clock order. */
export function slotsForDay(settings: ReminderSettings, day: Date): ReminderSlot[] {
  const dayKey = dayKeyFor(day);
  const slots: ReminderSlot[] = [];
  for (const meal of REMINDER_MEALS) {
    const minutes = parseTime(settings.times[meal]);
    if (minutes === null) continue;
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes, 0, 0);
    slots.push({ meal, at, key: `${dayKey}:${meal}` });
  }
  return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * The next reminder at or after `now`, looking up to two days ahead. Meals
 * already logged today are skipped when `skipIfLogged` is on.
 */
export function nextReminder(
  settings: ReminderSettings,
  now: Date,
  loggedToday: Iterable<MealType>,
): ReminderSlot | null {
  if (!settings.enabled) return null;
  const logged = new Set(loggedToday);
  for (let offset = 0; offset < 2; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    for (const slot of slotsForDay(settings, day)) {
      if (slot.at.getTime() < now.getTime()) continue;
      if (offset === 0 && settings.skipIfLogged && logged.has(slot.meal)) continue;
      return slot;
    }
  }
  return null;
}

/**
 * Reminders whose time passed since the app last looked (for instance while
 * the phone was asleep), still inside the window, and still worth sending.
 */
export function dueReminders(
  settings: ReminderSettings,
  now: Date,
  since: Date,
  loggedToday: Iterable<MealType>,
): ReminderSlot[] {
  if (!settings.enabled) return [];
  const logged = new Set(loggedToday);
  const from = Math.max(since.getTime(), now.getTime() - REMINDER_WINDOW_MS);
  const today = slotsForDay(settings, now);
  return today.filter(
    (slot) =>
      slot.at.getTime() > from &&
      slot.at.getTime() <= now.getTime() &&
      !(settings.skipIfLogged && logged.has(slot.meal)),
  );
}

const COPY: Record<ReminderMeal, { title: string; body: string }> = {
  breakfast: { title: 'Log your breakfast', body: 'A quick entry now keeps the day on track.' },
  lunch: { title: 'Log your lunch', body: 'Snap a photo or describe it in a sentence.' },
  dinner: { title: 'Log your dinner', body: 'Close out the day while it is fresh in mind.' },
};

export function reminderCopy(meal: ReminderMeal): { title: string; body: string } {
  return COPY[meal];
}

/** Where tapping a reminder lands: the Log screen with the meal preselected. */
export function reminderPath(meal: ReminderMeal): string {
  return `/log?meal=${meal}`;
}
