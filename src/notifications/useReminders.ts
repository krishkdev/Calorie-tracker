import { useEffect, useState } from 'react';
import { useDayEntries, useSettings, useToday } from '../db/hooks';
import type { MealType } from '../db/types';
import { dueReminders, nextReminder, type ReminderSlot } from '../lib/reminders';
import { showReminderNotification } from './notify';

const CHECKED_KEY = 'ct-reminders-checked';
const FIRED_KEY = 'ct-reminders-fired';
/** Timers are unreliable over long spans (sleep, throttling), so re-check at least this often. */
const MAX_TIMER_MS = 15 * 60 * 1000;

function readCheckedAt(): Date | null {
  try {
    const v = Number(localStorage.getItem(CHECKED_KEY));
    return Number.isFinite(v) && v > 0 ? new Date(v) : null;
  } catch {
    return null;
  }
}

function writeCheckedAt(d: Date): void {
  try {
    localStorage.setItem(CHECKED_KEY, String(d.getTime()));
  } catch {
    // storage unavailable: duplicates are still prevented by the notification tag
  }
}

/** Keys fired today, so a slot never fires twice (e.g. after a reload). */
function readFired(today: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as unknown;
    if (Array.isArray(raw)) {
      return new Set(raw.filter((k): k is string => typeof k === 'string' && k.startsWith(today)));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function writeFired(keys: Set<string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...keys]));
  } catch {
    // ignore
  }
}

/**
 * Drives food-logging reminders while the app is running. On every check it
 * fires anything that came due since the last check (within the window), then
 * sleeps until the next slot. When the app is visible the reminder is shown
 * in-app; otherwise it goes out as a system notification.
 */
export function useReminders(): { banner: ReminderSlot | null; dismiss: () => void } {
  const { reminders } = useSettings();
  const today = useToday();
  const entries = useDayEntries(today);
  const loggedKey = entries ? [...new Set(entries.map((e) => e.meal))].sort().join(',') : null;
  const [shown, setShown] = useState<ReminderSlot | null>(null);

  useEffect(() => {
    if (!reminders.enabled || loggedKey === null) return;
    const logged = loggedKey ? (loggedKey.split(',') as MealType[]) : [];
    let timer: ReturnType<typeof setTimeout>;

    const check = () => {
      const now = new Date();
      const since = readCheckedAt() ?? now;
      const fired = readFired(today);
      const toFire = dueReminders(reminders, now, since, logged).filter((s) => !fired.has(s.key));
      for (const slot of toFire) fired.add(slot.key);
      writeFired(fired);
      writeCheckedAt(now);

      const last = toFire.at(-1);
      if (last) {
        if (document.visibilityState === 'visible') setShown(last);
        else {
          // Blocked or unsupported notifications: keep it for when the app returns.
          void showReminderNotification(last).then((ok) => {
            if (!ok) setShown(last);
          });
        }
      }

      const next = nextReminder(reminders, now, logged);
      const delay = next
        ? Math.min(Math.max(next.at.getTime() - now.getTime(), 1000), MAX_TIMER_MS)
        : MAX_TIMER_MS;
      timer = setTimeout(check, delay);
    };

    timer = setTimeout(check, 0);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reminders, loggedKey, today]);

  // A logged meal makes its own banner moot (when the user wants that), and so does a new day.
  const stale =
    !shown ||
    !shown.key.startsWith(today) ||
    (reminders.skipIfLogged && !!loggedKey?.split(',').includes(shown.meal));
  const banner = stale ? null : shown;
  return { banner, dismiss: () => setShown(null) };
}
