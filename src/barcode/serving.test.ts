import { describe, expect, it } from 'vitest';
import type { ProductInfo } from '../db/types';
import { buildItem } from './serving';

const product: ProductInfo = {
  barcode: '123',
  name: 'Granola',
  brand: 'Acme',
  per100g: { kcal: 450, proteinG: 10, carbsG: 60, fatG: 18 },
  perServing: { kcal: 180, proteinG: 4, carbsG: 24, fatG: 7.2 },
  servingSize: '40 g',
  servingGrams: 40,
};

describe('buildItem', () => {
  it('scales servings', () => {
    const i = buildItem(product, 'serving', 1.5);
    expect(i.kcal).toBe(270);
    expect(i.proteinG).toBe(6);
    expect(i.portion).toBe('1.5 × 40 g');
    expect(i.barcode).toBe('123');
    expect(i.name).toBe('Granola (Acme)');
  });

  it('scales grams from per-100g', () => {
    const i = buildItem(product, 'grams', 50);
    expect(i.kcal).toBe(225);
    expect(i.carbsG).toBe(30);
    expect(i.portion).toBe('50 g');
  });
});
