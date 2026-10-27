import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RemindersSection from './RemindersSection';
import { db } from '../db/db';
import { getSettings } from '../db/repo';

beforeEach(async () => {
  await db.settings.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RemindersSection', () => {
  it('asks for permission when turned on and saves the setting', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'default', requestPermission }),
    );
    render(<RemindersSection />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remind me to log food' }));
    expect(requestPermission).toHaveBeenCalled();
    expect(await screen.findByLabelText('Lunch reminder time')).toHaveValue('13:00');
    expect((await getSettings()).reminders.enabled).toBe(true);
  });

  it('still enables in-app reminders when notifications are blocked, and says so', async () => {
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'denied', requestPermission: vi.fn() }),
    );
    render(<RemindersSection />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remind me to log food' }));
    expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect((await getSettings()).reminders.enabled).toBe(true);
  });

  it('turns a meal off by clearing its time', async () => {
    vi.stubGlobal(
      'Notification',
      Object.assign(vi.fn(), { permission: 'granted', requestPermission: vi.fn() }),
    );
    render(<RemindersSection />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remind me to log food' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Breakfast' }));
    expect((await getSettings()).reminders.times.breakfast).toBe('');
    expect(screen.getByLabelText('Breakfast reminder time')).toBeDisabled();
  });
});
