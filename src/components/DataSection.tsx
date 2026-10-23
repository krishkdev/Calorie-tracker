import { useRef, useState } from 'react';
import {
  backupFilename,
  exportBackup,
  importBackup,
  type ImportMode,
  type ImportSummary,
} from '../db/backup';
import { getSettings } from '../db/repo';
import { applyTheme } from '../lib/theme';

/** Export / import of the whole local database as a JSON file. */
export default function DataSection() {
  const [includeKey, setIncludeKey] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport() {
    setBusy(true);
    setMessage(null);
    try {
      const backup = await exportBackup({ includeApiKey: includeKey, includePhotos });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMessage(
        `Exported ${backup.entries.length} entries, ${backup.weights.length} weights and ${backup.favorites.length} favorites.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  // The backup is parsed on pick, then the user chooses what to do with it.
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);

  async function pickImport(file: File) {
    setMessage(null);
    try {
      setPending({ name: file.name, data: JSON.parse(await file.text()) as unknown });
    } catch {
      setMessage('That file is not valid JSON.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function doImport(mode: ImportMode) {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    try {
      const s: ImportSummary = await importBackup(pending.data, mode);
      applyTheme((await getSettings()).theme);
      setMessage(
        `Imported ${s.entries} entries, ${s.weights} weights and ${s.favorites} favorites${s.profile ? ', profile' : ''}${s.settings ? ', settings' : ''}.`,
      );
      setPending(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Everything lives in this browser. Export a backup now and then, and before switching phones
        or clearing site data.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includePhotos}
          onChange={(e) => setIncludePhotos(e.target.checked)}
        />
        Include photo thumbnails
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeKey}
          onChange={(e) => setIncludeKey(e.target.checked)}
        />
        Include my API key (keep the file private)
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={busy}
          onClick={() => void doExport()}
        >
          Export backup
        </button>
        <button
          type="button"
          className="btn btn-secondary flex-1"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Backup file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickImport(f);
          }}
        />
      </div>
      {pending && (
        <div className="rounded-xl bg-gray-100 p-3 text-sm dark:bg-gray-800" role="group">
          <p className="mb-2">
            Import <span className="font-medium">{pending.name}</span>?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              disabled={busy}
              onClick={() => void doImport('merge')}
            >
              Merge into my data
            </button>
            <button
              type="button"
              className="btn btn-danger flex-1"
              disabled={busy}
              onClick={() => void doImport('replace')}
            >
              Replace everything
            </button>
            <button
              type="button"
              className="btn btn-secondary flex-1"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Merge keeps what is on this device and adds the backup. Replace deletes everything here
            first.
          </p>
        </div>
      )}
      {message && (
        <p className="rounded-xl bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
