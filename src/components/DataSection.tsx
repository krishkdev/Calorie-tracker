import { useRef, useState } from 'react';
import { backupFilename, exportBackup, importBackup, type ImportSummary } from '../db/backup';

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

  async function doImport(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const data: unknown = JSON.parse(await file.text());
      const replace = confirm(
        'Replace everything on this device with the backup?\n\nOK = replace (current data is deleted)\nCancel = merge (keep current data, add the backup)',
      );
      const s: ImportSummary = await importBackup(data, replace ? 'replace' : 'merge');
      setMessage(
        `Imported ${s.entries} entries, ${s.weights} weights and ${s.favorites} favorites${s.profile ? ', profile' : ''}${s.settings ? ', settings' : ''}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
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
            if (f) void doImport(f);
          }}
        />
      </div>
      {message && (
        <p className="rounded-xl bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
