import type { FoodItem, Macros, ProductInfo } from '../db/types';
import { scaleMacros } from '../nutrition/totals';

export type ServingMode = 'serving' | 'grams';

/** Turn a product plus an amount into the item shape the review screen edits. */
export function buildItem(
  product: ProductInfo,
  mode: ServingMode,
  amount: number,
): Partial<FoodItem> & { name: string } {
  const unit = product.servingUnit ?? 'g';
  let m: Macros;
  if (mode === 'serving') {
    // One serving: the product's own figures, else per-100 scaled by the
    // serving size, else (no serving data at all) treat a serving as 100 g.
    const one =
      product.perServing ??
      (product.servingGrams
        ? scaleMacros(product.per100g, product.servingGrams / 100)
        : product.per100g);
    m = scaleMacros(one, amount);
  } else {
    m = scaleMacros(product.per100g, amount / 100);
  }
  const portion =
    mode === 'serving'
      ? `${trim(amount)} × ${product.servingSize ?? 'serving'}`
      : `${trim(amount)} ${unit}`;
  return {
    name: product.brand ? `${product.name} (${product.brand})` : product.name,
    portion,
    quantity: 1,
    kcal: Math.round(m.kcal),
    proteinG: round1(m.proteinG),
    carbsG: round1(m.carbsG),
    fatG: round1(m.fatG),
    fiberG: round1(m.fiberG ?? 0),
    source: 'barcode',
    barcode: product.barcode,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
