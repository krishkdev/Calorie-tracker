import { describe, expect, it } from 'vitest';
import type { FoodItem } from '../db/types';
import { entryTotals, itemMacros, sumMacros } from './totals';

const egg: FoodItem = {
  id: '1',
  name: 'Egg',
  portion: '1 large',
  quantity: 2,
  kcal: 78,
  proteinG: 6.3,
  carbsG: 0.6,
  fatG: 5.3,
  source: 'manual',
};

describe('itemMacros', () => {
  it('multiplies base values by quantity', () => {
    expect(itemMacros(egg)).toEqual({
      kcal: 156,
      proteinG: 12.6,
      carbsG: 1.2,
      fatG: 10.6,
      fiberG: 0,
    });
  });

  it('treats bad numbers as zero', () => {
    expect(itemMacros({ ...egg, quantity: Number.NaN })).toEqual({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
    });
  });
});

describe('sumMacros / entryTotals', () => {
  it('sums and rounds', () => {
    const toast: FoodItem = {
      ...egg,
      id: '2',
      name: 'Toast',
      quantity: 1,
      kcal: 80.4,
      proteinG: 2.74,
      carbsG: 15.01,
      fatG: 1,
    };
    expect(sumMacros([itemMacros(egg), itemMacros(toast)]).kcal).toBeCloseTo(236.4);
    expect(entryTotals([egg, { ...toast, fiberG: 1.25 }]).fiberG).toBe(1.3);
    expect(entryTotals([egg, toast])).toEqual({
      kcal: 236,
      proteinG: 15.3,
      carbsG: 16.2,
      fatG: 11.6,
      fiberG: 0,
    });
  });
});
