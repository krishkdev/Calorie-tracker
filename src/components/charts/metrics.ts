import { CHART } from './theme';

export type Metric = 'kcal' | 'protein' | 'fiber';

export const METRICS: Record<Metric, { label: string; unit: string; color: string }> = {
  kcal: { label: 'Calories', unit: 'kcal', color: CHART.primary },
  protein: { label: 'Protein', unit: 'g', color: 'var(--color-protein)' },
  fiber: { label: 'Fibre', unit: 'g', color: 'var(--color-fiber)' },
};
