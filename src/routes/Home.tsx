import { useState } from 'react';
import { Link } from 'react-router-dom';
import CalorieRing from '../components/CalorieRing';
import DateNav from '../components/DateNav';
import MacroBars from '../components/MacroBars';
import MealSection from '../components/MealSection';
import { MEAL_ORDER } from '../lib/meals';
import { useDayEntries, useProfile } from '../db/hooks';
import { todayKey } from '../lib/dates';
import { sumMacros, ZERO_MACROS } from '../nutrition/totals';

export default function Home() {
  const [dayKey, setDayKey] = useState(todayKey);
  const profile = useProfile();
  const entries = useDayEntries(dayKey) ?? [];
  const consumed = entries.length ? sumMacros(entries.map((e) => e.totals)) : ZERO_MACROS;
  const target = profile?.targets ?? ZERO_MACROS;

  return (
    <div className="space-y-4">
      <DateNav dayKey={dayKey} onChange={setDayKey} />

      <div className="card">
        <CalorieRing consumed={consumed.kcal} target={target.kcal} />
        <div className="mt-5">
          <MacroBars consumed={consumed} target={target} />
        </div>
      </div>

      {entries.length === 0 && (
        <p className="px-1 text-center text-sm text-gray-500">
          Nothing logged yet.{' '}
          <Link to={`/log?day=${dayKey}`} className="font-medium text-brand-600">
            Log your first meal
          </Link>
          .
        </p>
      )}

      {MEAL_ORDER.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          dayKey={dayKey}
          entries={entries.filter((e) => e.meal === meal)}
        />
      ))}
    </div>
  );
}
