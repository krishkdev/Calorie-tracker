import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyStoredTheme } from './lib/theme';
import { hideSplash } from './lib/splash';

applyStoredTheme();

// Ask the browser not to evict our IndexedDB under storage pressure (iOS Safari
// may otherwise wipe data from sites not used for a week). Best effort.
void navigator.storage?.persist?.().catch(() => undefined);

// Whatever happens (a database that will not open, a script that throws),
// nobody should be left staring at the splash screen.
setTimeout(hideSplash, 6000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
