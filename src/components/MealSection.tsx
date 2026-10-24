import { useEffect, useMemo } from 'react';
import Icon, { type IconName } from './Icon';
import { Link } from 'react-router-dom';
import type { FoodEntry, MealType } from '../db/types';
import { MEAL_LABELS } from '../lib/meals';

interface Props {
  meal: MealType;
  dayKey: string;
  entries: FoodEntry[];
}

const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: 'sun',
  lunch: 'bowl',
  dinner: 'moon',
  snack: 'heart',
};

export default function MealSection({ meal, dayKey, entries }: Props) {
  const kcal = Math.round(entries.reduce((s, e) => s + e.totals.kcal, 0));
  return (
    <section className="meal-section" aria-labelledby={`meal-${meal}`}>
      <header className="meal-header">
        <div className="flex items-center gap-3">
          <span className={`meal-icon meal-icon-${meal}`}>
            <Icon name={MEAL_ICONS[meal]} size={20} />
          </span>
          <div>
            <h3 id={`meal-${meal}`} className="font-semibold">
              {MEAL_LABELS[meal]}
            </h3>
            <p className="meal-caption">
              {entries.length
                ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
                : 'Ready when you are'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {kcal > 0 && <span className="text-sm tabular-nums text-gray-500">{kcal} kcal</span>}
          <Link
            to={`/log?meal=${meal}&day=${dayKey}`}
            className="meal-add"
            aria-label={`Add to ${MEAL_LABELS[meal]}`}
          >
            <Icon name="plus" size={18} />
          </Link>
        </div>
      </header>
      {entries.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                to={`/entry/${e.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
              >
                {e.photoThumb && <Thumb blob={e.photoThumb} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{summarize(e)}</p>
                  <p className="truncate text-xs text-gray-500">
                    P {Math.round(e.totals.proteinG)} · C {Math.round(e.totals.carbsG)} · F{' '}
                    {Math.round(e.totals.fatG)} · Fb {Math.round(e.totals.fiberG ?? 0)}
                  </p>
                </div>
                <span className="tabular-nums text-sm font-semibold">
                  {Math.round(e.totals.kcal)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function summarize(e: FoodEntry): string {
  if (e.items.length === 0) return e.note || 'Empty entry';
  return e.items
    .map((i) => (i.quantity !== 1 ? `${trim(i.quantity)}× ${i.name}` : i.name))
    .join(', ');
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Thumb({ blob }: { blob: Blob }) {
  // One object URL per blob, released when the blob changes or the row unmounts.
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="h-10 w-10 flex-none rounded-lg object-cover" />;
}
