import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createProvider } from '../ai';
import { itemsFromAnalysis } from '../ai/mapItems';
import { toAIError } from '../ai/openaiCompat';
import type { AIError } from '../ai/types';
import AIErrorCard from '../components/AIErrorCard';
import BusyHint from '../components/BusyHint';
import { useSettings } from '../db/hooks';
import { safeDayKey } from '../lib/dates';
import { mealFromParam } from '../lib/meals';
import type { ReviewState } from './ReviewEntry';

const EXAMPLES = [
  '2 scrambled eggs and a slice of toast with butter',
  'large cappuccino with oat milk',
  'chicken burrito bowl with rice, beans, salsa and guac',
  'a handful of almonds',
];

export default function LogText() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AIError | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function analyze() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNotes(null);
    abort.current = new AbortController();
    try {
      const result = await createProvider(settings.provider).analyze(
        { text, units: settings.units },
        { signal: abort.current.signal },
      );
      if (result.items.length === 0) {
        setNotes(
          result.notes ??
            'The model could not identify any food in that description. Try adding more detail.',
        );
        return;
      }
      const state: ReviewState = {
        items: itemsFromAnalysis(result),
        note: text.trim(),
        meal: mealFromParam(params.get('meal')),
        dayKey: params.get('day') ? safeDayKey(params.get('day')) : undefined,
      };
      navigate('/entry/new', { state });
    } catch (e) {
      const err = toAIError(e);
      if (err.code !== 'aborted') setError(err); // Cancel is not an error
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void analyze();
      }}
    >
      <header className="flex items-center justify-between">
        <button type="button" className="text-brand-600" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">Describe your food</h1>
        <span className="w-12" />
      </header>

      <textarea
        className="input min-h-32"
        placeholder="What did you eat? Include amounts if you know them."
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        aria-label="Food description"
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            onClick={() => setText(ex)}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <AIErrorCard error={error} />}
      {notes && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {notes}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={!text.trim() || busy}>
        {busy ? 'Estimating…' : 'Estimate calories'}
      </button>
      {busy && (
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={() => abort.current?.abort()}
        >
          Cancel
        </button>
      )}
      {busy && <BusyHint preset={settings.provider.preset} model={settings.provider.model} />}
      <p className="text-center text-xs text-gray-500">
        Using {settings.provider.model || 'no model'} via {settings.provider.preset}. Estimates are
        approximate; you can edit everything before saving.
      </p>
    </form>
  );
}
