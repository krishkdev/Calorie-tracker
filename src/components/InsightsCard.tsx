import { useEffect, useState } from 'react';
import type { Macros } from '../db/types';
import type { MealCutoffs } from '../lib/dates';
import { dayInsights, dayNudge, type Insight } from '../nutrition/insights';
import Icon, { type IconName } from './Icon';

interface Props {
  consumed: Macros;
  target: Macros;
  entryCount: number;
  isToday: boolean;
  cutoffs: MealCutoffs;
}

const TONE_ICON: Record<Insight['tone'], IconName> = {
  good: 'shield',
  warn: 'flame',
  info: 'spark',
};

/** Current hour, refreshed each minute so a nudge appears without a reload. */
function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return hour;
}

/** Plain-language takeaways for the day, plus a time-of-day nudge while the day is in progress. */
export default function InsightsCard({ consumed, target, entryCount, isToday, cutoffs }: Props) {
  const hour = useHour();
  const nudge = isToday ? dayNudge({ consumed, target, hour, cutoffs }) : null;
  const insights = dayInsights({ consumed, target, entryCount, isToday });
  if (!nudge && insights.length === 0) return null;

  return (
    <section className="card insights-card" aria-labelledby="insights-title">
      <p id="insights-title" className="eyebrow">
        {isToday ? "TODAY'S INSIGHTS" : 'INSIGHTS'}
      </p>
      {nudge && (
        <p className={`insight-nudge tone-${nudge.tone}`} role="status">
          <Icon name="spark" size={16} />
          <span>{nudge.text}</span>
        </p>
      )}
      {insights.length > 0 && (
        <ul className="insight-list">
          {insights.map((i) => (
            <li key={i.id} className={`tone-${i.tone}`}>
              <Icon name={TONE_ICON[i.tone]} size={14} />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
