import type { ProviderConfig } from '../db/types';
import { buildUserMessage, JSON_RETRY_MESSAGE, SYSTEM_PROMPT } from './prompt';
import { parseAnalysis } from './parse';
import { getPreset } from './presets';
import {
  AIError,
  type AnalysisInput,
  type AnalysisResult,
  type ConnectionTest,
  type FoodAnalysisProvider,
} from './types';

const TIMEOUT_MS = 60_000;

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface ChatResponse {
  model?: string;
  choices?: { message?: { content?: string | ContentPart[] | null } }[];
  error?: { message?: string } | string;
}

/**
 * Adapter for any server that speaks the OpenAI Chat Completions format:
 * DeepSeek, OpenRouter, Gemini (OpenAI endpoint), OpenAI, Ollama, LM Studio, ...
 * Runs entirely in the browser; the key never leaves the device except to the provider.
 */
export class OpenAICompatibleProvider implements FoodAnalysisProvider {
  readonly kind = 'openai-compatible' as const;

  constructor(private readonly config: ProviderConfig) {}

  get supportsVision(): boolean {
    return this.config.supportsVision;
  }

  async analyze(input: AnalysisInput, opts?: { signal?: AbortSignal }): Promise<AnalysisResult> {
    if (input.image && !this.config.supportsVision) {
      throw new AIError(
        'no_vision',
        `The configured model (${this.config.model}) can't read images. Switch to a vision model in Settings or describe the food instead.`,
      );
    }
    if (!input.image && !input.text?.trim()) {
      throw new AIError('empty', 'Describe the food or add a photo first.');
    }

    const userText = buildUserMessage({
      text: input.text,
      hasImage: Boolean(input.image),
      units: input.units,
    });
    const userContent: string | ContentPart[] = input.image
      ? [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: input.image.dataUrl, detail: 'low' } },
        ]
      : userText;

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];

    const first = await this.chat(messages, opts?.signal);
    try {
      return parseAnalysis(first);
    } catch (e) {
      if (!(e instanceof AIError) || e.code !== 'bad_json') throw e;
      // One retry: show the model its own reply and ask for JSON only.
      const second = await this.chat(
        [
          ...messages,
          { role: 'assistant', content: first },
          { role: 'user', content: JSON_RETRY_MESSAGE },
        ],
        opts?.signal,
      );
      return parseAnalysis(second);
    }
  }

  async testConnection(opts?: { signal?: AbortSignal }): Promise<ConnectionTest> {
    try {
      const reply = await this.chat(
        [{ role: 'user', content: 'Reply with exactly the word OK and nothing else.' }],
        opts?.signal,
        { maxTokens: 20, jsonMode: false },
      );
      return {
        ok: true,
        model: this.config.model,
        message: `Connected. The model replied: "${reply.trim().slice(0, 40)}"`,
      };
    } catch (e) {
      const err = toAIError(e);
      return { ok: false, model: this.config.model, message: err.message };
    }
  }

  /** Performs one chat completion and returns the assistant text. */
  private async chat(
    messages: ChatMessage[],
    signal?: AbortSignal,
    overrides: { maxTokens?: number; jsonMode?: boolean } = {},
  ): Promise<string> {
    const { apiKey, model, preset } = this.config;
    if (!model.trim()) throw new AIError('no_api_key', 'Enter a model name in Settings.');
    if (getPreset(preset).needsKey && !apiKey.trim() && !this.config.proxyUrl) {
      throw new AIError('no_api_key', 'Add your API key in Settings to use AI logging.');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
    if (preset === 'openrouter') {
      headers['HTTP-Referer'] =
        typeof location !== 'undefined' ? location.origin : 'https://github.com';
      headers['X-Title'] = 'Calorie Tracker';
    }
    if (this.config.proxyUrl) headers['X-Target-Base-Url'] = trimSlash(this.config.baseUrl);

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: overrides.maxTokens ?? 1024,
    };
    if (overrides.jsonMode ?? this.config.jsonMode) body.response_format = { type: 'json_object' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    let res: Response;
    try {
      res = await fetch(
        `${trimSlash(this.config.proxyUrl || this.config.baseUrl)}/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } catch (e) {
      if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
      if (controller.signal.aborted)
        throw new AIError('aborted', 'The request timed out. Try again.');
      throw new AIError(
        'network_or_cors',
        networkHint(this.config),
        undefined,
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    const text = await res.text();
    if (!res.ok) throw httpError(res.status, text, this.config);

    let data: ChatResponse;
    try {
      data = JSON.parse(text) as ChatResponse;
    } catch {
      throw new AIError(
        'http',
        'The server returned something that is not JSON.',
        res.status,
        text.slice(0, 300),
      );
    }
    const content = data.choices?.[0]?.message?.content;
    const reply = Array.isArray(content)
      ? content.map((p) => (p.type === 'text' ? p.text : '')).join('')
      : (content ?? '');
    if (!reply.trim())
      throw new AIError(
        'empty',
        'The model returned an empty reply.',
        res.status,
        text.slice(0, 300),
      );
    return reply;
  }
}

function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function httpError(status: number, body: string, config: ProviderConfig): AIError {
  let detail = '';
  try {
    const j = JSON.parse(body) as ChatResponse;
    detail = typeof j.error === 'string' ? j.error : (j.error?.message ?? '');
  } catch {
    detail = body.slice(0, 200);
  }
  if (status === 401 || status === 403) {
    return new AIError(
      'unauthorized',
      `The provider rejected the API key (${status}). Check the key in Settings.`,
      status,
      detail,
    );
  }
  if (status === 429) {
    return new AIError(
      'rate_limited',
      `Rate limited by ${config.preset} (429). Wait a moment and try again.${detail ? ` ${detail}` : ''}`,
      status,
      detail,
    );
  }
  if (status === 404) {
    return new AIError(
      'http',
      `Not found (404). Check the base URL and that the model "${config.model}" exists.${detail ? ` ${detail}` : ''}`,
      status,
      detail,
    );
  }
  if (status === 400 && /response_format|json_object/i.test(detail)) {
    return new AIError(
      'http',
      'This server rejects JSON mode. Turn off "JSON mode" in Settings and try again.',
      status,
      detail,
    );
  }
  return new AIError(
    'http',
    `The provider returned an error (${status}).${detail ? ` ${detail}` : ''}`,
    status,
    detail,
  );
}

function networkHint(config: ProviderConfig): string {
  switch (config.preset) {
    case 'ollama':
      return 'Could not reach Ollama. Make sure it is running and started with OLLAMA_ORIGINS set to this site, e.g. OLLAMA_ORIGINS="*" ollama serve. From an https site, Ollama must also be reachable over https or on localhost in Chrome.';
    case 'lmstudio':
      return 'Could not reach LM Studio. Start the local server and enable CORS in its server settings.';
    case 'custom':
      return 'Could not reach the server. Check the base URL, your connection, and that the server allows browser requests (CORS). You can set a proxy URL in Settings as a workaround.';
    default:
      return 'Network error. Check your connection; if it persists the provider may be blocking browser requests (CORS). You can set a proxy URL in Settings as a workaround.';
  }
}

export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  return new AIError('http', e instanceof Error ? e.message : String(e));
}
