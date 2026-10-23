import { HashRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
import ErrorBoundary from './components/ErrorBoundary';
import Icon from './components/Icon';
import { useProfile } from './db/hooks';
import Home from './routes/Home';
import Log from './routes/Log';
import { lazy, Suspense } from 'react';

// Charts pull in Recharts; keep them out of the initial bundle.
const History = lazy(() => import('./routes/History'));
import Settings from './routes/Settings';
import Onboarding from './routes/Onboarding';
import ReviewEntry from './routes/ReviewEntry';
import LogText from './routes/LogText';
import LogPhoto from './routes/LogPhoto';
import LogBarcode from './routes/LogBarcode';

function Shell() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <header className="app-header">
          <Link to="/home" className="app-brand" aria-label="Calorie home">
            <span className="brand-mark">
              <Icon name="leaf" />
            </span>
            Calorie<span className="brand-period">.</span>
          </Link>
          <Link to="/settings" className="local-badge">
            <Icon name="shield" size={14} />
            <span>Stored on your device</span>
          </Link>
        </header>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

/** Sends new users through onboarding before anything else. */
function RequireProfile() {
  const profile = useProfile();
  if (profile === undefined) return null; // loading
  if (profile === null) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<RequireProfile />}>
            <Route element={<Shell />}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/log" element={<Log />} />
              <Route path="/log/text" element={<LogText />} />
              <Route path="/log/photo" element={<LogPhoto />} />
              <Route path="/log/barcode" element={<LogBarcode />} />
              <Route path="/entry/new" element={<ReviewEntry />} />
              <Route path="/entry/:id" element={<ReviewEntry />} />
              <Route
                path="/history"
                element={
                  <Suspense fallback={<p className="text-sm text-gray-500">Loading charts…</p>}>
                    <History />
                  </Suspense>
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>
          </Route>
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}
