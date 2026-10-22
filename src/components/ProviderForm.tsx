import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createProvider } from '../ai';
import { configFromPreset, getPreset, looksLikeVisionModel, PRESETS } from '../ai/presets';
import type { ConnectionTest } from '../ai/types';
import { db } from '../db/db';
import { mergeSettings, updateSettings } from '../db/repo';
import type { PresetId, ProviderConfig } from '../db/types';

/** Waits for stored settings so the form mounts with the saved config as initial state. */
export default function ProviderForm() {
  const settings = useLiveQuery(
    async () => mergeSettings((await db.settings.get('app')) ?? {}),
    [],
  );
  // "Saved" lives here because saving remounts the keyed form below.
  const [saved, setSaved] = useState(false);
  if (!settings) return null;
  return (
    <Form
      key={JSON.stringify(settings.provider)}
      initial={settings.provider}
      saved={saved}
      onSaved={() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
    />
  );
}

function Form({
  initial,
  saved,
  onSaved,
}: {
  initial: ProviderConfig;
  saved: boolean;
  onSaved: () => void;
}) {
  const [cfg, setCfg] = useState<ProviderConfig>(initial);
  const [showKey, setShowKey] = useState(false);
  const [advanced, setAdvanced] = useState(Boolean(initial.proxyUrl));
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);
  const preset = getPreset(cfg.preset);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);

  function choosePreset(id: PresetId) {
    setCfg(configFromPreset(id, cfg.apiKey));
    setTest(null);
  }

  function setModel(model: string) {
    setCfg((c) => ({
      ...c,
      model,
      supportsVision:
        preset.vision === 'yes'
          ? true
          : preset.vision === 'no'
            ? false
            : looksLikeVisionModel(model),
    }));
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      setTest(await createProvider(cfg).testConnection());
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    await updateSettings({
      provider: {
        ...cfg,
        baseUrl: cfg.baseUrl.trim(),
        model: cfg.model.trim(),
        apiKey: cfg.apiKey.trim(),
      },
    });
    onSaved();
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">Provider</span>
        <select
          className="input"
          value={cfg.preset}
          onChange={(e) => choosePreset(e.target.value as PresetId)}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.badge}
            </option>
          ))}
        </select>
      </label>

      <div className={`rounded-xl px-3 py-2 text-sm ${badgeClass(preset.vision)}`}>
        <p className="font-semibold">{preset.badge}</p>
        <p className="mt-0.5">{preset.imageNote}</p>
        {preset.corsNote && <p className="mt-1 text-xs opacity-80">{preset.corsNote}</p>}
      </div>

      {preset.needsKey || cfg.preset === 'custom' ? (
        <label className="block">
          <span className="label">
            API key{' '}
            {preset.keyUrl && (
              <a
                className="font-normal text-brand-600 underline"
                href={preset.keyUrl}
                target="_blank"
                rel="noreferrer"
              >
                get one
              </a>
            )}
          </span>
          <div className="flex gap-2">
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={cfg.apiKey}
              placeholder={preset.needsKey ? 'sk-…' : 'optional'}
              onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-secondary px-3"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="mt-1 block text-xs text-gray-500">
            Stored only in this browser and sent only to the provider above.
          </span>
        </label>
      ) : null}

      <label className="block">
        <span className="label">Model</span>
        <input
          className="input"
          list="model-suggestions"
          value={cfg.model}
          placeholder="model id"
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setModel(e.target.value)}
        />
        <datalist id="model-suggestions">
          {preset.suggestedModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      <div
        className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm ${cfg.supportsVision ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-500' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
        aria-live="polite"
      >
        <p>
          <span className="font-semibold">
            Photo logging: {cfg.supportsVision ? 'available' : 'not available'}
          </span>
          <span className="block text-xs opacity-80">
            {cfg.supportsVision
              ? `${cfg.model || 'This model'} can read images.`
              : `${cfg.model || 'This model'} is text only. You can still log by typing a description.`}
          </span>
        </p>
        {preset.vision === 'depends' && (
          <label className="flex flex-none items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cfg.supportsVision}
              onChange={(e) => setCfg({ ...cfg, supportsVision: e.target.checked })}
            />
            Model can read images
          </label>
        )}
      </div>

      <button
        type="button"
        className="text-sm text-brand-600"
        onClick={() => setAdvanced((a) => !a)}
        aria-expanded={advanced}
      >
        {advanced ? 'Hide advanced ▴' : 'Advanced ▾'}
      </button>
      {advanced && (
        <div className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <label className="block">
            <span className="label">Base URL</span>
            <input
              className="input"
              value={cfg.baseUrl}
              spellCheck={false}
              autoCapitalize="off"
              placeholder="https://host/v1"
              onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.jsonMode}
              onChange={(e) => setCfg({ ...cfg, jsonMode: e.target.checked })}
            />
            JSON mode (response_format). Turn off if the server rejects it.
          </label>
          <label className="block">
            <span className="label">Proxy URL (optional)</span>
            <input
              className="input"
              value={cfg.proxyUrl ?? ''}
              spellCheck={false}
              autoCapitalize="off"
              placeholder="https://my-proxy.example/v1"
              onChange={(e) => setCfg({ ...cfg, proxyUrl: e.target.value || undefined })}
            />
            <span className="mt-1 block text-xs text-gray-500">
              Only for providers that block browser requests. Requests go to the proxy with the real
              base URL in an X-Target-Base-Url header.
            </span>
          </label>
          <a
            className="block text-xs text-brand-600 underline"
            href={preset.docsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Provider documentation
          </a>
        </div>
      )}

      {test && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${test.ok ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-500' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}
          role="status"
        >
          {test.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          disabled={testing}
          onClick={() => void runTest()}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={!dirty && !saved}
          onClick={() => void save()}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function badgeClass(v: 'yes' | 'no' | 'depends'): string {
  if (v === 'yes') return 'bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-500';
  if (v === 'no') return 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200';
  return 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200';
}
