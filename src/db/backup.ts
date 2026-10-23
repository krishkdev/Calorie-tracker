import { db } from './db';
import { mergeSettings, normalizeItem } from './repo';
import { isDayKey, todayKey } from '../lib/dates';
import { ACTIVITY_MULTIPLIERS, isPlausibleBody } from '../nutrition/tdee';
import { entryTotals } from '../nutrition/totals';
import type {
  Activity,
  Favorite,
  FoodEntry,
  GoalType,
  Macros,
  MealType,
  Profile,
  Settings,
  Sex,
  WeightEntry,
} from './types';

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
  // Rebuild every record from scratch so a hand-edited or foreign file can
  // never store a row that later crashes a screen.
  const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const today = todayKey();
  const entries: FoodEntry[] = [];
  for (const raw of backup.entries as Partial<FoodEntry & { photoThumb: string }>[]) {
    // Future days would be unreachable from every screen, so they are skipped.
    if (!raw || typeof raw.id !== 'string' || !isDayKey(raw.dayKey) || raw.dayKey > today) continue;
    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    const items = rawItems
      .filter((i) => i && typeof i === 'object')
      .map((i) => normalizeItem({ ...i, name: String(i.name ?? '') }))
      .filter((i) => i.name);
    const now = Date.now();
    entries.push({
      id: raw.id,
      dayKey: raw.dayKey,
      loggedAt: Number.isFinite(raw.loggedAt) ? (raw.loggedAt as number) : now,
      meal: MEALS.includes(raw.meal as MealType) ? (raw.meal as MealType) : 'snack',
      items,
      note: typeof raw.note === 'string' ? raw.note : undefined,
      photoThumb:
        typeof raw.photoThumb === 'string' && raw.photoThumb.startsWith('data:')
          ? await base64ToBlob(raw.photoThumb)
          : undefined,
      totals: entryTotals(items),
      createdAt: Number.isFinite(raw.createdAt) ? (raw.createdAt as number) : now,
      updatedAt: Number.isFinite(raw.updatedAt) ? (raw.updatedAt as number) : now,
    });
  }
  const byDay = new Map<string, WeightEntry>();
  for (const w of backup.weights) {
    if (
      w &&
      typeof w.id === 'string' &&
      isDayKey(w.dayKey) &&
      w.dayKey <= today &&
      Number.isFinite(w.weightKg) &&
      w.weightKg > 0
    ) {
      byDay.set(w.dayKey, {
        id: w.id,
        dayKey: w.dayKey,
        weightKg: w.weightKg,
        loggedAt: Number.isFinite(w.loggedAt) ? w.loggedAt : Date.now(),
        ...(typeof w.note === 'string' ? { note: w.note } : {}),
      }); // last one per day wins
    }
  }
  const weights = [...byDay.values()];
  const favorites: Favorite[] = backup.favorites
    .filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
    .map((f) => ({
      ...f,
      items: (Array.isArray(f.items) ? f.items : [])
        .filter((i) => i && typeof i === 'object')
        .map((i) => normalizeItem({ ...i, name: String(i.name ?? '') }))
        .filter((i) => i.name),
      useCount: Number.isFinite(f.useCount) ? f.useCount : 0,
      lastUsedAt: Number.isFinite(f.lastUsedAt) ? f.lastUsedAt : Date.now(),
      createdAt: Number.isFinite(f.createdAt) ? f.createdAt : Date.now(),
    }));
  const profile = sanitizeProfile(backup.profile);

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
      if (profile) await db.profile.put({ ...profile, id: 'me' });
      if (backup.settings) {
        const current = await db.settings.get('app');
        const incoming = mergeSettings(backup.settings);
        // Keys are per provider: only carry the current one over for the same preset.
        if (
          !incoming.provider.apiKey &&
          current?.provider.apiKey &&
          current.provider.preset === incoming.provider.preset
        ) {
          incoming.provider = { ...incoming.provider, apiKey: current.provider.apiKey };
        }
        await db.settings.put(incoming);
      }
      if (mode === 'merge') {
        // Backups drop thumbnails by default; merging must not erase the ones we have.
        const existing = await db.entries.bulkGet(entries.map((e) => e.id));
        entries.forEach((e, i) => {
          if (!e.photoThumb && existing[i]?.photoThumb) e.photoThumb = existing[i].photoThumb;
        });
      }
      await db.entries.bulkPut(entries);
      for (const w of weights) {
        // Unique index on dayKey: drop an existing row for that day before putting.
        const existing = await db.weights.where('dayKey').equals(w.dayKey).first();
        if (existing && existing.id !== w.id) await db.weights.delete(existing.id);
        await db.weights.put(w);
      }
      await db.favorites.bulkPut(favorites);
    },
  );

  return {
    entries: entries.length,
    weights: weights.length,
    favorites: favorites.length,
    profile: Boolean(profile),
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

async function base64ToBlob(dataUrl: string): Promise<Blob | undefined> {
  try {
    const [head, body] = dataUrl.split(',', 2);
    const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
    const bin = atob(body ?? '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  } catch {
    return undefined; // one corrupt thumbnail must not abort the whole import
  }
}

const SEXES: Sex[] = ['male', 'female'];
const GOALS: GoalType[] = ['lose', 'maintain', 'gain'];

function finiteNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Rebuild the profile field by field; anything implausible drops the profile. */
function sanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Profile>;
  const t = (p.targets ?? {}) as Partial<Macros>;
  const targets = {
    kcal: finiteNum(t.kcal),
    proteinG: finiteNum(t.proteinG),
    carbsG: finiteNum(t.carbsG),
    fatG: finiteNum(t.fatG),
  };
  const age = finiteNum(p.age);
  const heightCm = finiteNum(p.heightCm);
  const weightKg = finiteNum(p.weightKg);
  if (
    age === undefined ||
    heightCm === undefined ||
    weightKg === undefined ||
    !isPlausibleBody({ age, heightCm, weightKg }) ||
    !SEXES.includes(p.sex as Sex) ||
    !GOALS.includes(p.goal as GoalType) ||
    !(p.activity && p.activity in ACTIVITY_MULTIPLIERS) ||
    Object.values(targets).some((v) => v === undefined || v < 0) ||
    (targets.kcal ?? 0) <= 0
  ) {
    return null;
  }
  return {
    id: 'me',
    sex: p.sex as Sex,
    age,
    heightCm,
    weightKg,
    activity: p.activity as Activity,
    goal: p.goal as GoalType,
    rateKgPerWeek: Math.max(0, finiteNum(p.rateKgPerWeek) ?? 0),
    targets: targets as Macros,
    targetsOverridden: p.targetsOverridden === true,
    onboardedAt: finiteNum(p.onboardedAt) ?? Date.now(),
  };
}
