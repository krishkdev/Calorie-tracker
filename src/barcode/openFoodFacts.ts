import type { Macros, ProductInfo } from '../db/types';
import { cacheProduct, getCachedProduct } from '../db/repo';

const FIELDS =
  'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments,image_front_small_url,quantity';

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

function macrosFrom(
  n: Record<string, number | string | undefined>,
  suffix: '_100g' | '_serving',
): Macros | undefined {
  let kcal = num(n[`energy-kcal${suffix}`]);
  if (kcal === undefined) {
    const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`]);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  const proteinG = num(n[`proteins${suffix}`]);
  const carbsG = num(n[`carbohydrates${suffix}`]);
  const fatG = num(n[`fat${suffix}`]);
  if (kcal === undefined && proteinG === undefined && carbsG === undefined && fatG === undefined)
    return undefined;
  return {
    kcal: Math.round(kcal ?? 0),
    proteinG: round1(proteinG ?? 0),
    carbsG: round1(carbsG ?? 0),
    fatG: round1(fatG ?? 0),
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
  const per100g = macrosFrom(n, '_100g');
  if (!per100g) return null;

  const servingGrams = num(p.serving_quantity);
  let perServing = macrosFrom(n, '_serving');
  if (!perServing && servingGrams) {
    perServing = {
      kcal: Math.round((per100g.kcal * servingGrams) / 100),
      proteinG: round1((per100g.proteinG * servingGrams) / 100),
      carbsG: round1((per100g.carbsG * servingGrams) / 100),
      fatG: round1((per100g.fatG * servingGrams) / 100),
    };
  }

  const name = (p.product_name || p.product_name_en || '').trim() || `Product ${barcode}`;
  return {
    barcode: p.code || barcode,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    per100g,
    perServing,
    servingSize: p.serving_size?.trim() || (servingGrams ? `${servingGrams} g` : undefined),
    servingGrams: servingGrams || undefined,
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
