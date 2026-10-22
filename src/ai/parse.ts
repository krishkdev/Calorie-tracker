import { AIError, type AnalysisResult, type AnalyzedItem } from './types';

/**
 * Pull a JSON object out of a model reply that may include code fences,
 * preamble text, or trailing commentary.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (!text) throw new AIError('bad_json', 'The model returned an empty reply.', undefined, raw);

  const attempts: string[] = [text];

  // ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1].trim());

  // First "{" to last "}" in case of surrounding prose.
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new AIError('bad_json', 'The model did not return valid JSON.', undefined, raw);
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (k in obj && obj[k] !== null && obj[k] !== undefined) return obj[k];
  return undefined;
}

/** Coerce whatever the model produced into a well-formed AnalysisResult. */
export function normalizeResult(data: unknown, raw: string): AnalysisResult {
  if (!data || typeof data !== 'object') {
    throw new AIError('bad_json', 'The model reply was not a JSON object.', undefined, raw);
  }
  const obj = data as Record<string, unknown>;
  let list: unknown = pick(obj, 'items', 'foods', 'food_items', 'results');
  // Some models return a bare array or a single item object.
  if (Array.isArray(data)) list = data;
  if (!Array.isArray(list) && 'name' in obj) list = [obj];
  if (!Array.isArray(list)) list = [];

  const items: AnalyzedItem[] = [];
  for (const entry of list as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const it = entry as Record<string, unknown>;
    const name = String(pick(it, 'name', 'food', 'item', 'title') ?? '').trim();
    if (!name) continue;
    const calories = num(pick(it, 'calories', 'kcal', 'calories_kcal', 'energy_kcal')) ?? 0;
    const protein = num(pick(it, 'protein_g', 'protein', 'proteins')) ?? 0;
    const carbs = num(pick(it, 'carbs_g', 'carbs', 'carbohydrates_g', 'carbohydrates')) ?? 0;
    const fat = num(pick(it, 'fat_g', 'fat', 'fats')) ?? 0;
    let confidence = num(pick(it, 'confidence')) ?? 0.5;
    // "85" means 85%; a stray 1.5 or 2 is just out of range.
    if (confidence > 10) confidence = confidence / 100;
    items.push({
      name,
      portion: String(pick(it, 'portion', 'serving', 'quantity', 'amount') ?? '').trim(),
      calories: Math.max(0, Math.round(calories)),
      protein_g: Math.max(0, round1(protein)),
      carbs_g: Math.max(0, round1(carbs)),
      fat_g: Math.max(0, round1(fat)),
      confidence: Math.min(1, Math.max(0, confidence)),
    });
  }

  const notesRaw = pick(obj, 'notes', 'note', 'comment');
  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : undefined;
  return { items, notes, raw };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function parseAnalysis(raw: string): AnalysisResult {
  return normalizeResult(extractJson(raw), raw);
}
