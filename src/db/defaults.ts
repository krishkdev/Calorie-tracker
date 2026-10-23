import { DEFAULT_MEAL_CUTOFFS } from '../lib/dates';
import type { ProviderConfig, Settings } from './types';

/** Gemini first: it has a free tier and reads photos. */
export const DEFAULT_PROVIDER: ProviderConfig = {
  kind: 'openai-compatible',
  preset: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  apiKey: '',
  model: 'gemini-3.8-flash',
  supportsVision: true,
  jsonMode: true,
};

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  provider: DEFAULT_PROVIDER,
  units: 'metric',
  theme: 'system',
  mealCutoffs: { ...DEFAULT_MEAL_CUTOFFS },
};
