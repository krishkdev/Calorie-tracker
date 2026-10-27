/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

/**
 * Custom service worker. Precaching and runtime caching are the same as the
 * generated worker used before; what is added is handling taps on reminder
 * notifications, which only a service worker can do.
 */

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// The app shell answers every navigation (HashRouter), except API-looking paths.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
);

// Open Food Facts product lookups: network first, short cache so repeated
// scans work offline for a while.
registerRoute(
  /^https:\/\/world\.openfoodfacts\.org\/api\//,
  new NetworkFirst({
    cacheName: 'off-products',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  }),
);

// The in-app "A new version is ready" prompt asks us to take over.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Tapping a reminder focuses the app (or opens it) on the Log screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path =
    typeof event.notification.data?.path === 'string' ? event.notification.data.path : '/log';
  const target = new URL(`./#${path}`, self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => c.url.startsWith(self.registration.scope));
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
