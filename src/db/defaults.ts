import { DEFAULT_MEAL_CUTOFFS } from '../lib/dates';
import type { ProviderConfig, ReminderSettings, Settings } from './types';

/** Gemini first: it has a free tier and reads photos. */
export const DEFAULT_PROVIDER: ProviderConfig = {
  kind: 'openai-compatible',
  preset: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  apiKey: '',
  model: 'gemini-3.5-flash-lite',
  supportsVision: true,
  jsonMode: true,
};

/** Off until the user opts in; the times are a sensible first guess. */
export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  times: { breakfast: '09:00', lunch: '13:00', dinner: '19:30' },
  skipIfLogged: true,
};

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  provider: DEFAULT_PROVIDER,
  units: 'metric',
  theme: 'system',
  mealCutoffs: { ...DEFAULT_MEAL_CUTOFFS },
  reminders: { ...DEFAULT_REMINDERS, times: { ...DEFAULT_REMINDERS.times } },
};
