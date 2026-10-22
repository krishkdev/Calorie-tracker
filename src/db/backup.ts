import { db } from './db';
import { mergeSettings } from './repo';
import type { Favorite, FoodEntry, Profile, Settings, WeightEntry } from './types';

export const BACKUP_SCHEMA_VERSION = 1;

export interface Backup {
  app: 'calorie-tracker';
  schemaVersion: number;
  exportedAt: string;
  profile: Profile | null;
  settings: Settings | null;
  entries: (Omit<FoodEntry, 'photoThumb'> & { photoThumb?: string })[];
  weights: WeightEntry[];
  favorites: Favorite[];
}

export interface ExportOptions {
  /** API keys are stripped unless the user explicitly opts in. */
  includeApiKey?: boolean;
  /** Thumbnails are small but add up; off by default. */
  includePhotos?: boolean;
}

export async function exportBackup(opts: ExportOptions = {}): Promise<Backup> {
  const [profile, settings, entries, weights, favorites] = await Promise.all([
    db.profile.get('me'),
    db.settings.get('app'),
    db.entries.toArray(),
    db.weights.toArray(),
    db.favorites.toArray(),
  ]);
  const safeSettings = settings ? mergeSettings(settings) : null;
  if (safeSettings && !opts.includeApiKey) {
    safeSettings.provider = { ...safeSettings.provider, apiKey: '' };
  }
  const serialisedEntries = await Promise.all(
    entries.map(async ({ photoThumb, ...rest }) => ({
      ...rest,
      photoThumb: opts.includePhotos && photoThumb ? await blobToBase64(photoThumb) : undefined,
    })),
  );
  return {
    app: 'calorie-tracker',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    settings: safeSettings,
    entries: serialisedEntries,
    weights,
    favorites,
  };
}

export function backupFilename(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `calorie-tracker-backup-${stamp}.json`;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  entries: number;
  weights: number;
  favorites: number;
  profile: boolean;
  settings: boolean;
}

export function validateBackup(data: unknown): Backup {
  if (!data || typeof data !== 'object') throw new Error('Not a backup file.');
  const b = data as Partial<Backup>;
  if (b.app !== 'calorie-tracker')
    throw new Error('This file was not exported by Calorie Tracker.');
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('This backup comes from a newer version of the app. Update the app first.');
  }
  return {
    app: 'calorie-tracker',
    schemaVersion: b.schemaVersion,
    exportedAt: b.exportedAt ?? '',
    profile: b.profile ?? null,
    settings: b.settings ?? null,
    entries: Array.isArray(b.entries) ? b.entries : [],
    weights: Array.isArray(b.weights) ? b.weights : [],
    favorites: Array.isArray(b.favorites) ? b.favorites : [],
  };
}

/**
 * Merge keeps existing records and adds/overwrites by id (weights by day).
 * Replace wipes everything first. Settings keep the current API key unless the
 * backup carries one.
 */
export async function importBackup(data: unknown, mode: ImportMode): Promise<ImportSummary> {
  const backup = validateBackup(data);
  const entries = await Promise.all(
    backup.entries.map(async ({ photoThumb, ...rest }) => ({
      ...rest,
      photoThumb: photoThumb ? await base64ToBlob(photoThumb) : undefined,
    })),
  );

  await db.transaction(
    'rw',
    [db.profile, db.settings, db.entries, db.weights, db.favorites],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.profile.clear(),
          db.entries.clear(),
          db.weights.clear(),
          db.favorites.clear(),
        ]);
      }
      if (backup.profile) await db.profile.put({ ...backup.profile, id: 'me' });
      if (backup.settings) {
        const current = await db.settings.get('app');
        const incoming = mergeSettings(backup.settings);
        if (!incoming.provider.apiKey && current?.provider.apiKey) {
          incoming.provider = { ...incoming.provider, apiKey: current.provider.apiKey };
        }
        await db.settings.put(incoming);
      }
      await db.entries.bulkPut(entries);
      for (const w of backup.weights) {
        // Unique index on dayKey: drop an existing row for that day before putting.
        const existing = await db.weights.where('dayKey').equals(w.dayKey).first();
        if (existing && existing.id !== w.id) await db.weights.delete(existing.id);
        await db.weights.put(w);
      }
      await db.favorites.bulkPut(backup.favorites);
    },
  );

  return {
    entries: entries.length,
    weights: backup.weights.length,
    favorites: backup.favorites.length,
    profile: Boolean(backup.profile),
    settings: Boolean(backup.settings),
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

async function base64ToBlob(dataUrl: string): Promise<Blob> {
  const [head, body] = dataUrl.split(',', 2);
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(body ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
