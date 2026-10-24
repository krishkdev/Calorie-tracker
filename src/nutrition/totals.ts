import type { FoodItem, Macros } from '../db/types';

export const ZERO_MACROS: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

/** Fibre of a macro set, treating the pre-fibre `undefined` as 0. */
export function fiberOf(m: Pick<Macros, 'fiberG'>): number {
  return num(m.fiberG);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Effective nutrition for an item = base values × quantity. */
export function itemMacros(
  item: Pick<FoodItem, 'quantity' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>,
): Macros {
  const q = num(item.quantity) || 0;
  return {
    kcal: num(item.kcal) * q,
    proteinG: num(item.proteinG) * q,
    carbsG: num(item.carbsG) * q,
    fatG: num(item.fatG) * q,
    fiberG: num(item.fiberG) * q,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + num(m.kcal),
      proteinG: acc.proteinG + num(m.proteinG),
      carbsG: acc.carbsG + num(m.carbsG),
      fatG: acc.fatG + num(m.fatG),
      fiberG: (acc.fiberG ?? 0) + num(m.fiberG),
    }),
    { ...ZERO_MACROS },
  );
}

export function entryTotals(items: FoodItem[]): Macros {
  return roundMacros(sumMacros(items.map(itemMacros)));
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    proteinG: Math.round(m.proteinG * 10) / 10,
    carbsG: Math.round(m.carbsG * 10) / 10,
    fatG: Math.round(m.fatG * 10) / 10,
    fiberG: Math.round(num(m.fiberG) * 10) / 10,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    proteinG: m.proteinG * factor,
    carbsG: m.carbsG * factor,
    fatG: m.fatG * factor,
    fiberG: num(m.fiberG) * factor,
  };
}
