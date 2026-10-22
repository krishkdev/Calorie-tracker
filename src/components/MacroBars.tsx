import type { Macros } from '../db/types';

interface Props {
  consumed: Macros;
  target: Macros;
}

const rows = [
  { key: 'proteinG', label: 'Protein', color: 'bg-protein' },
  { key: 'carbsG', label: 'Carbs', color: 'bg-carbs' },
  { key: 'fatG', label: 'Fat', color: 'bg-fat' },
] as const;

export default function MacroBars({ consumed, target }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map(({ key, label, color }) => {
        const eaten = Math.round(consumed[key]);
        const goal = Math.round(target[key]);
        const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 0;
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{label}</span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400">
                {eaten}/{goal} g
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={goal}
              aria-valuenow={eaten}
            >
              <div
                className={`h-full rounded-full ${color} transition-[width] duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
