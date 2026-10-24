import type { Macros } from '../db/types';
import { fiberOf } from '../nutrition/totals';
import Icon, { type IconName } from './Icon';

interface Props {
  consumed: Macros;
  target: Macros;
}
type Key = 'proteinG' | 'carbsG' | 'fatG' | 'fiberG';
const rows: { key: Key; label: string; icon: IconName; tone: string }[] = [
  { key: 'proteinG', label: 'Protein', icon: 'protein', tone: 'protein' },
  { key: 'carbsG', label: 'Carbs', icon: 'carbs', tone: 'carbs' },
  { key: 'fatG', label: 'Fats', icon: 'fat', tone: 'fat' },
  { key: 'fiberG', label: 'Fibre', icon: 'fiber', tone: 'fiber' },
];

function grams(m: Macros, key: Key): number {
  return Math.round(key === 'fiberG' ? fiberOf(m) : m[key]);
}

export default function MacroBars({ consumed, target }: Props) {
  return (
    <div className="macro-grid">
      {rows.map(({ key, label, icon, tone }) => {
        const eaten = grams(consumed, key);
        const goal = grams(target, key);
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
