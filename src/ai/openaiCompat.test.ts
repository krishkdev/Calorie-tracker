import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../db/types';
import { OpenAICompatibleProvider } from './openaiCompat';
import { AIError } from './types';

const base: ProviderConfig = {
  kind: 'openai-compatible',
  preset: 'deepseek',
  baseUrl: 'https://api.deepseek.com/',
  apiKey: 'sk-test',
  model: 'deepseek-chat',
  supportsVision: false,
  jsonMode: true,
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAICompatibleProvider', () => {
  it('sends a text request with bearer auth and json mode', async () => {
    fetchMock.mockResolvedValueOnce(reply(good));
    const p = new OpenAICompatibleProvider(base);
    const r = await p.analyze({ text: '2 eggs', units: 'metric' });
    expect(r.items[0].name).toBe('Egg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-chat');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('2 eggs');
  });

  it('omits json mode when disabled and sends image parts for vision models', async () => {
    fetchMock.mockResolvedValueOnce(reply(good));
    const p = new OpenAICompatibleProvider({
      ...base,
      preset: 'ollama',
      apiKey: '',
      supportsVision: true,
      jsonMode: false,
    });
    await p.analyze({
      image: { dataUrl: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg' },
      text: 'lunch',
      units: 'metric',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    const parts = body.messages[1].content;
    expect(parts[0].type).toBe('text');
    expect(parts[1].image_url.url).toBe('data:image/jpeg;base64,AAAA');
  });

  it('refuses images for text-only models without calling the network', async () => {
    const p = new OpenAICompatibleProvider(base);
    await expect(
      p.analyze({
        image: { dataUrl: 'data:image/jpeg;base64,AAAA', mime: 'image/jpeg' },
        units: 'metric',
      }),
    ).rejects.toMatchObject({ code: 'no_vision' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires an api key for hosted providers', async () => {
    const p = new OpenAICompatibleProvider({ ...base, apiKey: '' });
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'no_api_key',
    });
  });

  it('maps 401 and 429', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":{"message":"bad key"}}', { status: 401 }),
    );
    const p = new OpenAICompatibleProvider(base);
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('maps fetch failures to network_or_cors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const p = new OpenAICompatibleProvider(base);
    await expect(p.analyze({ text: 'x', units: 'metric' })).rejects.toMatchObject({
      code: 'network_or_cors',
    });
  });

  it('retries once when the first reply is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(reply('Sure, here is my estimate in prose.'));
    fetchMock.mockResolvedValueOnce(reply(good));
    const p = new OpenAICompatibleProvider(base);
    const r = await p.analyze({ text: 'eggs', units: 'metric' });
    expect(r.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toHaveLength(4);
    expect(body.messages[3].content).toMatch(/not valid JSON/);
  });

  it('gives up after the retry also fails', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply('still prose')));
    const p = new OpenAICompatibleProvider(base);
    await expect(p.analyze({ text: 'eggs', units: 'metric' })).rejects.toBeInstanceOf(AIError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('testConnection reports success and failure', async () => {
    fetchMock.mockResolvedValueOnce(reply('OK'));
    const p = new OpenAICompatibleProvider(base);
    expect((await p.testConnection()).ok).toBe(true);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const bad = await p.testConnection();
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/API key/);
  });

  it('routes through the proxy url when configured', async () => {
    fetchMock.mockResolvedValueOnce(reply(good));
    const p = new OpenAICompatibleProvider({ ...base, proxyUrl: 'https://proxy.example/v1/' });
    await p.analyze({ text: 'x', units: 'metric' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://proxy.example/v1/chat/completions');
    expect((init.headers as Record<string, string>)['X-Target-Base-Url']).toBe(
      'https://api.deepseek.com',
    );
  });
});
