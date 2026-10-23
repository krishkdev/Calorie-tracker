import Icon from '../components/Icon';
import NumberInput from '../components/NumberInput';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../db/hooks';
import { saveProfile, updateSettings } from '../db/repo';
import type { Activity, GoalType, Sex, Units } from '../db/types';
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
  computeTargets,
  isPlausibleBody,
} from '../nutrition/tdee';
import { cmToFtIn, ftInToCm, lbToKg, kgToLb } from '../nutrition/units';

const RATES: { value: number; label: string }[] = [
  { value: 0.25, label: 'Slow · 0.25 kg / 0.5 lb a week' },
  { value: 0.5, label: 'Steady · 0.5 kg / 1 lb a week' },
  { value: 0.75, label: 'Fast · 0.75 kg / 1.5 lb a week' },
  { value: 1, label: 'Aggressive · 1 kg / 2 lb a week' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<Units>(settings.units);
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState(30);
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(75);
  const [activity, setActivity] = useState<Activity>('light');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [rate, setRate] = useState(0.5);
  const [saving, setSaving] = useState(false);

  const result = useMemo(
    () =>
      computeTargets({
        sex,
        age,
        heightCm,
        weightKg,
        activity,
        goal,
        rateKgPerWeek: goal === 'maintain' ? 0 : rate,
      }),
    [sex, age, heightCm, weightKg, activity, goal, rate],
  );

  const bodyValid = isPlausibleBody({ age, heightCm, weightKg });

  async function finish() {
    setSaving(true);
    try {
      await updateSettings({ units });
      await saveProfile({
        age,
        sex,
        heightCm,
        weightKg,
        activity,
        goal,
        rateKgPerWeek: goal === 'maintain' ? 0 : rate,
        targets: result.targets,
        targetsOverridden: false,
        onboardedAt: Date.now(),
      });
      navigate('/home', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="app-brand onboarding-brand">
        <span className="brand-mark">
          <Icon name="leaf" />
        </span>
        Calorie<span className="brand-period">.</span>
      </div>
      <div className="onboarding-progress" role="group" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((s) => (
          <span key={s} className={s <= step ? 'is-done' : ''} />
        ))}
      </div>
      <header className="mb-8">
        <p className="eyebrow">LET’S MAKE THIS PERSONAL · {step + 1} / 3</p>
        <h1 className="mt-1 text-2xl font-bold">
          {step === 0 && 'About you'}
          {step === 1 && 'How active are you?'}
          {step === 2 && 'Your goal'}
        </h1>
        {step === 0 && (
          <p className="mt-1 text-sm text-gray-500">
            Used only to estimate your daily calorie needs. Everything stays on this device.
          </p>
        )}
      </header>

      {step === 0 && (
        <div className="space-y-4">
          <Segmented
            label="Units"
            value={units}
            options={[
              { value: 'metric', label: 'kg · cm' },
              { value: 'imperial', label: 'lb · ft' },
            ]}
            onChange={setUnits}
          />
          <Segmented
            label="Sex (for the metabolism formula)"
            value={sex}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            onChange={setSex}
          />
          <label className="block">
            <span className="label">Age</span>
            <NumberInput
              inputMode="numeric"
              className="input"
              value={age}
              min={10}
              max={120}
              onChange={setAge}
            />
          </label>
          <HeightInput units={units} heightCm={heightCm} onChange={setHeightCm} />
          <WeightInput units={units} weightKg={weightKg} onChange={setWeightKg} />
        </div>
      )}

      {step === 1 && (
        <ul className="space-y-2">
          {(Object.keys(ACTIVITY_MULTIPLIERS) as Activity[]).map((a) => (
            <li key={a}>
              <button
                type="button"
                className={`card w-full text-left ${activity === a ? 'ring-2 ring-brand-500' : ''}`}
                aria-pressed={activity === a}
                onClick={() => setActivity(a)}
              >
                <p className="font-semibold">{ACTIVITY_LABELS[a].label}</p>
                <p className="text-sm text-gray-500">{ACTIVITY_LABELS[a].hint}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Segmented
            label="I want to"
            value={goal}
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
            onChange={setGoal}
          />
          {goal !== 'maintain' && (
            <label className="block">
              <span className="label">Pace</span>
              <select
                className="input"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              >
                {RATES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="card">
            <p className="text-sm text-gray-500">Your daily target</p>
            <p className="text-3xl font-bold tabular-nums">{result.targets.kcal} kcal</p>
            <p className="mt-1 text-sm text-gray-500">
              Protein {result.targets.proteinG} g · Carbs {result.targets.carbsG} g · Fat{' '}
              {result.targets.fatG} g
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Maintenance is about {result.tdee} kcal (BMR {result.bmr}). You can change all of this
              later in Settings.
            </p>
            {result.clamped && (
              <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                That pace would go below a safe minimum, so the target was raised to{' '}
                {result.targets.kcal} kcal. Consider a slower pace.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="privacy-footnote mt-6">
        <Icon name="shield" size={13} />
        No account needed. Your profile stays on this device.
      </p>
      <div className="mt-auto flex gap-2 pt-6">
        {step > 0 && (
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>
        )}
        {step < 2 ? (
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={step === 0 && !bodyValid}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={saving}
            onClick={() => void finish()}
          >
            {saving ? 'Saving…' : 'Start tracking'}
          </button>
        )}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div
        className="segmented-control grid gap-1 rounded-2xl p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`rounded-lg py-2 text-sm font-medium transition ${
              value === o.value ? 'segmented-selected' : 'text-gray-600 dark:text-gray-300'
            }`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HeightInput({
  units,
  heightCm,
  onChange,
}: {
  units: Units;
  heightCm: number;
  onChange: (cm: number) => void;
}) {
  if (units === 'imperial') {
    const { ft, in: inches } = cmToFtIn(heightCm);
    return (
      <div>
        <span className="label">Height</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <NumberInput
              inputMode="numeric"
              className="input"
              value={ft}
              min={3}
              max={8}
              aria-label="Feet"
              onChange={(v) => onChange(ftInToCm(v, inches))}
            />
            <span className="text-xs text-gray-500">ft</span>
          </label>
          <label className="block">
            <NumberInput
              inputMode="numeric"
              className="input"
              value={inches}
              min={0}
              max={11}
              aria-label="Inches"
              onChange={(v) => onChange(ftInToCm(ft, v))}
            />
            <span className="text-xs text-gray-500">in</span>
          </label>
        </div>
      </div>
    );
  }
  return (
    <label className="block">
      <span className="label">Height (cm)</span>
      <NumberInput
        inputMode="numeric"
        className="input"
        value={Math.round(heightCm)}
        min={100}
        max={250}
        onChange={onChange}
      />
    </label>
  );
}

export function WeightInput({
  units,
  weightKg,
  onChange,
}: {
  units: Units;
  weightKg: number;
  onChange: (kg: number) => void;
}) {
  const imperial = units === 'imperial';
  const shown = imperial ? Math.round(kgToLb(weightKg) * 10) / 10 : Math.round(weightKg * 10) / 10;
  return (
    <label className="block">
      <span className="label">Weight ({imperial ? 'lb' : 'kg'})</span>
      <NumberInput
        inputMode="decimal"
        step="0.1"
        min={0}
        className="input"
        value={shown}
        onChange={(v) => onChange(imperial ? lbToKg(v) : v)}
      />
    </label>
  );
}
