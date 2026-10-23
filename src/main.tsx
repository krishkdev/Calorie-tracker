import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyStoredTheme } from './lib/theme';

applyStoredTheme();

// Ask the browser not to evict our IndexedDB under storage pressure (iOS Safari
// may otherwise wipe data from sites not used for a week). Best effort.
void navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
