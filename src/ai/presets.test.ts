import { describe, expect, it } from 'vitest';
import { configFromPreset, getPreset, isPresetId, isProviderConfigured, PRESETS } from './presets';

describe('presets', () => {
  it('offers exactly Gemini and OpenAI, both with photo support', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['gemini', 'openai']);
    expect(PRESETS.every((p) => p.badge === 'Text + photos')).toBe(true);
  });

  it('falls back to Gemini for unknown ids', () => {
    expect(getPreset('deepseek').id).toBe('gemini');
    expect(isPresetId('ollama')).toBe(false);
    expect(isPresetId('openai')).toBe(true);
  });

  it('builds a fresh config for a preset (the form starts with an empty key)', () => {
    const c = configFromPreset('openai');
    expect(c).toMatchObject({
      preset: 'openai',
      apiKey: '',
      model: 'gpt-6-luna',
      supportsVision: true,
    });
  });

  it('counts a proxy as configured, and an empty key as not', () => {
    const base = configFromPreset('gemini');
    expect(isProviderConfigured(base)).toBe(false);
    expect(isProviderConfigured({ ...base, apiKey: ' AIza ' })).toBe(true);
    expect(isProviderConfigured({ ...base, proxyUrl: 'https://proxy.example/v1' })).toBe(true);
    expect(isProviderConfigured({ ...base, apiKey: 'k', model: ' ' })).toBe(false);
  });
});
