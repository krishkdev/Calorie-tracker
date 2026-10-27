import { Link } from 'react-router-dom';
import Icon from './Icon';
import { reminderCopy, reminderPath } from '../lib/reminders';
import { useReminders } from '../notifications/useReminders';

/** In-app reminder shown when a meal time passes while the app is on screen. */
export default function ReminderBanner() {
  const { banner, dismiss } = useReminders();
  if (!banner) return null;
  const copy = reminderCopy(banner.meal);
  return (
    <div className="update-toast reminder-toast" role="status">
      <span className="reminder-icon">
        <Icon name="bowl" size={18} />
      </span>
      <span>
        <strong>{copy.title}</strong>
        <small>{copy.body}</small>
      </span>
      <Link to={reminderPath(banner.meal)} className="btn btn-primary" onClick={dismiss}>
        Log
      </Link>
      <button type="button" className="update-later" onClick={dismiss} aria-label="Dismiss">
        Later
      </button>
    </div>
  );
}
