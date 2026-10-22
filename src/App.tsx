import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
import Home from './routes/Home';
import Log from './routes/Log';
import History from './routes/History';
import Settings from './routes/Settings';

function Shell() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-24" style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/log" element={<Log />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
