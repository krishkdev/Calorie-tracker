import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Checks for a new build whenever the app comes back to the foreground (and
 * hourly while open) and offers a reload. Installed PWAs rarely reload on
 * their own, so without this a phone could run a stale build for weeks.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => undefined);
        }
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', check);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="update-toast" role="status">
      <span>A new version is ready.</span>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </button>
      <button type="button" className="update-later" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  );
}
