import { describe, expect, it } from 'vitest';
import { mapProduct, type OFFResponse } from './openFoodFacts';

const base: OFFResponse = {
  status: 1,
  product: {
    code: '123',
    product_name: 'Peanut Butter',
    brands: 'Acme, Other',
    serving_size: '32 g',
    serving_quantity: '32',
    nutriments: {
      'energy-kcal_100g': 588,
      proteins_100g: 25,
      carbohydrates_100g: 20,
      fat_100g: 50,
    },
  },
};

describe('mapProduct', () => {
  it('maps per-100g values and derives per-serving from serving_quantity', () => {
    const p = mapProduct('123', base)!;
    expect(p.name).toBe('Peanut Butter');
    expect(p.brand).toBe('Acme');
    expect(p.per100g).toEqual({ kcal: 588, proteinG: 25, carbsG: 20, fatG: 50, fiberG: 0 });
    expect(p.servingGrams).toBe(32);
    expect(p.servingSize).toBe('32 g');
    expect(p.perServing).toEqual({ kcal: 188.2, proteinG: 8, carbsG: 6.4, fatG: 16, fiberG: 0 });
  });

  it('reads fibre and scales it to the serving', () => {
    const p = mapProduct('123', {
      ...base,
      product: {
        ...base.product,
        nutriments: { ...base.product!.nutriments, fiber_100g: 6 },
      },
    })!;
    expect(p.per100g.fiberG).toBe(6);
    expect(p.perServing?.fiberG).toBe(1.9);
  });

  it('fills missing per-serving fields from the per-100g values', () => {
    const p = mapProduct('123', {
      ...base,
      product: {
        ...base.product,
        nutriments: { ...base.product!.nutriments, 'energy-kcal_serving': 190 },
      },
    })!;
    expect(p.perServing).toEqual({ kcal: 190, proteinG: 8, carbsG: 6.4, fatG: 16, fiberG: 0 });
  });

  it('estimates energy from macros when the product has none', () => {
    const p = mapProduct('123', {
      ...base,
      product: {
        ...base.product,
        nutriments: { proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 },
      },
    })!;
    expect(p.per100g.kcal).toBe(165);
  });

  it('labels millilitre servings', () => {
    const p = mapProduct('123', {
      ...base,
      product: {
        ...base.product,
        serving_size: undefined,
        serving_quantity: 330,
        serving_quantity_unit: 'ml',
      },
    })!;
    expect(p.servingUnit).toBe('ml');
    expect(p.servingSize).toBe('330 ml');
  });

  it('prefers explicit per-serving fields', () => {
    const p = mapProduct('123', {
      ...base,
      product: {
        ...base.product,
        nutriments: {
          ...base.product!.nutriments,
          'energy-kcal_serving': 190,
          proteins_serving: 8.2,
          carbohydrates_serving: 6,
          fat_serving: 16.1,
        },
      },
    })!;
    expect(p.perServing).toEqual({ kcal: 190, proteinG: 8.2, carbsG: 6, fatG: 16.1, fiberG: 0 });
  });

  it('falls back to kJ energy', () => {
    const p = mapProduct('123', {
      status: 1,
      product: {
        product_name: 'X',
        nutriments: { energy_100g: 1000, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 3 },
      },
    })!;
    expect(p.per100g.kcal).toBe(239);
    expect(p.perServing).toBeUndefined();
  });

  it('returns null for not found or missing nutrition', () => {
    expect(mapProduct('1', { status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(
      mapProduct('1', { status: 1, product: { product_name: 'Mystery', nutriments: {} } }),
    ).toBeNull();
  });

  it('falls back to a generic name', () => {
    const p = mapProduct('999', {
      status: 1,
      product: { nutriments: { 'energy-kcal_100g': 10 } },
    })!;
    expect(p.name).toBe('Product 999');
    expect(p.barcode).toBe('999');
  });
});
