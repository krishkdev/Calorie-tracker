import type { PresetId, ProviderConfig } from '../db/types';

export interface Preset {
  id: PresetId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  /** Short badge shown next to the preset name. Both presets read images. */
  badge: 'Text + photos';
  /** One or two sentences that make image support and cost unambiguous. */
  note: string;
  /** Model IDs offered as suggestions; the field stays free text. */
  suggestedModels: string[];
  /** Substring used to pick relevant ids out of the provider's model list. */
  modelFilter: string;
  keyUrl: string;
  docsUrl: string;
  /** Extra request fields the provider understands (e.g. reasoning settings). */
  extraBody?: Record<string, unknown>;
}

export const PRESETS: Preset[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.8-flash',
    badge: 'Text + photos',
    note: 'Free tier available. Gemini Flash models read photos. Get a key from Google AI Studio in a minute.',
    suggestedModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'],
    modelFilter: 'gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    // Flash models "think" before answering. "low" is accepted by every Gemini 3.x
    // model (gemini-3.8-flash rejects "minimal"), and food estimates do not need more.
    // If a model still rejects it, chat() retries once without this field.
    extraBody: { reasoning_effort: 'low' },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-6-luna',
    badge: 'Text + photos',
    note: 'Pay as you go. Current OpenAI models read photos; a food photo costs a fraction of a cent.',
    suggestedModels: ['gpt-6-luna'],
    modelFilter: 'gpt',
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://developers.openai.com/api/docs/models',
  },
];

export const DEFAULT_PRESET: PresetId = 'gemini';

export function isPresetId(id: unknown): id is PresetId {
  return PRESETS.some((p) => p.id === id);
}

export function getPreset(id: PresetId | string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** A fresh ProviderConfig for a preset, keeping the user's key when switching. */
export function configFromPreset(id: PresetId, keepKey = ''): ProviderConfig {
  const p = getPreset(id);
  return {
    kind: 'openai-compatible',
    preset: p.id,
    baseUrl: p.baseUrl,
    apiKey: keepKey,
    model: p.defaultModel,
    supportsVision: true,
    jsonMode: true,
  };
}

/**
 * The single source of truth for "can this config make a request".
 * A proxy may hold the key on the user's behalf, so a proxy URL counts.
 */
export function isProviderConfigured(cfg: ProviderConfig): boolean {
  return Boolean(cfg.model?.trim()) && Boolean(cfg.apiKey?.trim() || cfg.proxyUrl?.trim());
}
