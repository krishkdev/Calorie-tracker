import { addDays, formatDayKey, todayKey } from '../lib/dates';
import Icon from './Icon';

interface Props {
  dayKey: string;
  onChange: (key: string) => void;
}

export default function DateNav({ dayKey, onChange }: Props) {
  const today = todayKey();
  const date = new Date(`${dayKey}T12:00:00`);
  // Monday-start week, anchored to the selected date so every day remains reachable.
  const start = addDays(dayKey, -((date.getDay() + 6) % 7));
  return (
    <section className="date-nav" aria-label="Food log date">
      <div className="date-heading">
        <div>
          <h1>{formatDayKey(dayKey, today)}</h1>
          <label className="date-picker">
            {date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            <Icon name="chevron" size={12} />
            <input
              type="date"
              value={dayKey}
              max={today}
              aria-label="Pick a date"
              onChange={(e) => e.target.value && onChange(e.target.value)}
            />
          </label>
        </div>
        <div className="date-actions">
          {dayKey !== today && (
            <button type="button" className="today-button" onClick={() => onChange(today)}>
              Today
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Previous day"
            onClick={() => onChange(addDays(dayKey, -1))}
          >
            <Icon name="chevron" size={17} className="rotate-180" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next day"
            disabled={dayKey >= today}
            onClick={() => onChange(addDays(dayKey, 1))}
          >
            <Icon name="chevron" size={17} />
          </button>
        </div>
      </div>
      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const key = addDays(start, i);
          const d = new Date(`${key}T12:00:00`);
          return (
            <button
              type="button"
              key={key}
              disabled={key > today}
              className={`week-day ${key === dayKey ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}`}
              aria-label={d.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              aria-pressed={key === dayKey}
              onClick={() => onChange(key)}
            >
              <span>{d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)}</span>
              <strong>{d.getDate()}</strong>
              <i />
            </button>
          );
        })}
      </div>
    </section>
  );
}
