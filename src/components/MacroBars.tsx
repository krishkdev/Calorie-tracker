import type { Macros } from '../db/types';
import Icon, { type IconName } from './Icon';

interface Props {
  consumed: Macros;
  target: Macros;
}
const rows: { key: 'proteinG' | 'carbsG' | 'fatG'; label: string; icon: IconName; tone: string }[] =
  [
    { key: 'proteinG', label: 'Protein', icon: 'protein', tone: 'protein' },
    { key: 'carbsG', label: 'Carbs', icon: 'carbs', tone: 'carbs' },
    { key: 'fatG', label: 'Fats', icon: 'fat', tone: 'fat' },
  ];

export default function MacroBars({ consumed, target }: Props) {
  return (
    <div className="macro-grid">
      {rows.map(({ key, label, icon, tone }) => {
        const eaten = Math.round(consumed[key]);
        const goal = Math.round(target[key]);
        const ratio = goal > 0 ? Math.min(1, eaten / goal) : 0;
        return (
          <div key={key} className={`macro-card macro-${tone}`}>
            <div className="macro-icon">
              <Icon name={icon} size={21} />
            </div>
            <p className="macro-value">
              {Math.max(0, goal - eaten)}
              <span>g</span>
            </p>
            <p className="macro-label">{label} left</p>
            <div
              className="macro-track"
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={Math.max(goal, eaten)}
              aria-valuenow={eaten}
              aria-valuetext={`${eaten} of ${goal} grams eaten`}
            >
              <div style={{ width: `${ratio * 100}%` }} />
            </div>
            <p className="macro-detail">
              {eaten} / {goal} g
            </p>
          </div>
        );
      })}
    </div>
  );
}
