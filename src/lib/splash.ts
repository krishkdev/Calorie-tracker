/**
 * The splash screen lives in index.html so it paints before any JavaScript
 * loads. The app removes it once it knows what to draw (profile and settings
 * read from IndexedDB), so the first real frame is never a blank page.
 */

const MIN_VISIBLE_MS = 450; // long enough to never flicker on a warm start
const FADE_MS = 300;

let hidden = false;

export function hideSplash(): void {
  if (hidden) return;
  hidden = true;
  const el = typeof document !== 'undefined' ? document.getElementById('splash') : null;
  if (!el) return;
  const shownFor = performance.now();
  const wait = Math.max(0, MIN_VISIBLE_MS - shownFor);
  setTimeout(() => {
    el.classList.add('splash-hide');
    setTimeout(() => el.remove(), FADE_MS);
  }, wait);
}
