import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProviderForm from '../components/ProviderForm';
import { useProfile, useSettings } from '../db/hooks';
import { clearAllData, updateProfile, updateSettings } from '../db/repo';
import type { Activity, GoalType, Macros, Profile, Sex, ThemeSetting, Units } from '../db/types';
import { applyTheme } from '../lib/theme';
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
  computeTargets,
  macrosFromPercents,
  percentsFromMacros,
} from '../nutrition/tdee';
import { HeightInput, Segmented, WeightInput } from './Onboarding';

export default function Settings() {
  const settings = useSettings();
  const profile = useProfile();
  const navigate = useNavigate();

  function setTheme(theme: ThemeSetting) {
    applyTheme(theme);
    void updateSettings({ theme });
  }

  async function resetAll() {
    if (
      !confirm(
        'Delete ALL data on this device (food log, weight, goals, API key)? This cannot be undone.',
      )
    )
      return;
    await clearAllData();
    navigate('/onboarding', { replace: true });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Section title="AI provider">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Bring your own key. The app talks to the provider directly from your browser; nothing
          passes through any server of ours.
        </p>
        <ProviderForm />
      </Section>

      <Section title="Appearance">
        <Segmented
          label="Units"
          value={settings.units}
          options={[
            { value: 'metric' as Units, label: 'kg · cm' },
            { value: 'imperial' as Units, label: 'lb · ft' },
          ]}
          onChange={(units) => void updateSettings({ units })}
        />
        <Segmented
          label="Theme"
          value={settings.theme}
          options={[
            { value: 'system' as ThemeSetting, label: 'System' },
            { value: 'light' as ThemeSetting, label: 'Light' },
            { value: 'dark' as ThemeSetting, label: 'Dark' },
          ]}
          onChange={setTheme}
        />
      </Section>

      {profile && <GoalsSection units={settings.units} />}

      <Section title="About">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calorie Tracker is free and open source (AGPL-3.0). Your data never leaves this device.
          Packaged food data comes from{' '}
          <a
            className="text-brand-600 underline"
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
          >
            Open Food Facts
          </a>{' '}
          (ODbL).
        </p>
        <p className="mt-2 text-xs text-gray-500">Version {__APP_VERSION__}</p>
      </Section>

      <Section title="Danger zone">
        <button type="button" className="btn btn-danger w-full" onClick={() => void resetAll()}>
          Delete all data on this device
        </button>
      </Section>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Waits for the profile, then mounts the form with it as initial state (remounts if reset). */
function GoalsSection({ units }: { units: Units }) {
  const profile = useProfile();
  if (!profile) return null;
  return <GoalsForm key={profile.onboardedAt} units={units} profile={profile} />;
}

function GoalsForm({ units, profile }: { units: Units; profile: Profile }) {
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [age, setAge] = useState(profile.age);
  const [heightCm, setHeightCm] = useState(profile.heightCm);
  const [weightKg, setWeightKg] = useState(profile.weightKg);
  const [activity, setActivity] = useState<Activity>(profile.activity);
  const [goal, setGoal] = useState<GoalType>(profile.goal);
  const [rate, setRate] = useState(profile.rateKgPerWeek || 0.5);
  const [targets, setTargets] = useState<Macros>(profile.targets);
  const [dirtyTargets, setDirtyTargets] = useState(profile.targetsOverridden);
  const [saved, setSaved] = useState(false);

  const computed = computeTargets({
    sex,
    age,
    heightCm,
    weightKg,
    activity,
    goal,
    rateKgPerWeek: goal === 'maintain' ? 0 : rate,
  });
  const pct = percentsFromMacros(targets);

  function recompute() {
    setTargets(computed.targets);
    setDirtyTargets(false);
  }

  function setPercent(key: 'protein' | 'carbs' | 'fat', value: number) {
    const next = { ...pct, [key]: value };
    const others = (['protein', 'carbs', 'fat'] as const).filter((k) => k !== key);
    const rest = 100 - value;
    const otherSum = next[others[0]] + next[others[1]] || 1;
    next[others[0]] = Math.round((next[others[0]] / otherSum) * rest);
    next[others[1]] = rest - next[others[0]];
    setTargets(macrosFromPercents(targets.kcal, next));
    setDirtyTargets(true);
  }

  async function save() {
    await updateProfile({
      sex,
      age,
      heightCm,
      weightKg,
      activity,
      goal,
      rateKgPerWeek: goal === 'maintain' ? 0 : rate,
      targets,
      targetsOverridden: dirtyTargets,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Section title="Profile & goals">
      <Segmented
        label="Sex"
        value={sex}
        options={[
          { value: 'male' as Sex, label: 'Male' },
          { value: 'female' as Sex, label: 'Female' },
        ]}
        onChange={setSex}
      />
      <label className="block">
        <span className="label">Age</span>
        <input
          type="number"
          inputMode="numeric"
          className="input"
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
        />
      </label>
      <HeightInput units={units} heightCm={heightCm} onChange={setHeightCm} />
      <WeightInput units={units} weightKg={weightKg} onChange={setWeightKg} />
      <label className="block">
        <span className="label">Activity</span>
        <select
          className="input"
          value={activity}
          onChange={(e) => setActivity(e.target.value as Activity)}
        >
          {(Object.keys(ACTIVITY_MULTIPLIERS) as Activity[]).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABELS[a].label}
            </option>
          ))}
        </select>
      </label>
      <Segmented
        label="Goal"
        value={goal}
        options={[
          { value: 'lose' as GoalType, label: 'Lose' },
          { value: 'maintain' as GoalType, label: 'Maintain' },
          { value: 'gain' as GoalType, label: 'Gain' },
        ]}
        onChange={setGoal}
      />
      {goal !== 'maintain' && (
        <label className="block">
          <span className="label">Pace (kg per week)</span>
          <select className="input" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <option key={r} value={r}>
                {r} kg / {Math.round(r * 2.2 * 10) / 10} lb
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="rounded-xl bg-gray-100 p-3 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Daily targets</p>
          <button type="button" className="text-sm font-medium text-brand-600" onClick={recompute}>
            Recompute ({computed.targets.kcal} kcal)
          </button>
        </div>
        <label className="mt-2 block">
          <span className="label">Calories</span>
          <input
            type="number"
            inputMode="numeric"
            className="input"
            value={targets.kcal}
            onChange={(e) => {
              setTargets(macrosFromPercents(Number(e.target.value), pct));
              setDirtyTargets(true);
            }}
          />
        </label>
        <div className="mt-3 space-y-2">
          {(
            [
              ['protein', 'Protein', targets.proteinG],
              ['carbs', 'Carbs', targets.carbsG],
              ['fat', 'Fat', targets.fatG],
            ] as const
          ).map(([key, label, grams]) => (
            <label key={key} className="block">
              <span className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums text-gray-500">
                  {pct[key]}% · {grams} g
                </span>
              </span>
              <input
                type="range"
                min={5}
                max={70}
                value={pct[key]}
                className="w-full accent-brand-600"
                onChange={(e) => setPercent(key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        {dirtyTargets && (
          <p className="mt-2 text-xs text-gray-500">
            Targets were edited by hand; profile changes won't change them until you tap Recompute.
          </p>
        )}
      </div>

      <button type="button" className="btn btn-primary w-full" onClick={() => void save()}>
        {saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </Section>
  );
}
