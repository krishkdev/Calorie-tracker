import Icon from '../components/Icon';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataSection from '../components/DataSection';
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
  type MacroPercents,
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
      <header className="screen-heading">
        <h1>Made for you.</h1>
        <p>Your goals, your AI, your data. You’re in control.</p>
      </header>
      <div className="settings-privacy">
        <Icon name="shield" size={24} />
        <div>
          <strong>Local by default.</strong>
          <p>
            Food logs, goals, and your key are saved in this browser. AI requests go straight from
            your browser to Google or OpenAI with your own key.
          </p>
        </div>
      </div>

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

      <Section title="Your data">
        <DataSection />
      </Section>

      <Section title="About">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calorie Tracker is free and open source (AGPL-3.0). Your logs stay on this device. When
          you use AI, descriptions and photos go to your chosen provider or configured proxy.
          Barcode lookups send the barcode to{' '}
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
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Version {__APP_VERSION__}</p>
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
  // Percentages are state (not re-derived from rounded grams) so edits don't drift.
  const [pct, setPct] = useState<MacroPercents>(() => percentsFromMacros(profile.targets));
  const [kcalDraft, setKcalDraft] = useState(String(profile.targets.kcal));
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
  function applyTargets(next: Macros) {
    setTargets(next);
    setPct(percentsFromMacros(next));
    setKcalDraft(String(next.kcal));
  }

  function recompute() {
    applyTargets(computed.targets);
    setDirtyTargets(false);
  }

  function setKcal(raw: string) {
    setKcalDraft(raw);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      setTargets(macrosFromPercents(Math.round(n), pct));
      setDirtyTargets(true);
    }
  }

  function setPercent(key: 'protein' | 'carbs' | 'fat', value: number) {
    const next = { ...pct, [key]: value };
    const others = (['protein', 'carbs', 'fat'] as const).filter((k) => k !== key);
    const rest = 100 - value;
    const otherSum = next[others[0]] + next[others[1]] || 1;
    next[others[0]] = Math.round((next[others[0]] / otherSum) * rest);
    next[others[1]] = rest - next[others[0]];
    setPct(next);
    setTargets(macrosFromPercents(targets.kcal, next));
    setDirtyTargets(true);
  }

  async function save() {
    // Targets follow the profile unless the user edited them by hand.
    const nextTargets = dirtyTargets ? targets : computed.targets;
    await updateProfile({
      sex,
      age,
      heightCm,
      weightKg,
      activity,
      goal,
      rateKgPerWeek: goal === 'maintain' ? 0 : rate,
      targets: nextTargets,
      targetsOverridden: dirtyTargets,
    });
    applyTargets(nextTargets);
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
            value={kcalDraft}
            min={800}
            onChange={(e) => setKcal(e.target.value)}
            onBlur={() => setKcalDraft(String(targets.kcal))}
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
                <span className="tabular-nums text-gray-600 dark:text-gray-400">
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
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Targets were edited by hand, so saving the profile keeps them. Tap Recompute to derive
            them from your profile again.
          </p>
        )}
      </div>

      <button type="button" className="btn btn-primary w-full" onClick={() => void save()}>
        {saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </Section>
  );
}
