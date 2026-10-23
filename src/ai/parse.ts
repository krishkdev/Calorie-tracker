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

  // Every balanced {...} or [...] in the text, so prose with stray braces
  // before the JSON, or two objects in a row, still yield the first real one.
  for (const candidate of balancedSpans(text)) attempts.push(candidate);

  for (const candidate of attempts) {
    for (const variant of [candidate, stripTrailingCommas(candidate)]) {
      try {
        return JSON.parse(variant);
      } catch {
        // try the next candidate
      }
    }
  }
  throw new AIError('bad_json', 'The model did not return valid JSON.', undefined, raw);
}

/** Substrings that start at a bracket and end at its matching close bracket. */
function balancedSpans(text: string): string[] {
  const spans: string[] = [];
  for (let i = 0; i < text.length && spans.length < 8; i++) {
    const open = text[i];
    if (open !== '{' && open !== '[') continue;
    let depth = 0;
    let inString = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (ch === '\\') j++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          spans.push(text.slice(i, j + 1));
          break;
        }
      }
    }
  }
  return spans;
}

function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1');
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    // First numeric token only: "approx. 250" -> 250, "250 kcal (100 g)" -> 250,
    // ".5 g" -> 0.5, "1,200 kcal" -> 1200, "45,5" (decimal comma) -> 45.5.
    const m = v.match(/-?(?:\d[\d,]*(?:\.\d+)?|\.\d+)/);
    if (!m) return null;
    const token = /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(m[0])
      ? m[0].replace(/,/g, '') // thousands separators
      : m[0].replace(/,(\d+)$/, '.$1'); // decimal comma
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === 'object') {
    // {"value": 250, "unit": "kcal"} style
    const o = v as Record<string, unknown>;
    return num(o.value ?? o.amount ?? o.quantity ?? null);
  }
  return null;
}

/** Portion may arrive as text or as {"amount": 100, "unit": "g"}. */
function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .filter((x) => typeof x === 'string' || typeof x === 'number')
      .join(' ')
      .trim();
  }
  return String(v).trim();
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
  // {"items": {"Apple": {...}, "Banana": {...}}}: keys are the names.
  if (list && !Array.isArray(list) && typeof list === 'object') list = keyedToArray(list);
  // {"meal": {"items": [...]}}: one level deeper.
  if (!Array.isArray(list)) {
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) {
        list = v;
        break;
      }
      if (v && typeof v === 'object') {
        const inner = pick(v as Record<string, unknown>, 'items', 'foods', 'food_items', 'results');
        if (Array.isArray(inner)) {
          list = inner;
          break;
        }
      }
    }
  }
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
    // "85" means 85%, "7" means 7 out of 10; anything else is a 0-1 fraction.
    if (confidence > 10) confidence = confidence / 100;
    else if (confidence > 1) confidence = confidence / 10;
    items.push({
      name,
      portion: text(pick(it, 'portion', 'serving', 'quantity', 'amount')),
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

function keyedToArray(obj: object): unknown[] {
  return Object.entries(obj as Record<string, unknown>).map(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? { name: key, ...(value as Record<string, unknown>) }
      : { name: key },
  );
}

export function parseAnalysis(raw: string): AnalysisResult {
  return normalizeResult(extractJson(raw), raw);
}
