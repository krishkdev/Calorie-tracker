import { describe, expect, it } from 'vitest';
import {
  bmr,
  calorieTarget,
  computeTargets,
  macroTargets,
  macrosFromPercents,
  percentsFromMacros,
  tdee,
} from './tdee';

const male30 = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 80 };
const female25 = { sex: 'female' as const, age: 25, heightCm: 165, weightKg: 60 };

describe('bmr (Mifflin-St Jeor)', () => {
  it('matches known values', () => {
    expect(bmr(male30)).toBe(1780); // 800 + 1125 - 150 + 5
    expect(bmr(female25)).toBeCloseTo(1345.25, 2); // 600 + 1031.25 - 125 - 161
  });
});

describe('tdee', () => {
  it('applies the activity multiplier', () => {
    expect(tdee(male30, 'sedentary')).toBeCloseTo(2136, 0);
    expect(tdee(male30, 'moderate')).toBeCloseTo(2759, 0);
  });
});

describe('calorieTarget', () => {
  it('subtracts a daily deficit for weight loss and rounds to 10', () => {
    const { kcal, clamped } = calorieTarget(2759, 'lose', 0.5, 'male');
    // 0.5 kg/week * 7700 / 7 = 550 kcal/day
    expect(kcal).toBe(2210);
    expect(clamped).toBe(false);
  });

  it('adds a surplus for gaining', () => {
    expect(calorieTarget(2000, 'gain', 0.25, 'female').kcal).toBe(2280);
  });

  it('keeps maintenance unchanged', () => {
    expect(calorieTarget(2004, 'maintain', 0, 'male').kcal).toBe(2000);
  });

  it('clamps to the safe floor', () => {
    const r = calorieTarget(1600, 'lose', 1, 'female');
    expect(r.kcal).toBe(1200);
    expect(r.clamped).toBe(true);
  });
});

describe('macroTargets', () => {
  it('uses protein per kg, 25% fat, carbs as remainder', () => {
    const m = macroTargets(2200, 80, 'lose');
    expect(m.proteinG).toBe(160); // 2.0 g/kg
    expect(m.fatG).toBe(61); // 2200*0.25/9
    // carbs = (2200 - 160*4 - 61.1*9)/4
    expect(m.carbsG).toBeGreaterThan(250);
    expect(m.carbsG).toBeLessThan(260);
    expect(m.kcal).toBe(2200);
  });

  it('caps protein for very low calorie budgets', () => {
    const m = macroTargets(1200, 120, 'lose');
    expect(m.proteinG).toBeLessThanOrEqual(135);
    expect(m.carbsG).toBeGreaterThanOrEqual(0);
  });
});

describe('computeTargets', () => {
  it('chains the pieces', () => {
    const r = computeTargets({ ...male30, activity: 'moderate', goal: 'lose', rateKgPerWeek: 0.5 });
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(2759);
    expect(r.targets.kcal).toBe(2210);
    expect(r.clamped).toBe(false);
  });
});

describe('percent conversions', () => {
  it('round-trips roughly', () => {
    const m = macrosFromPercents(2000, { protein: 30, carbs: 45, fat: 25 });
    expect(m).toEqual({ kcal: 2000, proteinG: 150, carbsG: 225, fatG: 56, fiberG: 28 });
    const p = percentsFromMacros(m);
    expect(p.protein).toBe(30);
    expect(p.carbs + p.protein + p.fat).toBe(100);
  });
});
