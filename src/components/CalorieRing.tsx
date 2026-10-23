import Icon from './Icon';

interface Props {
  consumed: number;
  target: number;
}

export default function CalorieRing({ consumed, target }: Props) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  const remaining = Math.round(target - consumed);

  return (
    <div className="calorie-summary" aria-live="polite">
      <div>
        <p className="eyebrow">DAILY ENERGY</p>
        <p className="calorie-value">{Math.abs(remaining).toLocaleString()}</p>
        <p className="calorie-label">Calories {over ? 'over target' : 'left'}</p>
        <p className="calorie-detail">
          <strong>{Math.round(consumed).toLocaleString()}</strong> of {Math.round(target)} kcal
          eaten
        </p>
      </div>
      <div className={`energy-ring ${over ? 'is-over' : ''}`}>
        <svg viewBox="0 0 112 112" className="ring-svg" aria-hidden="true">
          <circle cx="56" cy="56" r={r} fill="none" strokeWidth="9" className="ring-track" />
          <circle
            cx="56"
            cy="56"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className="ring-fill"
          />
        </svg>
        <Icon name="flame" size={35} />
      </div>
    </div>
  );
}
