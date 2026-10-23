import { NavLink } from 'react-router-dom';
import Icon, { type IconName } from './Icon';

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/history', label: 'Progress', icon: 'chart' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/log', label: 'Log food', icon: 'plus' },
];

export default function TabBar() {
  return (
    <nav aria-label="Main" className="app-nav">
      <div className="nav-brand">
        <span className="brand-mark">
          <Icon name="leaf" />
        </span>
        Calorie<span className="brand-period">.</span>
      </div>
      <ul>
        {tabs.map(({ to, label, icon }) => (
          <li key={to} className={to === '/log' ? 'nav-log' : ''}>
            <NavLink
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="nav-note">
        <Icon name="shield" size={18} />
        <p>
          Your health.
          <br />
          Your device. Your rules.
        </p>
      </div>
    </nav>
  );
}
