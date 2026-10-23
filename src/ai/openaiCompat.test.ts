import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../db/types';
import { errorDetail, OpenAICompatibleProvider, parseModelIds } from './openaiCompat';
import { AIError } from './types';

const gemini: ProviderConfig = {
  kind: 'openai-compatible',
  preset: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  apiKey: 'AIza-test',
  model: 'gemini-3.8-flash',
  supportsVision: true,
  jsonMode: true,
};

const openai: ProviderConfig = {
  ...gemini,
  preset: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-6-luna',
};

const good = JSON.stringify({
  items: [
    {
      name: 'Egg',
      portion: '1',
      calories: 78,
      protein_g: 6,
      carbs_g: 1,
      fat_g: 5,
      confidence: 0.9,
    },
  ],
});

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function models(ids: string[], status = 200) {
  return new Response(JSON.stringify({ object: 'list', data: ids.map((id) => ({ id })) }), {
    status,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAICompatibleProvider.analyze', () => {
  it('sends a text request with bearer auth, json mode and Gemini reasoning settings', async () => {
    fetchMock.mockResolvedValueOnce(reply(good));
    const r = await new OpenAICompatibleProvider(gemini).analyze({
      text: '2 eggs',
      units: 'metric',
    });
    expect(r.items[0].name).toBe('Egg');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer AIza-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gemini-3.8-flash');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.reasoning_effort).toBe('low');
    expect(body.max_tokens).toBeGreaterThanOrEqual(2048);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('2 eggs');
  });

  it('omits json mode when disabled, skips reasoning for OpenAI, and sends image parts', async () => {
    fetchMock.mockResolvedValueOnce(reply(good));
    await new OpenAICompatibleProvider({ ...openai, jsonMode: false }).analyze({
      image: { dataUrl: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg' },
      text: 'lunch',
      units: 'metric',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    const parts = body.messages[1].content;
    expect(parts[0].type).toBe('text');
    expect(parts[1].image_url.url).toBe('data:image/jpeg;base64,AAAA');
  });

  it('refuses images for text-only models without calling the network', async () => {
    const p = new OpenAICompatibleProvider({ ...gemini, supportsVision: false });
    await expect(
      p.analyze({
        image: { dataUrl: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg' },
        units: 'metric',
      }),
    ).rejects.toMatchObject({ code: 'no_vision' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires an api key unless a proxy is set', async () => {
    await expect(
      new OpenAICompatibleProvider({ ...gemini, apiKey: '' }).analyze({
        text: 'x',
        units: 'metric',
      }),
    ).rejects.toMatchObject({ code: 'no_api_key' });
    fetchMock.mockResolvedValueOnce(reply(good));
    await new OpenAICompatibleProvider({
      ...gemini,
      apiKey: '',
      proxyUrl: 'https://proxy.example/v1/',
    }).analyze({
      text: 'x',
      units: 'metric',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://proxy.example/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Target-Base-Url']).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai',
    );
    expect(headers.Authorization).toBeUndefined();
  });

  it('maps 401, 429 and Google-style array errors', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":{"message":"bad key"}}', { status: 401 }),
    );
    const p = new OpenAICompatibleProvider(gemini);
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'rate_limited',
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        '[{"error":{"code":400,"message":"Please pass a valid API key","status":"INVALID_ARGUMENT"}}]',
        { status: 400 },
      ),
    );
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'unauthorized',
      message: expect.stringContaining('Please pass a valid API key'),
    });
  });

  it('maps fetch failures to network_or_cors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      new OpenAICompatibleProvider(gemini).analyze({ text: 'x', units: 'metric' }),
    ).rejects.toMatchObject({
      code: 'network_or_cors',
    });
  });

  it('retries once when the first reply is not JSON, then gives up', async () => {
    fetchMock.mockResolvedValueOnce(reply('Sure, here is my estimate in prose.'));
    fetchMock.mockResolvedValueOnce(reply(good));
    const p = new OpenAICompatibleProvider(gemini);
    const r = await p.analyze({ text: 'eggs', units: 'metric' });
    expect(r.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string).messages).toHaveLength(4);

    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(reply('still prose')));
    await expect(p.analyze({ text: 'eggs', units: 'metric' })).rejects.toBeInstanceOf(AIError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('OpenAICompatibleProvider.testConnection', () => {
  it('lists models with GET and confirms the chosen model (Gemini "models/" prefix)', async () => {
    fetchMock.mockResolvedValueOnce(
      models(['models/gemini-3.8-flash', 'models/gemini-3.5-flash-lite']),
    );
    const r = await new OpenAICompatibleProvider(gemini).testConnection();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/gemini-3.8-flash is available/);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/models');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('falls back to a generation ping when the model list is empty or not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>proxy</html>', { status: 200 }));
    fetchMock.mockResolvedValueOnce(reply('OK'));
    const r = await new OpenAICompatibleProvider(gemini).testConnection();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/replied: "OK"/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as [string])[0]).toMatch(/chat\/completions$/);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(models([]));
    fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"nope"}}', { status: 401 }));
    const bad = await new OpenAICompatibleProvider(gemini).testConnection();
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/rejected the API key/);
  });

  it('flags a model that the key cannot see and suggests alternatives', async () => {
    fetchMock.mockResolvedValueOnce(
      models(['models/gemini-3.5-flash-lite', 'models/embedding-001']),
    );
    const r = await new OpenAICompatibleProvider(gemini).testConnection();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not in its model list/);
    expect(r.message).toContain('gemini-3.5-flash-lite');
    expect(r.message).not.toContain('embedding-001');
  });

  it('reports a bad key and a missing key', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":{"message":"invalid"}}', { status: 401 }),
    );
    const bad = await new OpenAICompatibleProvider(openai).testConnection();
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/rejected the API key/);
    const none = await new OpenAICompatibleProvider({ ...openai, apiKey: '' }).testConnection();
    expect(none.ok).toBe(false);
    expect(none.message).toMatch(/Add your API key/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('helpers', () => {
  it('parses model ids and error bodies from both providers', () => {
    expect(parseModelIds('{"data":[{"id":"models/gemini-x"},{"id":"gpt-y"},{}]}')).toEqual([
      'gemini-x',
      'gpt-y',
    ]);
    expect(parseModelIds('nope')).toEqual([]);
    expect(errorDetail('{"error":{"message":"a"}}')).toBe('a');
    expect(errorDetail('{"error":"b"}')).toBe('b');
    expect(errorDetail('[{"error":{"message":"c"}}]')).toBe('c');
    expect(errorDetail('plain text')).toBe('plain text');
  });
});
