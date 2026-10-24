import type { Activity, GoalType, Macros, Sex } from '../db/types';

export const ACTIVITY_MULTIPLIERS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, { label: string; hint: string }> = {
  sedentary: { label: 'Sedentary', hint: 'Desk job, little or no exercise' },
  light: { label: 'Lightly active', hint: 'Light exercise 1-3 days a week' },
  moderate: { label: 'Moderately active', hint: 'Moderate exercise 3-5 days a week' },
  active: { label: 'Active', hint: 'Hard exercise 6-7 days a week' },
  very_active: { label: 'Very active', hint: 'Physical job or training twice a day' },
};

/** Energy content of body tissue used for weekly rate -> daily deficit/surplus. */
const KCAL_PER_KG = 7700;

export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

export interface BodyInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

/** Mifflin-St Jeor basal metabolic rate. */
export function bmr({ sex, age, heightCm, weightKg }: BodyInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(body: BodyInput, activity: Activity): number {
  return bmr(body) * ACTIVITY_MULTIPLIERS[activity];
}

export interface CalorieTargetResult {
  kcal: number;
  /** True when the computed target was raised to the minimum safe floor. */
  clamped: boolean;
}

export function calorieTarget(
  maintenance: number,
  goal: GoalType,
  rateKgPerWeek: number,
  sex: Sex,
): CalorieTargetResult {
  const delta = (Math.abs(rateKgPerWeek) * KCAL_PER_KG) / 7;
  let kcal = maintenance;
  if (goal === 'lose') kcal = maintenance - delta;
  if (goal === 'gain') kcal = maintenance + delta;
  const floor = MIN_KCAL[sex];
  const clamped = kcal < floor;
  if (clamped) kcal = floor;
  return { kcal: Math.round(kcal / 10) * 10, clamped };
}

/**
 * Dietary Guidelines reference: 14 g of fibre per 1000 kcal. The result is
 * floored at 20 g so very low calorie targets still get a meaningful goal.
 */
export const FIBER_G_PER_1000_KCAL = 14;

export function fiberTarget(kcal: number): number {
  return Math.max(20, Math.round((FIBER_G_PER_1000_KCAL * kcal) / 1000));
}

const PROTEIN_G_PER_KG: Record<GoalType, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 };
const FAT_SHARE = 0.25;

/** Default macro split: protein by body weight, fat 25% of calories, carbs fill the rest. */
export function macroTargets(kcal: number, weightKg: number, goal: GoalType): Macros {
  let proteinG = PROTEIN_G_PER_KG[goal] * weightKg;
  // Protein can't exceed what the calorie budget allows (very low targets / heavy users).
  proteinG = Math.min(proteinG, (kcal * 0.45) / 4);
  const fatG = (kcal * FAT_SHARE) / 9;
  const carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);
  return {
    kcal,
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
    fiberG: fiberTarget(kcal),
  };
}

export interface TargetInput extends BodyInput {
  activity: Activity;
  goal: GoalType;
  rateKgPerWeek: number;
}

export interface ComputedTargets {
  bmr: number;
  tdee: number;
  targets: Macros;
  clamped: boolean;
}

export function computeTargets(input: TargetInput): ComputedTargets {
  const b = bmr(input);
  const t = b * ACTIVITY_MULTIPLIERS[input.activity];
  const { kcal, clamped } = calorieTarget(t, input.goal, input.rateKgPerWeek, input.sex);
  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    targets: macroTargets(kcal, input.weightKg, input.goal),
    clamped,
  };
}

export interface MacroPercents {
  protein: number;
  carbs: number;
  fat: number;
}

/** Fibre is not part of the percentage split; pass the current target to keep it, else it follows kcal. */
export function macrosFromPercents(kcal: number, p: MacroPercents, fiberG?: number): Macros {
  return {
    kcal,
    proteinG: Math.round((kcal * p.protein) / 100 / 4),
    carbsG: Math.round((kcal * p.carbs) / 100 / 4),
    fatG: Math.round((kcal * p.fat) / 100 / 9),
    fiberG: fiberG ?? fiberTarget(kcal),
  };
}

export function percentsFromMacros(m: Macros): MacroPercents {
  const total = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
  if (total <= 0) return { protein: 30, carbs: 45, fat: 25 };
  const protein = Math.round((m.proteinG * 4 * 100) / total);
  const fat = Math.round((m.fatG * 9 * 100) / total);
  return { protein, fat, carbs: 100 - protein - fat };
}

/** Ranges the metabolism formula is meaningful for; also blocks 0/empty fields. */
export function isPlausibleBody(b: { age: number; heightCm: number; weightKg: number }): boolean {
  return (
    b.age >= 10 &&
    b.age <= 120 &&
    b.heightCm >= 100 &&
    b.heightCm <= 250 &&
    b.weightKg >= 25 &&
    b.weightKg <= 400
  );
}
