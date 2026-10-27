import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReminderBanner from '../components/ReminderBanner';
import { db } from '../db/db';
import { addEntry, updateSettings } from '../db/repo';

/** Lets live queries and the hook's first check settle, then moves the clock on. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function setLunchReminderAt(hhmm: string) {
  await updateSettings({
    reminders: {
      enabled: true,
      skipIfLogged: true,
      times: { breakfast: '', lunch: hhmm, dinner: '' },
    },
  });
}

beforeEach(async () => {
  localStorage.clear();
  await db.settings.clear();
  await db.entries.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 27, 12, 58, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReminderBanner', () => {
  it('shows an in-app reminder when a meal time passes with the app on screen', async () => {
    await setLunchReminderAt('13:00');
    render(
      <MemoryRouter>
        <ReminderBanner />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Log your lunch')).toBeNull();
    await advance(3 * 60 * 1000);
    expect(await screen.findByText('Log your lunch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log' })).toHaveAttribute('href', '/log?meal=lunch');
  });

  it('stays quiet when that meal is already logged', async () => {
    await setLunchReminderAt('13:00');
    await addEntry({
      dayKey: '2026-10-27',
      loggedAt: Date.now(),
      meal: 'lunch',
      items: [],
    });
    render(
      <MemoryRouter>
        <ReminderBanner />
      </MemoryRouter>,
    );
    await advance(3 * 60 * 1000);
    expect(screen.queryByText('Log your lunch')).toBeNull();
  });

  it('does not fire the same slot twice after a remount', async () => {
    await setLunchReminderAt('13:00');
    const ui = (
      <MemoryRouter>
        <ReminderBanner />
      </MemoryRouter>
    );
    const first = render(ui);
    await advance(3 * 60 * 1000);
    expect(await screen.findByText('Log your lunch')).toBeInTheDocument();
    first.unmount();
    render(ui);
    await advance(1000);
    expect(screen.queryByText('Log your lunch')).toBeNull();
  });
});
