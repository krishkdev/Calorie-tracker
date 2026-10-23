import type { MealType } from '../db/types';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_ORDER as string[]).includes(value);
}

/** Reads a meal from a query string or router state; anything unknown is ignored. */
export function mealFromParam(value: string | null | undefined): MealType | undefined {
  return isMealType(value) ? value : undefined;
}
