import type { PresetId, ProviderConfig } from '../db/types';

/** Whether the preset's default model can read images. */
export type VisionSupport = 'yes' | 'no' | 'depends';

export interface Preset {
  id: PresetId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  vision: VisionSupport;
  /** Short badge shown next to the preset name. */
  badge: 'Text + photos' | 'Text only' | 'Depends on model';
  /** One or two sentences that make image support unambiguous. */
  imageNote: string;
  /** Model IDs offered as suggestions; the field stays free text. */
  suggestedModels: string[];
  needsKey: boolean;
  jsonMode: boolean;
  keyUrl?: string;
  docsUrl: string;
  corsNote?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    vision: 'no',
    badge: 'Text only',
    imageNote:
      'DeepSeek models cannot read images, so photo logging is unavailable. Typed descriptions work great and are very cheap.',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    needsKey: true,
    jsonMode: true,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://api-docs.deepseek.com/',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemma-4-31b-it:free',
    vision: 'depends',
    badge: 'Depends on model',
    imageNote:
      'One key for hundreds of models, including free ones (IDs ending in ":free"). Photos work only with a vision model, e.g. google/gemma-4-31b-it:free. Free models are limited to about 20 requests a minute and 50 a day (1,000 a day after buying $10 of credit once).',
    suggestedModels: [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3.5-super-vl:free',
      'openai/gpt-6-luna',
      'google/gemini-3.8-flash',
    ],
    needsKey: true,
    jsonMode: true,
    keyUrl: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/models?q=free',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.8-flash',
    vision: 'yes',
    badge: 'Text + photos',
    imageNote:
      'Gemini Flash models read images. Google offers a free tier for Flash models; check the quota shown in AI Studio for your key.',
    suggestedModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'],
    needsKey: true,
    jsonMode: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-6-luna',
    vision: 'yes',
    badge: 'Text + photos',
    imageNote:
      'Current OpenAI models read images. Pay as you go; a food photo costs a fraction of a cent.',
    suggestedModels: ['gpt-6-luna'],
    needsKey: true,
    jsonMode: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://developers.openai.com/api/docs/models',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'gemma3',
    vision: 'depends',
    badge: 'Depends on model',
    imageNote:
      'Runs on your own computer, no key needed. Photos work with vision models such as gemma3, qwen2.5vl or llava; text-only models (llama3, mistral, deepseek-r1) cannot read images.',
    suggestedModels: ['gemma3', 'qwen2.5vl', 'llava', 'llama3.2'],
    needsKey: false,
    jsonMode: true,
    docsUrl: 'https://docs.ollama.com/api/openai-compatibility',
    corsNote:
      'Start Ollama with OLLAMA_ORIGINS set so the browser may call it, e.g. OLLAMA_ORIGINS="*" ollama serve. From an https site, only Chrome allows calls to http://localhost.',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    vision: 'depends',
    badge: 'Depends on model',
    imageNote:
      'Runs on your own computer, no key needed. Load a vision-capable model in LM Studio to use photos; otherwise it is text only.',
    suggestedModels: [],
    needsKey: false,
    jsonMode: false,
    docsUrl: 'https://lmstudio.ai/docs/app/api/endpoints/openai',
    corsNote: 'In LM Studio, open the local server settings and enable CORS.',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    defaultModel: '',
    vision: 'depends',
    badge: 'Depends on model',
    imageNote:
      'Any server that speaks the OpenAI Chat Completions format (Groq, Together, Mistral, vLLM, llama.cpp, ...). Tick "model can read images" only if the model you enter supports image input.',
    suggestedModels: [],
    needsKey: false,
    jsonMode: false,
    docsUrl: 'https://github.com/krishkdev/Calorie-tracker/blob/main/docs/PROVIDERS.md',
    corsNote:
      'The server must allow browser requests (CORS), or you can route through a proxy URL below.',
  },
];

export function getPreset(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
}

/** A fresh ProviderConfig for a preset, keeping the user's key when switching. */
export function configFromPreset(id: PresetId, keepKey = ''): ProviderConfig {
  const p = getPreset(id);
  return {
    kind: 'openai-compatible',
    preset: id,
    baseUrl: p.baseUrl,
    apiKey: keepKey,
    model: p.defaultModel,
    supportsVision:
      p.vision === 'yes' || (p.vision === 'depends' && looksLikeVisionModel(p.defaultModel)),
    jsonMode: p.jsonMode,
  };
}

/** Heuristic used to pre-tick the vision box when the user types a model name. */
export function looksLikeVisionModel(model: string): boolean {
  const m = model.toLowerCase();
  if (!m) return false;
  if (
    /deepseek|deepseek-chat|deepseek-reasoner|r1\b|mistral-(small|large|medium)(?!.*vision)|llama3(\.\d)?:|^llama3|text-only/.test(
      m,
    )
  )
    return false;
  return /vision|-vl|vl-|llava|gemma3|gemma-3|gemma4|gemma-4|gemini|gpt-4o|gpt-4\.1|gpt-5|gpt-6|o4|claude|pixtral|qwen.*vl|minicpm-v|moondream|omni|nemotron.*vl|luna/.test(
    m,
  );
}
