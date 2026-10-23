import { db } from './db';
import { DEFAULT_SETTINGS } from './defaults';
import { getPreset, isPresetId } from '../ai/presets';
import type {
  CachedProduct,
  Favorite,
  FoodEntry,
  FoodItem,
  Profile,
  ProductInfo,
  ProviderConfig,
  Settings,
  WeightEntry,
} from './types';
import { newId } from '../lib/id';
import { entryTotals } from '../nutrition/totals';

// ---------- Profile ----------

export function getProfile(): Promise<Profile | undefined> {
  return db.profile.get('me');
}

export async function saveProfile(profile: Omit<Profile, 'id'>): Promise<void> {
  await db.profile.put({ ...profile, id: 'me' });
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const current = await getProfile();
  if (!current) throw new Error('No profile yet');
  await db.profile.put({ ...current, ...patch, id: 'me' });
}

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  return s ? mergeSettings(s) : { ...DEFAULT_SETTINGS };
}

/**
 * Fill in any fields added after the user first saved settings, and make the
 * provider block safe to use even if it came from an old version or a hand-
 * edited backup (wrong types, a preset that no longer exists).
 */
export function mergeSettings(s: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    id: 'app',
    provider: sanitizeProvider(s.provider),
    mealCutoffs: { ...DEFAULT_SETTINGS.mealCutoffs, ...(s.mealCutoffs ?? {}) },
  };
}

function sanitizeProvider(raw: Partial<ProviderConfig> | undefined): ProviderConfig {
  const p = raw ?? {};
  if (!isPresetId(p.preset)) {
    // Presets that were removed (or garbage): fall back to the default provider
    // but keep nothing else, since the old key would not work there anyway.
    return { ...DEFAULT_SETTINGS.provider };
  }
  const preset = getPreset(p.preset);
  const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
  const proxy = typeof p.proxyUrl === 'string' && p.proxyUrl.trim() ? p.proxyUrl : undefined;
  return {
    kind: 'openai-compatible',
    preset: p.preset,
    baseUrl: str(p.baseUrl, preset.baseUrl) || preset.baseUrl,
    apiKey: str(p.apiKey, ''),
    model: str(p.model, preset.defaultModel) || preset.defaultModel,
    supportsVision: typeof p.supportsVision === 'boolean' ? p.supportsVision : true,
    jsonMode: typeof p.jsonMode === 'boolean' ? p.jsonMode : true,
    ...(proxy ? { proxyUrl: proxy } : {}),
  };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings();
  const next = mergeSettings({ ...current, ...patch });
  await db.settings.put(next);
  return next;
}

// ---------- Food entries ----------

/** Items may come in without ids (AI results, barcode products); normalizeItem fills them in. */
export type ItemInput = Partial<FoodItem> & { name: string };

export type NewEntry = Pick<FoodEntry, 'dayKey' | 'meal'> & {
  items: ItemInput[];
} & Partial<Pick<FoodEntry, 'loggedAt' | 'note' | 'photoThumb'>>;

export async function addEntry(input: NewEntry): Promise<FoodEntry> {
  const now = Date.now();
  const items = input.items.map(normalizeItem);
  const entry: FoodEntry = {
    id: newId(),
    dayKey: input.dayKey,
    loggedAt: input.loggedAt ?? now,
    meal: input.meal,
    items,
    note: input.note,
    photoThumb: input.photoThumb,
    totals: entryTotals(items),
    createdAt: now,
    updatedAt: now,
  };
  await db.entries.add(entry);
  return entry;
}

export async function updateEntry(
  id: string,
  patch: Partial<Pick<FoodEntry, 'dayKey' | 'meal' | 'note' | 'loggedAt' | 'photoThumb'>> & {
    items?: ItemInput[];
  },
): Promise<void> {
  const current = await db.entries.get(id);
  if (!current) throw new Error('Entry not found');
  const items = (patch.items ?? current.items).map(normalizeItem);
  await db.entries.put({
    ...current,
    ...patch,
    items,
    totals: entryTotals(items),
    updatedAt: Date.now(),
  });
}

export function deleteEntry(id: string): Promise<void> {
  return db.entries.delete(id);
}

export function getEntry(id: string): Promise<FoodEntry | undefined> {
  return db.entries.get(id);
}

export function entriesForDay(dayKey: string): Promise<FoodEntry[]> {
  return db.entries.where('dayKey').equals(dayKey).sortBy('loggedAt');
}

/** Inclusive range of day keys. */
export function entriesBetween(fromKey: string, toKey: string): Promise<FoodEntry[]> {
  return db.entries.where('dayKey').between(fromKey, toKey, true, true).toArray();
}

export function normalizeItem(item: Partial<FoodItem> & { name: string }): FoodItem {
  return {
    id: item.id ?? newId(),
    name: item.name.trim(),
    portion: (item.portion ?? '').trim(),
    quantity: finite(item.quantity, 1),
    kcal: finite(item.kcal, 0),
    proteinG: finite(item.proteinG, 0),
    carbsG: finite(item.carbsG, 0),
    fatG: finite(item.fatG, 0),
    confidence: item.confidence,
    source: item.source ?? 'manual',
    barcode: item.barcode,
  };
}

function finite(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- Weight ----------

export async function upsertWeight(dayKey: string, weightKg: number, note?: string): Promise<void> {
  const existing = await db.weights.where('dayKey').equals(dayKey).first();
  const entry: WeightEntry = {
    id: existing?.id ?? newId(),
    dayKey,
    loggedAt: Date.now(),
    weightKg,
    note,
  };
  await db.weights.put(entry);
}

export function deleteWeight(id: string): Promise<void> {
  return db.weights.delete(id);
}

export function weightsBetween(fromKey: string, toKey: string): Promise<WeightEntry[]> {
  return db.weights.where('dayKey').between(fromKey, toKey, true, true).sortBy('dayKey');
}

export function latestWeight(): Promise<WeightEntry | undefined> {
  return db.weights.orderBy('dayKey').last();
}

// ---------- Favorites ----------

export async function addFavorite(name: string, items: FoodItem[]): Promise<Favorite> {
  const now = Date.now();
  const fav: Favorite = {
    id: newId(),
    name: name.trim(),
    items: items.map((i) => normalizeItem({ ...i, id: newId(), source: 'favorite' })),
    useCount: 0,
    lastUsedAt: now,
    createdAt: now,
  };
  await db.favorites.add(fav);
  return fav;
}

export async function touchFavorite(id: string): Promise<void> {
  const fav = await db.favorites.get(id);
  if (!fav) return;
  await db.favorites.put({ ...fav, useCount: fav.useCount + 1, lastUsedAt: Date.now() });
}

export function deleteFavorite(id: string): Promise<void> {
  return db.favorites.delete(id);
}

export function listFavorites(limit = 50): Promise<Favorite[]> {
  return db.favorites.orderBy('lastUsedAt').reverse().limit(limit).toArray();
}

// ---------- Product cache ----------

const PRODUCT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCachedProduct(barcode: string): Promise<CachedProduct | undefined> {
  const c = await db.productCache.get(barcode);
  if (!c) return undefined;
  if (Date.now() - c.fetchedAt > PRODUCT_TTL_MS) return undefined;
  return c;
}

export function cacheProduct(barcode: string, product: ProductInfo | null): Promise<string> {
  return db.productCache.put({ barcode, product, fetchedAt: Date.now() });
}

// ---------- Danger zone ----------

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.profile, db.settings, db.entries, db.weights, db.favorites, db.productCache],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.settings.clear(),
        db.entries.clear(),
        db.weights.clear(),
        db.favorites.clear(),
        db.productCache.clear(),
      ]);
    },
  );
}
