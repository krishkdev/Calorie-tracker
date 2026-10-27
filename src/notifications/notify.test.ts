import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationSupport, showReminderNotification } from './notify';

type Perm = 'default' | 'granted' | 'denied';

function stubNotification(permission: Perm) {
  const ctor = vi.fn();
  Object.assign(ctor, { permission, requestPermission: vi.fn() });
  vi.stubGlobal('Notification', ctor);
  return ctor;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notificationSupport', () => {
  it('is unsupported in a browser without the API', () => {
    expect(notificationSupport()).toBe('unsupported');
  });

  it('reflects the permission state', () => {
    stubNotification('granted');
    expect(notificationSupport()).toBe('granted');
    stubNotification('denied');
    expect(notificationSupport()).toBe('denied');
    stubNotification('default');
    expect(notificationSupport()).toBe('default');
  });
});

describe('showReminderNotification', () => {
  const slot = { meal: 'lunch' as const, at: new Date(), key: '2026-10-27:lunch' };

  it('does nothing without permission', async () => {
    stubNotification('default');
    expect(await showReminderNotification(slot)).toBe(false);
  });

  it('prefers the service worker registration and tags by slot', async () => {
    stubNotification('granted');
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ showNotification }) },
    });
    expect(await showReminderNotification(slot)).toBe(true);
    expect(showNotification).toHaveBeenCalledWith(
      'Log your lunch',
      expect.objectContaining({ tag: '2026-10-27:lunch', data: { path: '/log?meal=lunch' } }),
    );
  });

  it('falls back to a page notification when there is no worker', async () => {
    const ctor = stubNotification('granted');
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: undefined });
    expect(await showReminderNotification(slot)).toBe(true);
    expect(ctor).toHaveBeenCalledWith('Log your lunch', expect.objectContaining({ tag: slot.key }));
  });
});
