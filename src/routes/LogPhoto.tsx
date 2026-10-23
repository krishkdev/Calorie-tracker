import Icon from '../components/Icon';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createProvider } from '../ai';
import { downscaleImage } from '../ai/image';
import { itemsFromAnalysis } from '../ai/mapItems';
import { toAIError } from '../ai/openaiCompat';
import type { AIError } from '../ai/types';
import AIErrorCard from '../components/AIErrorCard';
import BusyHint from '../components/BusyHint';
import { useSettings } from '../db/hooks';
import { safeDayKey } from '../lib/dates';
import { mealFromParam } from '../lib/meals';
import type { ReviewState } from './ReviewEntry';

export default function LogPhoto() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AIError | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vision = settings.provider.supportsVision;

  // Release the preview's object URL when leaving the screen.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function pick(f: File | null) {
    setError(null);
    setNotes(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
    // Clear the native input so picking the same file again fires a change event.
    if (!f && fileRef.current) fileRef.current.value = '';
  }

  async function analyze() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setNotes(null);
    abort.current = new AbortController();
    try {
      // Decode the full-size photo once; the thumbnail comes from the result.
      const image = await downscaleImage(file, { maxEdge: 1024, quality: 0.8 });
      const thumb = await downscaleImage(image.blob, { maxEdge: 256, quality: 0.7 });
      const result = await createProvider(settings.provider).analyze(
        {
          image: { dataUrl: image.dataUrl, mime: 'image/jpeg' },
          text: context,
          units: settings.units,
        },
        { signal: abort.current.signal },
      );
      if (result.items.length === 0) {
        setNotes(
          result.notes ??
            'The model could not identify any food in this photo. Try a closer, well-lit shot or add a description.',
        );
        return;
      }
      const state: ReviewState = {
        items: itemsFromAnalysis(result),
        note: context.trim() || undefined,
        photoThumb: thumb.blob,
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
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button type="button" className="text-brand-600" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">Photo</h1>
        <span className="w-12" />
      </header>

      {!vision ? (
        <div className="card space-y-3">
          <p className="font-semibold">Your model can't see images</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {settings.provider.model || 'The configured model'} ({settings.provider.preset}) is text
            only. Pick a vision-capable model in Settings to log by photo, or describe the food
            instead.
          </p>
          <div className="flex gap-2">
            <Link to="/settings" className="btn btn-primary flex-1">
              Open Settings
            </Link>
            <Link to={`/log/text?${params.toString()}`} className="btn btn-secondary flex-1">
              Describe it
            </Link>
          </div>
        </div>
      ) : (
        <>
          <label className="capture-zone">
            {preview ? (
              <img
                src={preview}
                alt="Selected food"
                className="max-h-72 w-full rounded-xl object-contain"
              />
            ) : (
              <>
                <span className="mb-3">
                  <Icon name="camera" size={44} />
                </span>
                <span className="font-semibold">Take or choose a photo</span>
                <span className="capture-hint">
                  The photo is shrunk on your device before it is sent to the AI.
                </span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>

          <input
            className="input"
            placeholder="Optional details, e.g. “half portion, no dressing”"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            aria-label="Extra details"
          />

          {error && <AIErrorCard error={error} />}
          {notes && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              {notes}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!file || busy}
            onClick={() => void analyze()}
          >
            {busy ? 'Analyzing photo…' : 'Estimate calories'}
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
          {preview && !busy && (
            <button type="button" className="btn btn-secondary w-full" onClick={() => pick(null)}>
              Choose a different photo
            </button>
          )}
          <p className="text-center text-xs text-gray-500">
            Using {settings.provider.model} via {settings.provider.preset}.
          </p>
        </>
      )}
    </div>
  );
}
