import type { FoodItem } from '../db/types';
import type { AnalysisResult } from './types';

/** Convert model output into the editable item shape used by the review screen. */
export function itemsFromAnalysis(result: AnalysisResult): Partial<FoodItem>[] {
  return result.items.map((i) => ({
    name: i.name,
    portion: i.portion,
    quantity: 1,
    kcal: i.calories,
    proteinG: i.protein_g,
    carbsG: i.carbs_g,
    fatG: i.fat_g,
    fiberG: i.fiber_g,
    confidence: i.confidence,
    source: 'ai' as const,
  }));
}
