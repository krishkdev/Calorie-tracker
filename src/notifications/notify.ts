import type { ReminderSlot } from '../lib/reminders';
import { reminderCopy, reminderPath } from '../lib/reminders';

/**
 * Thin wrapper over the Notifications API. There is no server behind the app,
 * so every notification is created on the device by the running app: reminders
 * work while the app is open, or installed and alive in the background. They
 * cannot be delivered when the app has been fully closed.
 */

export type NotificationSupport =
  /** No Notification API at all (very old browsers, some webviews). */
  | 'unsupported'
  /** iOS Safari: notifications exist only once the app is added to the Home Screen. */
  | 'needs-install'
  | 'denied'
  | 'granted'
  /** Supported, not asked yet. */
  | 'default';

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; the touch check tells them apart.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

export function notificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  const permission = Notification.permission;
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'default';
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  const support = notificationSupport();
  if (support !== 'default') return support;
  try {
    // Older Safari only supports the callback form.
    const result = await new Promise<NotificationPermission>((resolve) => {
      const maybe = Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === 'function') void maybe.then(resolve);
    });
    return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default';
  } catch {
    return 'unsupported';
  }
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

interface ReminderNotification {
  title: string;
  body: string;
  tag: string;
  path: string;
}

function build(slot: ReminderSlot): ReminderNotification {
  const copy = reminderCopy(slot.meal);
  return { title: copy.title, body: copy.body, tag: slot.key, path: reminderPath(slot.meal) };
}

/**
 * Shows a system notification. Prefers the service worker registration (the
 * only way that works on Android Chrome, and the one that survives the page
 * going away); falls back to a page-owned notification elsewhere. Returns
 * false when nothing could be shown, so the caller can fall back to in-app UI.
 */
export async function showReminderNotification(slot: ReminderSlot): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false;
  const n = build(slot);
  const options: NotificationOptions & { renotify?: boolean } = {
    body: n.body,
    tag: n.tag,
    icon: assetUrl('icons/icon-192.png'),
    badge: assetUrl('icons/icon-192.png'),
    data: { path: n.path },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(n.title, options);
      return true;
    }
  } catch {
    // fall through to a page notification
  }
  try {
    const note = new Notification(n.title, options);
    note.onclick = () => {
      window.focus();
      window.location.hash = `#${n.path}`;
      note.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** A one-off "it works" notification from the Settings screen. */
export function showTestNotification(): Promise<boolean> {
  return showReminderNotification({
    meal: 'lunch',
    at: new Date(),
    key: `test:${Date.now()}`,
  });
}
