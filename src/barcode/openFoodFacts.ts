import type { Macros, ProductInfo } from '../db/types';
import { cacheProduct, getCachedProduct } from '../db/repo';

const FIELDS =
  'code,product_name,product_name_en,brands,serving_size,serving_quantity,serving_quantity_unit,nutriments,image_front_small_url,quantity';

export class ProductNotFoundError extends Error {
  constructor(public barcode: string) {
    super('Product not found in Open Food Facts.');
    this.name = 'ProductNotFoundError';
  }
}

/** Raw subset of the Open Food Facts v2 product response that we read. */
export interface OFFResponse {
  status: number | string;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    serving_size?: string;
    serving_quantity?: number | string;
    serving_quantity_unit?: string;
    quantity?: string;
    image_front_small_url?: string;
    nutriments?: Record<string, number | string | undefined>;
  };
}

function num(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

interface PartialMacros {
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

function macrosFrom(
  n: Record<string, number | string | undefined>,
  suffix: '_100g' | '_serving',
): PartialMacros {
  let kcal = num(n[`energy-kcal${suffix}`]);
  if (kcal === undefined) {
    const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`]);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  return {
    kcal,
    proteinG: num(n[`proteins${suffix}`]),
    carbsG: num(n[`carbohydrates${suffix}`]),
    fatG: num(n[`fat${suffix}`]),
  };
}

function hasAny(m: PartialMacros): boolean {
  return Object.values(m).some((v) => v !== undefined);
}

/** Fill the gaps in a partial macro set: from a scaled reference, else from the 4/4/9 rule. */
function complete(m: PartialMacros, reference?: Macros, factor = 1): Macros {
  const proteinG = m.proteinG ?? (reference ? reference.proteinG * factor : 0);
  const carbsG = m.carbsG ?? (reference ? reference.carbsG * factor : 0);
  const fatG = m.fatG ?? (reference ? reference.fatG * factor : 0);
  const kcal =
    m.kcal ?? (reference ? reference.kcal * factor : proteinG * 4 + carbsG * 4 + fatG * 9);
  // Keep one decimal so scaling later stays accurate; screens round for display.
  return {
    kcal: round1(kcal),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Normalise an Open Food Facts response into our ProductInfo, or null if unusable. */
export function mapProduct(barcode: string, data: OFFResponse): ProductInfo | null {
  if (String(data.status) !== '1' || !data.product) return null;
  const p = data.product;
  const n = p.nutriments ?? {};
  const raw100 = macrosFrom(n, '_100g');
  if (!hasAny(raw100)) return null;
  const per100g = complete(raw100);

  const servingGrams = num(p.serving_quantity) || undefined;
  const servingUnit = /ml|l\b|cl/i.test(p.serving_quantity_unit ?? '') ? 'ml' : 'g';
  const rawServing = macrosFrom(n, '_serving');
  let perServing: Macros | undefined;
  if (hasAny(rawServing) || servingGrams) {
    // Missing per-serving fields come from the per-100 g values, never a flat 0.
    perServing = complete(
      rawServing,
      servingGrams ? per100g : undefined,
      servingGrams ? servingGrams / 100 : 1,
    );
  }

  const name = (p.product_name || p.product_name_en || '').trim() || `Product ${barcode}`;
  return {
    barcode: p.code || barcode,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    per100g,
    perServing,
    servingSize:
      p.serving_size?.trim() || (servingGrams ? `${servingGrams} ${servingUnit}` : undefined),
    servingGrams,
    servingUnit,
    imageUrl: p.image_front_small_url,
  };
}

/**
 * Look a barcode up, using the local cache first. Open Food Facts asks for a
 * descriptive User-Agent, which browsers cannot set, so we keep volume low:
 * one request per scan and a 7-day cache.
 */
export async function fetchProduct(
  barcode: string,
  opts: { signal?: AbortSignal } = {},
): Promise<ProductInfo> {
  const code = barcode.replace(/\D/g, '');
  if (!code) throw new ProductNotFoundError(barcode);

  const cached = await getCachedProduct(code);
  if (cached) {
    if (cached.product) return cached.product;
    throw new ProductNotFoundError(code);
  }

  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
    {
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    },
  );
  if (res.status === 404) {
    await cacheProduct(code, null);
    throw new ProductNotFoundError(code);
  }
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}. Try again in a moment.`);
  const data = (await res.json()) as OFFResponse;
  const product = mapProduct(code, data);
  await cacheProduct(code, product);
  if (!product) throw new ProductNotFoundError(code);
  return product;
}
