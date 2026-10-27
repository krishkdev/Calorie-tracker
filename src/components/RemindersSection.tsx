import { useEffect, useState } from 'react';
import { useSettings } from '../db/hooks';
import { updateSettings } from '../db/repo';
import type { ReminderMeal, ReminderSettings } from '../db/types';
import { MEAL_LABELS } from '../lib/meals';
import { REMINDER_MEALS } from '../lib/reminders';
import {
  isIOS,
  isStandalone,
  notificationSupport,
  requestNotificationPermission,
  showTestNotification,
  type NotificationSupport,
} from '../notifications/notify';

const FALLBACK_TIME: Record<ReminderMeal, string> = {
  breakfast: '09:00',
  lunch: '13:00',
  dinner: '19:30',
};

/** Settings card for "remind me to log food" notifications. */
export default function RemindersSection() {
  const { reminders } = useSettings();
  const [support, setSupport] = useState<NotificationSupport>(() => notificationSupport());
  const [message, setMessage] = useState<string | null>(null);

  // Permission can change outside the app (site settings); refresh when we come back.
  useEffect(() => {
    const refresh = () => setSupport(notificationSupport());
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  function save(patch: Partial<ReminderSettings>) {
    void updateSettings({ reminders: { ...reminders, ...patch } });
  }

  async function toggle(enabled: boolean) {
    setMessage(null);
    if (!enabled) {
      save({ enabled: false });
      return;
    }
    const result = await requestNotificationPermission();
    setSupport(result);
    if (result === 'granted') {
      save({ enabled: true });
      return;
    }
    // Still useful without permission: reminders show inside the app while it is open.
    save({ enabled: true });
    setMessage(
      result === 'denied'
        ? 'Notifications are blocked for this site. Reminders will still appear inside the app while it is open. To get them on your lock screen, allow notifications in your browser’s site settings.'
        : result === 'needs-install'
          ? 'On iPhone and iPad, notifications only work once the app is added to the Home Screen (Share → Add to Home Screen). Until then, reminders appear inside the app.'
          : 'This browser cannot show notifications. Reminders will still appear inside the app while it is open.',
    );
  }

  async function test() {
    setMessage(null);
    const ok = await showTestNotification();
    setMessage(
      ok
        ? 'Sent. If nothing appeared, check Do Not Disturb and the site’s notification settings.'
        : 'Could not show a notification. Allow notifications for this site first.',
    );
  }

  function setMealEnabled(meal: ReminderMeal, on: boolean) {
    save({ times: { ...reminders.times, [meal]: on ? FALLBACK_TIME[meal] : '' } });
  }

  function setMealTime(meal: ReminderMeal, value: string) {
    if (!value) return; // clearing the field is handled by the checkbox
    save({ times: { ...reminders.times, [meal]: value } });
  }

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        A nudge at meal times so nothing slips through. Reminders are created on this device while
        the app is open or installed and running in the background; nothing is sent from a server.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={reminders.enabled}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Remind me to log food
      </label>

      {reminders.enabled && (
        <div className="space-y-3">
          <div className="reminder-times">
            {REMINDER_MEALS.map((meal) => {
              const on = reminders.times[meal] !== '';
              return (
                <div key={meal} className="reminder-row">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setMealEnabled(meal, e.target.checked)}
                    />
                    {MEAL_LABELS[meal]}
                  </label>
                  <input
                    type="time"
                    className="input reminder-time"
                    aria-label={`${MEAL_LABELS[meal]} reminder time`}
                    value={on ? reminders.times[meal] : FALLBACK_TIME[meal]}
                    disabled={!on}
                    onChange={(e) => setMealTime(meal, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reminders.skipIfLogged}
              onChange={(e) => save({ skipIfLogged: e.target.checked })}
            />
            Skip the reminder when that meal is already logged
          </label>
          <SupportNote support={support} />
          {support === 'granted' && (
            <button type="button" className="btn btn-secondary w-full" onClick={() => void test()}>
              Send a test notification
            </button>
          )}
        </div>
      )}
      {message && (
        <p className="text-xs text-gray-600 dark:text-gray-400" role="status">
          {message}
        </p>
      )}
    </>
  );
}

function SupportNote({ support }: { support: NotificationSupport }) {
  const cls = 'text-xs text-gray-500 dark:text-gray-400';
  if (support === 'granted') {
    return (
      <p className={cls}>
        {isStandalone()
          ? 'Notifications are on. Keep the app installed so reminders can reach your lock screen.'
          : isIOS()
            ? 'Notifications are on.'
            : 'Notifications are on. Add the app to your home screen so reminders can arrive while it is in the background.'}
      </p>
    );
  }
  if (support === 'needs-install') {
    return (
      <p className={cls}>
        On iPhone and iPad, add the app to your Home Screen (Share → Add to Home Screen) to receive
        notifications. Until then, reminders show inside the app.
      </p>
    );
  }
  if (support === 'denied') {
    return (
      <p className={cls}>
        Notifications are blocked for this site, so reminders only show inside the app. Allow them
        in your browser’s site settings to get them on your lock screen.
      </p>
    );
  }
  if (support === 'unsupported') {
    return (
      <p className={cls}>This browser cannot show notifications; reminders show in the app.</p>
    );
  }
  return null;
}
