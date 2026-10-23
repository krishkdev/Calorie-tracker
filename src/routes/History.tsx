import { useState } from 'react';
import CaloriesChart from '../components/charts/CaloriesChart';
import WeightChart from '../components/charts/WeightChart';
import {
  useDailyCalories,
  useLatestWeight,
  useProfile,
  useSettings,
  useWeights,
} from '../db/hooks';
import { deleteWeight, updateProfile, upsertWeight } from '../db/repo';
import { formatDayKey, safeDayKey, todayKey } from '../lib/dates';
import { computeTargets } from '../nutrition/tdee';
import { displayWeight, formatWeight, parseWeightInput, weightUnitLabel } from '../nutrition/units';

type Range = 7 | 30 | 90;

export default function History() {
  const settings = useSettings();
  const profile = useProfile();
  const [range, setRange] = useState<Range>(30);
  const days = useDailyCalories(range) ?? [];
  const weights = useWeights(range) ?? [];
  const latest = useLatestWeight();
  const unit = weightUnitLabel(settings.units);

  const [weightInput, setWeightInput] = useState('');
  const [dayKey, setDayKey] = useState(todayKey);
  const [saving, setSaving] = useState(false);

  async function saveWeight() {
    const v = Number(weightInput);
    if (!Number.isFinite(v) || v <= 0 || saving) return;
    setSaving(true);
    try {
      const kg = Math.round(parseWeightInput(v, settings.units) * 100) / 100;
      await upsertWeight(dayKey, kg);
      setWeightInput('');
      if (profile && dayKey === todayKey() && Math.abs(profile.weightKg - kg) >= 0.1) {
        const recompute = !profile.targetsOverridden;
        const question = recompute
          ? `Update your profile weight to ${formatWeight(kg, settings.units)} and recompute your daily targets?`
          : `Update your profile weight to ${formatWeight(kg, settings.units)}? (Your hand-edited targets stay as they are.)`;
        if (confirm(question)) {
          const next = { ...profile, weightKg: kg };
          await updateProfile(
            recompute ? { weightKg: kg, targets: computeTargets(next).targets } : { weightKg: kg },
          );
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="screen-heading !mb-0">
          <h1>Your progress.</h1>
          <p>The small things add up.</p>
        </div>
        <div
          className="flex gap-1 rounded-xl bg-gray-200 p-1 dark:bg-gray-800"
          role="radiogroup"
          aria-label="Range"
        >
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              className={`rounded-lg px-3 py-1 text-sm font-medium ${range === r ? 'bg-white shadow dark:bg-gray-900' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={() => setRange(r)}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <section className="card" aria-labelledby="calories-heading">
        <h2 id="calories-heading" className="mb-2 font-semibold">
          Calories
        </h2>
        <CaloriesChart days={days} target={profile?.targets.kcal ?? 0} />
      </section>

      <section className="card space-y-3" aria-labelledby="weight-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="weight-heading" className="font-semibold">
            Weight
          </h2>
          {latest && (
            <span className="text-sm text-gray-500">
              Latest {formatWeight(latest.weightKg, settings.units)} · {formatDayKey(latest.dayKey)}
            </span>
          )}
        </div>
        <WeightChart weights={weights} units={settings.units} />
        <form
          className="weight-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveWeight();
          }}
        >
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className="input"
            placeholder={`Weight in ${unit}`}
            aria-label={`Weight in ${unit}`}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <input
            type="date"
            className="input w-40"
            value={dayKey}
            max={todayKey()}
            aria-label="Date"
            onChange={(e) => e.target.value && setDayKey(safeDayKey(e.target.value))}
          />
          <button type="submit" className="btn btn-primary px-4" disabled={!weightInput || saving}>
            Log
          </button>
        </form>
        {weights.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500">
              All entries in range ({weights.length})
            </summary>
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              {[...weights].reverse().map((w) => (
                <li key={w.id} className="flex items-center justify-between py-1.5">
                  <span>{formatDayKey(w.dayKey)}</span>
                  <span className="tabular-nums">
                    {displayWeight(w.weightKg, settings.units)} {unit}
                  </span>
                  <button
                    type="button"
                    className="-mr-2 min-h-11 px-2 text-xs text-red-600"
                    onClick={() => void deleteWeight(w.id)}
                    aria-label={`Delete weight for ${w.dayKey}`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
