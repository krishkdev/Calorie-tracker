import { DEFAULT_MEAL_CUTOFFS } from '../lib/dates';
import type { ProviderConfig, Settings } from './types';

export const DEFAULT_PROVIDER: ProviderConfig = {
  kind: 'openai-compatible',
  preset: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  supportsVision: false,
  jsonMode: true,
};

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  provider: DEFAULT_PROVIDER,
  units: 'metric',
  theme: 'system',
  mealCutoffs: { ...DEFAULT_MEAL_CUTOFFS },
};
