import { describe, expect, it } from 'vitest';
import {
  dueReminders,
  formatTime,
  nextReminder,
  parseTime,
  sanitizeReminders,
  slotsForDay,
} from './reminders';
import type { ReminderSettings } from '../db/types';

const base: ReminderSettings = {
  enabled: true,
  times: { breakfast: '09:00', lunch: '13:00', dinner: '19:30' },
  skipIfLogged: true,
};

// A fixed local date (the suite runs in Pacific/Kiritimati; all math is local).
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 9, 27 + dayOffset, h, m, 0, 0);

describe('parseTime / formatTime', () => {
  it('round-trips valid times and rejects garbage', () => {
    expect(parseTime('09:05')).toBe(545);
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('23:59')).toBe(1439);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('noon')).toBeNull();
    expect(parseTime(undefined)).toBeNull();
    expect(formatTime(545)).toBe('09:05');
    expect(formatTime(0)).toBe('00:00');
  });
});

describe('sanitizeReminders', () => {
  it('defaults when nothing is stored and keeps valid values', () => {
    const s = sanitizeReminders(undefined);
    expect(s.enabled).toBe(false);
    expect(s.skipIfLogged).toBe(true);
    expect(s.times).toEqual({ breakfast: '09:00', lunch: '13:00', dinner: '19:30' });
    const kept = sanitizeReminders({
      enabled: true,
      skipIfLogged: false,
      times: { breakfast: '7:30', lunch: '', dinner: '25:00' },
    });
    expect(kept.enabled).toBe(true);
    expect(kept.skipIfLogged).toBe(false);
    expect(kept.times).toEqual({ breakfast: '07:30', lunch: '', dinner: '19:30' });
  });
});

describe('slotsForDay', () => {
  it('returns one local-time slot per configured meal, in clock order', () => {
    const slots = slotsForDay({ ...base, times: { ...base.times, lunch: '' } }, at(15));
    expect(slots.map((s) => s.meal)).toEqual(['breakfast', 'dinner']);
    expect(slots[0].at.getHours()).toBe(9);
    expect(slots[1].at.getHours()).toBe(19);
    expect(slots[1].at.getMinutes()).toBe(30);
    expect(slots[0].key).toBe('2026-10-27:breakfast');
  });
});

describe('nextReminder', () => {
  it('finds the next slot today, skipping logged meals', () => {
    expect(nextReminder(base, at(8), [])?.meal).toBe('breakfast');
    expect(nextReminder(base, at(8), ['breakfast'])?.meal).toBe('lunch');
    expect(nextReminder(base, at(13, 0), [])?.meal).toBe('lunch'); // exactly on time
    expect(nextReminder(base, at(13, 1), [])?.meal).toBe('dinner');
  });

  it('rolls over to tomorrow and ignores today’s logged meals there', () => {
    const next = nextReminder(base, at(20), ['breakfast', 'lunch', 'dinner']);
    expect(next?.meal).toBe('breakfast');
    expect(next?.at.getDate()).toBe(28);
  });

  it('is null when disabled or when no times are set', () => {
    expect(nextReminder({ ...base, enabled: false }, at(8), [])).toBeNull();
    expect(
      nextReminder({ ...base, times: { breakfast: '', lunch: '', dinner: '' } }, at(8), []),
    ).toBeNull();
  });

  it('does not skip logged meals when skipIfLogged is off', () => {
    expect(nextReminder({ ...base, skipIfLogged: false }, at(8), ['breakfast'])?.meal).toBe(
      'breakfast',
    );
  });
});

describe('dueReminders', () => {
  it('returns slots that passed since the last check, inside the 3 h window', () => {
    // Phone asleep from 08:00 to 14:00: breakfast (09:00) is too old, lunch (13:00) is due.
    const due = dueReminders(base, at(14), at(8), []);
    expect(due.map((s) => s.meal)).toEqual(['lunch']);
  });

  it('never resends a slot that was already covered by the last check', () => {
    expect(dueReminders(base, at(13, 30), at(13, 10), [])).toEqual([]);
  });

  it('stays quiet for meals already logged', () => {
    expect(dueReminders(base, at(13, 30), at(12), ['lunch'])).toEqual([]);
    expect(
      dueReminders({ ...base, skipIfLogged: false }, at(13, 30), at(12), ['lunch']),
    ).toHaveLength(1);
  });
});
