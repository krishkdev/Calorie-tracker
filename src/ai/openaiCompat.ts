import type { ProviderConfig } from '../db/types';
import { buildUserMessage, JSON_RETRY_MESSAGE, SYSTEM_PROMPT } from './prompt';
import { parseAnalysis } from './parse';
import { getPreset, isProviderConfigured, type Preset } from './presets';
import {
  AIError,
  type AnalysisInput,
  type AnalysisResult,
  type ConnectionTest,
  type FoodAnalysisProvider,
  type ProbeResult,
} from './types';

/** Food analysis can involve a photo plus model "thinking"; give it room. */
const ANALYZE_TIMEOUT_MS = 45_000;
/** The connection test only lists models, so it should be quick. */
const TEST_TIMEOUT_MS = 20_000;
/** Each diagnostics probe gets this long. */
const PROBE_TIMEOUT_MS = 30_000;
/** Thinking models count their reasoning against this budget; keep it generous. */
const MAX_TOKENS = 4096;
/** Transient statuses worth one automatic retry. */
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAY_MS = 2000;

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface ChatResponse {
  model?: string;
  choices?: { message?: { content?: string | ContentPart[] | null }; finish_reason?: string }[];
}

interface ModelsResponse {
  data?: { id?: string }[];
}

/**
 * Adapter for servers that speak the OpenAI Chat Completions format
 * (Google Gemini's OpenAI endpoint and OpenAI itself). Runs entirely in the
 * browser; the key never leaves the device except to the provider.
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

  /**
   * Verifies the key by listing models (no generation, so no waiting on a
   * thinking model) and reports whether the chosen model is on the list.
   */
  async testConnection(opts?: { signal?: AbortSignal }): Promise<ConnectionTest> {
    const { model } = this.config;
    try {
      this.assertConfigured();
      const res = await this.request('/models', { method: 'GET' }, opts?.signal, TEST_TIMEOUT_MS);
      const text = await res.text();
      if (!res.ok) throw httpError(res.status, text, this.config);
      const ids = parseModelIds(text);
      if (ids.length === 0) {
        // An empty or non-JSON model list (e.g. a proxy's HTML fallback) proves
        // nothing, so fall back to a real, small generation.
        const reply = await this.chat(
          [{ role: 'user', content: 'Reply with exactly the word OK and nothing else.' }],
          opts?.signal,
        );
        return {
          ok: true,
          model,
          message: `Connected. ${model} replied: "${reply.trim().slice(0, 40)}"`,
        };
      }
      if (ids.includes(model.trim())) {
        return { ok: true, model, message: `Connected. Your key works and ${model} is available.` };
      }
      const preset = getPreset(this.config.preset);
      return {
        ok: false,
        model,
        message: `Your key works, but "${model}" is not in its model list. Try one of: ${suggestModels(ids, preset).join(', ')}.`,
      };
    } catch (e) {
      return { ok: false, model, message: toAIError(e).message };
    }
  }

  /**
   * Timed probes that isolate why a request might hang: the model list, a bare
   * one-word reply with no extras, and the same reply with the app's full
   * request options. Each probe has its own short timeout.
   */
  async diagnose(opts?: { signal?: AbortSignal }): Promise<ProbeResult[]> {
    const results: ProbeResult[] = [];
    const preset = getPreset(this.config.preset);
    const probe = async (label: string, run: () => Promise<string>) => {
      const started = Date.now();
      try {
        const detail = await run();
        results.push({ label, ok: true, ms: Date.now() - started, detail });
      } catch (e) {
        results.push({ label, ok: false, ms: Date.now() - started, detail: toAIError(e).message });
      }
    };
    const ask = async (body: Record<string, unknown>) => {
      const res = await this.request(
        '/chat/completions',
        { method: 'POST', body: JSON.stringify({ model: this.config.model.trim(), ...body }) },
        opts?.signal,
        PROBE_TIMEOUT_MS,
      );
      const text = await res.text();
      if (!res.ok) throw httpError(res.status, text, this.config);
      const data = JSON.parse(text) as ChatResponse;
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      const reply = (
        Array.isArray(content)
          ? content.map((p) => (p.type === 'text' ? p.text : '')).join('')
          : (content ?? '')
      ).trim();
      if (!reply) {
        const why = choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : '';
        throw new AIError('bad_json', `Replied with no text${why}.`, res.status, text);
      }
      return `reply: ${JSON.stringify(reply.slice(0, 40))}`;
    };
    const minimal = [{ role: 'user', content: 'Reply with exactly the word OK and nothing else.' }];

    this.assertConfigured();
    await probe('List models', async () => {
      const res = await this.request('/models', { method: 'GET' }, opts?.signal, PROBE_TIMEOUT_MS);
      const text = await res.text();
      if (!res.ok) throw httpError(res.status, text, this.config);
      const ids = parseModelIds(text);
      return `${ids.length} models${ids.includes(this.config.model.trim()) ? ', includes yours' : ', yours NOT listed'}`;
    });
    await probe('Bare reply (no options)', () => ask({ messages: minimal, max_tokens: 1024 }));
    if (preset.extraBody) {
      await probe('Reply with reasoning setting', () =>
        ask({ messages: minimal, max_tokens: 1024, ...preset.extraBody }),
      );
    }
    await probe('Reply with JSON mode', () =>
      ask({
        messages: [
          { role: 'user', content: 'Reply with the JSON object {"ok":true} and nothing else.' },
        ],
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    );
    await probe('Reply with all app options', () =>
      ask({
        messages: [
          { role: 'user', content: 'Reply with the JSON object {"ok":true} and nothing else.' },
        ],
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        ...(preset.extraBody ?? {}),
        ...(this.config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    );
    return results;
  }

  private assertConfigured(): void {
    if (!this.config.model.trim())
      throw new AIError('no_api_key', 'Enter a model name in Settings.');
    if (!isProviderConfigured(this.config)) {
      throw new AIError('no_api_key', 'Add your API key in Settings to use AI logging.');
    }
  }

  /** Performs one chat completion and returns the assistant text. */
  private async chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
    this.assertConfigured();
    const preset = getPreset(this.config.preset);
    const body: Record<string, unknown> = {
      model: this.config.model.trim(),
      messages,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      ...(preset.extraBody ?? {}),
    };
    if (this.config.jsonMode) body.response_format = { type: 'json_object' };

    // Overloaded (503) and rate-limited (429) replies are transient on free
    // tiers; one short pause and retry fixes most of them without user action.
    const send = async (payload: Record<string, unknown>) => {
      const init = { method: 'POST' as const, body: JSON.stringify(payload) };
      let r = await this.request('/chat/completions', init, signal, ANALYZE_TIMEOUT_MS);
      if (RETRY_STATUSES.has(r.status) && !signal?.aborted) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
        r = await this.request('/chat/completions', init, signal, ANALYZE_TIMEOUT_MS);
      }
      return r;
    };

    let res = await send(body);
    // A 400 usually means this model does not accept one of the optional fields
    // (a thinking level, temperature on OpenAI reasoning models, max_tokens on
    // models that want max_completion_tokens). Retry once with the plain
    // request so an option mismatch never blocks logging.
    if (res.status === 400 && !signal?.aborted) {
      const err = httpError(res.status, await res.text(), this.config);
      if (err.code === 'unauthorized' || /response_format|json_object/i.test(err.raw ?? ''))
        throw err;
      for (const key of Object.keys(preset.extraBody ?? {})) delete body[key];
      delete body.temperature;
      delete body.max_tokens;
      body.max_completion_tokens = MAX_TOKENS;
      res = await send(body);
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
    if (!reply.trim()) {
      throw new AIError(
        'empty',
        'The model returned an empty reply. If this keeps happening, try a lighter model such as a Flash or mini variant.',
        res.status,
        text.slice(0, 300),
      );
    }
    return reply;
  }

  /** fetch() with auth headers, proxy routing, a timeout, and friendly error mapping. */
  private async request(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<Response> {
    if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
    const { apiKey, baseUrl, proxyUrl } = this.config;
    const headers: Record<string, string> = {};
    if (init.body) headers['Content-Type'] = 'application/json';
    if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
    if (proxyUrl?.trim()) headers['X-Target-Base-Url'] = trimSlash(baseUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      return await fetch(`${trimSlash(proxyUrl?.trim() || baseUrl)}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (e) {
      if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
      if (controller.signal.aborted) {
        throw new AIError(
          'timeout',
          `No reply from ${getPreset(this.config.preset).name} after ${Math.round(timeoutMs / 1000)} seconds. The model is probably overloaded. Try again, or switch to gemini-3.5-flash-lite in Settings for faster answers.`,
        );
      }
      throw new AIError(
        'network_or_cors',
        'Network error. Check your connection and try again. If it persists, the provider may be blocking browser requests; a proxy URL under Advanced works around that.',
        undefined,
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

/** Chat-capable ids the key can use, with the preset's known-good models first. */
export function suggestModels(ids: string[], preset: Preset, limit = 6): string[] {
  const chat = ids.filter((id) => id.includes(preset.modelFilter) && !NON_CHAT.test(id));
  const known = preset.suggestedModels.filter((m) => chat.includes(m));
  const rest = chat.filter((m) => !known.includes(m));
  const out = [...known, ...rest].slice(0, limit);
  return out.length ? out : ids.slice(0, limit);
}

const NON_CHAT =
  /embed|tts|image|imagen|audio|live|native|computer|robot|veo|lyria|research|realtime|transcri|moderation|whisper|dall-e|omni|banana|customtools/i;

function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Gemini returns ids like "models/gemini-2.5-flash"; normalise to bare ids. */
export function parseModelIds(body: string): string[] {
  try {
    const j = JSON.parse(body) as ModelsResponse;
    return (j.data ?? [])
      .map((m) => (typeof m.id === 'string' ? m.id.replace(/^models\//, '') : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Providers wrap errors differently: {error:{message}}, {error:"..."}, or [{error:{...}}]. */
export function errorDetail(body: string): string {
  if (/^\s*</.test(body)) {
    // An HTML error page (gateway, proxy): keep its title, never the markup.
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim();
    return title ?? '';
  }
  try {
    let j: unknown = JSON.parse(body);
    if (Array.isArray(j)) j = j[0];
    if (!j || typeof j !== 'object') return '';
    const obj = j as { error?: { message?: string } | string; message?: string };
    if (typeof obj.error === 'string') return obj.error;
    return obj.error?.message ?? obj.message ?? '';
  } catch {
    return body.slice(0, 200);
  }
}

function httpError(status: number, body: string, config: ProviderConfig): AIError {
  const detail = errorDetail(body);
  const name = getPreset(config.preset).name;
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(detail))) {
    return new AIError(
      'unauthorized',
      `${name} rejected the API key (${status})${detail ? `: ${detail}` : ''}. Check the key in Settings.`,
      status,
      detail,
    );
  }
  if (status === 429) {
    return new AIError(
      'rate_limited',
      `${name} rate limit hit (429). Wait a moment and try again.${detail ? ` ${detail}` : ''}`,
      status,
      detail,
    );
  }
  if (status === 404) {
    return new AIError(
      'http',
      `Not found (404). Check that the model "${config.model}" exists (Test connection lists the available ones) and that the base URL ${trimSlash(config.baseUrl)} is complete.${detail ? ` ${detail}` : ''}`,
      status,
      detail,
    );
  }
  if (status === 400 && /response_format|json_object/i.test(detail)) {
    return new AIError(
      'http',
      'This server rejects JSON mode. Turn off "JSON mode" under Advanced in Settings and try again.',
      status,
      detail,
    );
  }
  if (status === 503 || status === 502 || status === 504) {
    return new AIError(
      'http',
      `${name} is overloaded right now (${status}). It was retried once; wait a minute and try again, or switch to a lighter model such as gemini-3.5-flash-lite.${detail ? ` ${detail}` : ''}`,
      status,
      detail,
    );
  }
  return new AIError(
    'http',
    `${name} returned an error (${status}).${detail ? ` ${detail}` : ''}`,
    status,
    detail,
  );
}

export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  return new AIError('http', e instanceof Error ? e.message : String(e));
}
