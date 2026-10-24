import type { Macros } from '../db/types';
import { periodSummary, type DayNutrition } from '../nutrition/insights';
import { fiberOf } from '../nutrition/totals';

interface Props {
  days: DayNutrition[];
  target: Macros;
}

/** Averages against targets and how often each goal was hit over the selected range. */
export default function NutrientSummary({ days, target }: Props) {
  const s = periodSummary(days, target);
  if (s.loggedDays === 0) {
    return (
      <p className="text-sm text-gray-500">
        Nothing logged in the last {s.totalDays} days yet. Averages show up once you log a meal.
      </p>
    );
  }
  const fiberTarget = fiberOf(target);
  const rows: { label: string; avg: number; target: number; unit: string; hit?: number }[] = [
    { label: 'Calories', avg: s.avg.kcal, target: target.kcal, unit: 'kcal', hit: s.hit.kcal },
    {
      label: 'Protein',
      avg: s.avg.protein,
      target: target.proteinG,
      unit: 'g',
      hit: s.hit.protein,
    },
    { label: 'Carbs', avg: s.avg.carbs, target: target.carbsG, unit: 'g' },
    { label: 'Fat', avg: s.avg.fat, target: target.fatG, unit: 'g' },
    { label: 'Fibre', avg: s.avg.fiber, target: fiberTarget, unit: 'g', hit: s.hit.fiber },
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        Averages over {s.loggedDays} logged {s.loggedDays === 1 ? 'day' : 'days'} of {s.totalDays}.
      </p>
      <table className="summary-table">
        <thead>
          <tr>
            <th scope="col">Nutrient</th>
            <th scope="col">Average</th>
            <th scope="col">Target</th>
            <th scope="col">Days hit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.target > 0 ? Math.round(r.avg - r.target) : 0;
            return (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>
                  {r.avg.toLocaleString()} {r.unit}
                  {r.target > 0 && diff !== 0 && (
                    <span className={diff > 0 ? 'diff-over' : 'diff-under'}>
                      {' '}
                      {diff > 0 ? '+' : ''}
                      {diff}
                    </span>
                  )}
                </td>
                <td>{r.target > 0 ? `${r.target.toLocaleString()} ${r.unit}` : '–'}</td>
                <td>{r.hit !== undefined && r.target > 0 ? `${r.hit} / ${s.loggedDays}` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {fiberTarget > 0 && s.fiberTrackedDays < s.loggedDays && (
        <p className="text-xs text-gray-500">
          Fibre was recorded on {s.fiberTrackedDays} of {s.loggedDays} logged days. Entries saved
          before fibre tracking count as 0 g and pull the average down.
        </p>
      )}
    </div>
  );
}
