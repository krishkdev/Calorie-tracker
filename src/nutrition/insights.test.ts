import { describe, expect, it } from 'vitest';
import type { Macros } from '../db/types';
import { DEFAULT_MEAL_CUTOFFS } from '../lib/dates';
import {
  dayInsights,
  dayNudge,
  dayPhase,
  energySplit,
  foodSuggestion,
  nutrientStatus,
  periodSummary,
  type DayNutrition,
} from './insights';

/** Krish's targets from the screenshot, plus the derived fibre goal. */
const target: Macros = { kcal: 1850, proteinG: 208, carbsG: 139, fatG: 51, fiberG: 26 };
/** 23 Oct 2026 as logged: calories on target, protein short, carbs and fat over, no fibre. */
const yesterday: Macros = { kcal: 1868, proteinG: 178, carbsG: 161, fatG: 57 };

describe('nutrientStatus', () => {
  it('reports what is left and what is over, treating missing fibre as 0', () => {
    const s = Object.fromEntries(nutrientStatus(yesterday, target).map((x) => [x.key, x]));
    expect(s.proteinG).toMatchObject({ eaten: 178, target: 208, left: 30, over: 0 });
    expect(s.carbsG).toMatchObject({ left: 0, over: 22 });
    expect(s.fatG).toMatchObject({ over: 6 });
    expect(s.fiberG).toMatchObject({ eaten: 0, target: 26, left: 26 });
  });
});

describe('energySplit', () => {
  it('returns whole percents that add up to 100', () => {
    const split = energySplit(yesterday)!;
    expect(split.protein + split.carbs + split.fat).toBe(100);
    expect(split.protein).toBe(38);
    expect(energySplit({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull();
  });
});

describe('dayInsights', () => {
  it('says nothing for an empty day or missing targets', () => {
    expect(dayInsights({ consumed: yesterday, target, entryCount: 0, isToday: false })).toEqual([]);
    expect(
      dayInsights({
        consumed: yesterday,
        target: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        entryCount: 3,
        isToday: false,
      }),
    ).toEqual([]);
  });

  it("explains yesterday's log: calories fine, mix off, no fibre", () => {
    const ids = dayInsights({ consumed: yesterday, target, entryCount: 4, isToday: false }).map(
      (i) => i.id,
    );
    expect(ids).toEqual(['kcal-on-target', 'balance-off', 'fiber-none', 'split']);
  });

  it('names the filler macros in the balance line', () => {
    const line = dayInsights({ consumed: yesterday, target, entryCount: 4, isToday: false }).find(
      (i) => i.id === 'balance-off',
    )!;
    expect(line.text).toBe(
      'Calories were fine but the mix was off: 22 g carbs and 6 g fat stood in for 30 g of protein.',
    );
  });

  it('celebrates a day that hit everything', () => {
    const good: Macros = { kcal: 1840, proteinG: 210, carbsG: 135, fatG: 50, fiberG: 30 };
    const tones = dayInsights({ consumed: good, target, entryCount: 3, isToday: false }).map(
      (i) => i.tone,
    );
    expect(tones.filter((t) => t === 'warn')).toHaveLength(0);
    expect(tones.filter((t) => t === 'good')).toHaveLength(3);
  });

  it('does not call a day short while it is still in progress', () => {
    const lunch: Macros = { kcal: 900, proteinG: 90, carbsG: 70, fatG: 25, fiberG: 10 };
    const ids = dayInsights({ consumed: lunch, target, entryCount: 2, isToday: true }).map(
      (i) => i.id,
    );
    expect(ids).not.toContain('kcal-under');
    expect(ids).not.toContain('protein-short');
    expect(ids).not.toContain('fiber-short');
  });

  it('flags going over calories', () => {
    const over: Macros = { kcal: 2300, proteinG: 210, carbsG: 200, fatG: 80, fiberG: 30 };
    const first = dayInsights({ consumed: over, target, entryCount: 3, isToday: true })[0];
    expect(first).toMatchObject({ id: 'kcal-over', tone: 'warn' });
    expect(first.text).toContain('450 kcal over target so far');
  });
});

describe('dayPhase', () => {
  it('follows the meal cutoffs', () => {
    expect(dayPhase(8, DEFAULT_MEAL_CUTOFFS)).toBe('morning');
    expect(dayPhase(11, DEFAULT_MEAL_CUTOFFS)).toBe('midday');
    expect(dayPhase(17, DEFAULT_MEAL_CUTOFFS)).toBe('afternoon');
    expect(dayPhase(21, DEFAULT_MEAL_CUTOFFS)).toBe('evening');
  });
});

describe('foodSuggestion', () => {
  it('picks the smallest single food that covers the gap', () => {
    expect(foodSuggestion('protein', 30)).toBe('a chicken breast (~31 g)');
    expect(foodSuggestion('protein', 5)).toBe('a boiled egg (~6 g)');
    expect(foodSuggestion('fiber', 12)).toBe('a cup of lentils or beans (~15 g)');
  });

  it('multiplies the biggest food when nothing single covers it', () => {
    expect(foodSuggestion('protein', 60)).toBe('2 × a tin of tuna (~64 g)');
  });
});

describe('dayNudge', () => {
  const cutoffs = DEFAULT_MEAL_CUTOFFS;

  it('stays quiet in the morning and without targets', () => {
    expect(dayNudge({ consumed: yesterday, target, hour: 7, cutoffs })).toBeNull();
    expect(
      dayNudge({
        consumed: yesterday,
        target: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        hour: 20,
        cutoffs,
      }),
    ).toBeNull();
  });

  it('tells the user what is left and suggests a food in the evening', () => {
    const n = dayNudge({ consumed: yesterday, target, hour: 21, cutoffs })!;
    expect(n.tone).toBe('warn');
    expect(n.text).toBe(
      'Still 30 g protein and 26 g fibre to go today. A chicken breast (~31 g) gets you there on protein. Already 18 kcal over, so keep it lean.',
    );
  });

  it('points at the meals still to come earlier in the day', () => {
    const lunch: Macros = { kcal: 900, proteinG: 90, carbsG: 70, fatG: 25, fiberG: 10 };
    const n = dayNudge({ consumed: lunch, target, hour: 12, cutoffs })!;
    expect(n.text).toBe(
      'Still 118 g protein and 16 g fibre to go today. Lunch and dinner can cover it. 950 kcal left.',
    );
  });

  it('skips the snack hint when the gap is a whole meal', () => {
    const lunch: Macros = { kcal: 900, proteinG: 90, carbsG: 70, fatG: 25, fiberG: 10 };
    const n = dayNudge({ consumed: lunch, target, hour: 17, cutoffs })!;
    expect(n.text).toBe(
      'Still 118 g protein and 16 g fibre to go today. Dinner can cover it. 950 kcal left.',
    );
  });

  it('confirms when both are covered', () => {
    const done: Macros = { kcal: 1800, proteinG: 210, carbsG: 130, fatG: 50, fiberG: 28 };
    expect(dayNudge({ consumed: done, target, hour: 20, cutoffs })).toMatchObject({
      id: 'nudge-done',
      tone: 'good',
    });
  });
});

describe('periodSummary', () => {
  const day = (dayKey: string, kcal: number, protein: number, fiber: number): DayNutrition => ({
    dayKey,
    kcal,
    protein,
    carbs: 100,
    fat: 50,
    fiber,
    logged: kcal > 0,
  });

  it('averages logged days only and counts goals hit', () => {
    const s = periodSummary(
      [
        day('2026-10-20', 1800, 210, 30),
        day('2026-10-21', 0, 0, 0),
        day('2026-10-22', 2200, 150, 0),
        day('2026-10-23', 1868, 178, 0),
      ],
      target,
    );
    expect(s.loggedDays).toBe(3);
    expect(s.totalDays).toBe(4);
    expect(s.avg.kcal).toBe(1956);
    expect(s.avg.protein).toBe(179);
    expect(s.hit).toEqual({ kcal: 2, protein: 1, fiber: 1 });
    expect(s.fiberTrackedDays).toBe(1);
  });

  it('handles an empty range', () => {
    const s = periodSummary([day('2026-10-23', 0, 0, 0)], target);
    expect(s.loggedDays).toBe(0);
    expect(s.avg.kcal).toBe(0);
  });
});
