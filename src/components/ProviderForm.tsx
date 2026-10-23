import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createProvider } from '../ai';
import { configFromPreset, getPreset, PRESETS } from '../ai/presets';
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
    // Keys are provider-specific, so switching starts with an empty key field.
    setCfg(configFromPreset(id));
    setTest(null);
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

      <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-700/20 dark:text-brand-500">
        <p className="font-semibold">{preset.badge}</p>
        <p className="mt-0.5">{preset.note}</p>
      </div>

      <label className="block">
        <span className="label">
          API key{' '}
          <a
            className="font-normal text-brand-600 underline"
            href={preset.keyUrl}
            target="_blank"
            rel="noreferrer"
          >
            get one
          </a>
        </span>
        <div className="flex gap-2">
          <input
            className="input"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={cfg.apiKey}
            placeholder={cfg.preset === 'gemini' ? 'AIza…' : 'sk-…'}
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
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Stored in this browser only and sent only to {preset.name}.
        </span>
      </label>

      <label className="block">
        <span className="label">Model</span>
        <input
          className="input"
          list="model-suggestions"
          value={cfg.model}
          placeholder="model id"
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
        />
        <datalist id="model-suggestions">
          {preset.suggestedModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Photo logging works with {preset.name} models. Test connection checks that this model id
          exists for your key.
        </span>
      </label>

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
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              Only if you run a relay that holds the key. Requests go to the proxy with the real
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
