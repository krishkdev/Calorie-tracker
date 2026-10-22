import type { FoodItem, ProductInfo } from '../db/types';
import { scaleMacros } from '../nutrition/totals';

export type ServingMode = 'serving' | 'grams';

/** Turn a product plus an amount into the item shape the review screen edits. */
export function buildItem(
  product: ProductInfo,
  mode: ServingMode,
  amount: number,
): Partial<FoodItem> & { name: string } {
  const base =
    mode === 'serving' && product.perServing
      ? product.perServing
      : scaleMacros(product.per100g, amount / 100);
  const m = mode === 'serving' ? scaleMacros(base, amount) : base;
  const portion =
    mode === 'serving'
      ? `${trim(amount)} × ${product.servingSize ?? 'serving'}`
      : `${trim(amount)} g`;
  return {
    name: product.brand ? `${product.name} (${product.brand})` : product.name,
    portion,
    quantity: 1,
    kcal: Math.round(m.kcal),
    proteinG: round1(m.proteinG),
    carbsG: round1(m.carbsG),
    fatG: round1(m.fatG),
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
