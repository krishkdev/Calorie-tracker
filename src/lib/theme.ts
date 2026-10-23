export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'ct-theme';

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode); theme still applies for this page load.
  }
}

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

/** Called once at startup, before React renders, to avoid a flash of the wrong theme. */
export function applyStoredTheme(): void {
  const theme = getStoredTheme();
  applyTheme(theme);
  // Always listen: the user may switch to "System" later without a reload.
  if (typeof window !== 'undefined' && window.matchMedia) {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => applyTheme(getStoredTheme()));
  }
}
