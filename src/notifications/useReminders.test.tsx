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

async function setLunchReminderAt(hhmm: string, skipIfLogged = true) {
  await updateSettings({
    reminders: {
      enabled: true,
      skipIfLogged,
      times: { breakfast: '', lunch: hhmm, dinner: '' },
    },
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
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
  vi.unstubAllGlobals();
  setHidden(false);
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

  it('still reminds when skipIfLogged is off and the meal is logged', async () => {
    await setLunchReminderAt('13:00', false);
    await addEntry({ dayKey: '2026-10-27', loggedAt: Date.now(), meal: 'lunch', items: [] });
    render(
      <MemoryRouter>
        <ReminderBanner />
      </MemoryRouter>,
    );
    await advance(3 * 60 * 1000);
    expect(await screen.findByText('Log your lunch')).toBeInTheDocument();
  });

  it('keeps the reminder for the app when a system notification cannot be shown', async () => {
    await setLunchReminderAt('13:00');
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'denied', requestPermission: vi.fn() }),
    );
    render(
      <MemoryRouter>
        <ReminderBanner />
      </MemoryRouter>,
    );
    await advance(50);
    setHidden(true);
    await advance(3 * 60 * 1000);
    // Coming back to the app shows the banner that could not go out as a notification.
    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(await screen.findByText('Log your lunch')).toBeInTheDocument();
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
