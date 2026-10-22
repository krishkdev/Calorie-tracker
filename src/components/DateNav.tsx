import { addDays, formatDayKey, todayKey } from '../lib/dates';

interface Props {
  dayKey: string;
  onChange: (key: string) => void;
}

export default function DateNav({ dayKey, onChange }: Props) {
  const today = todayKey();
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className="btn btn-secondary h-10 min-h-0 w-10 px-0"
        aria-label="Previous day"
        onClick={() => onChange(addDays(dayKey, -1))}
      >
        ‹
      </button>
      <div className="flex flex-col items-center">
        <label className="relative cursor-pointer text-lg font-semibold">
          {formatDayKey(dayKey, today)}
          <input
            type="date"
            className="absolute inset-0 opacity-0"
            value={dayKey}
            max={today}
            aria-label="Pick a date"
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
        </label>
        {dayKey !== today && (
          <button
            type="button"
            className="text-xs font-medium text-brand-600"
            onClick={() => onChange(today)}
          >
            Back to today
          </button>
        )}
      </div>
      <button
        type="button"
        className="btn btn-secondary h-10 min-h-0 w-10 px-0"
        aria-label="Next day"
        disabled={dayKey >= today}
        onClick={() => onChange(addDays(dayKey, 1))}
      >
        ›
      </button>
    </div>
  );
}
