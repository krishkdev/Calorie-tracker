# AI providers

The app talks to any server that speaks the OpenAI Chat Completions format. You pick a preset in **Settings → AI provider**, paste your own key, and choose a model. The key is stored only in your browser and is sent only to the provider you chose.

## Which models can read photos?

Photo logging needs a model that accepts image input. Every preset in the app shows a badge and a live "Photo logging: available / not available" line. The short version:

| Preset            | Badge            | Photos                                   | Notes                                                                                                                                                 |
| ----------------- | ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| DeepSeek          | Text only        | No                                       | `deepseek-chat` cannot read images. Very cheap for typed logging.                                                                                     |
| OpenRouter        | Depends on model | With a vision model                      | Free vision models exist, e.g. `google/gemma-4-31b-it:free`. Free tier: about 20 requests/min and 50/day (1,000/day after buying $10 of credit once). |
| Google Gemini     | Text + photos    | Yes                                      | Uses Gemini's OpenAI-compatible endpoint. Flash models have a free tier; check the quota in AI Studio.                                                |
| OpenAI            | Text + photos    | Yes                                      | Pay as you go.                                                                                                                                        |
| Ollama (local)    | Depends on model | With `gemma3`, `qwen2.5vl`, `llava`, ... | Free, runs on your computer. Needs `OLLAMA_ORIGINS`, see below.                                                                                       |
| LM Studio (local) | Depends on model | With a vision model loaded               | Enable CORS in LM Studio's server settings.                                                                                                           |
| Custom            | Depends on model | You tell the app                         | Any OpenAI-compatible URL: Groq, Together, Mistral, vLLM, llama.cpp, ...                                                                              |

If the configured model cannot read images the Photo tile is disabled and explains why. Typed descriptions, barcodes and manual entry always work.

## Getting a key

- DeepSeek: https://platform.deepseek.com/api_keys
- OpenRouter: https://openrouter.ai/keys
- Google Gemini: https://aistudio.google.com/apikey
- OpenAI: https://platform.openai.com/api-keys

## Local models

### Ollama

Browsers only call servers that allow it (CORS). Start Ollama with your site's origin allowed:

```bash
OLLAMA_ORIGINS="*" ollama serve
# or, stricter:
OLLAMA_ORIGINS="https://yourname.github.io" ollama serve
```

Pull a vision model, e.g. `ollama pull gemma3`, then in the app choose **Ollama**, model `gemma3`, and tick "Model can read images".

Mixed content: when the app is served over https (GitHub Pages), Chrome allows calls to `http://localhost`, but iOS Safari does not. On a phone, run the app from the same machine over http (`npm run preview`) or put Ollama behind https.

### LM Studio

Start the local server, enable **CORS** in its settings, choose **LM Studio** in the app and type the model id shown in LM Studio.

## CORS and the proxy URL

Everything runs in your browser, so the provider must allow browser requests. DeepSeek, OpenRouter, Gemini and OpenAI all do. If a provider does not, set **Advanced → Proxy URL** to a tiny pass-through you host. The app will send requests to `<proxy>/chat/completions` with the real base URL in the `X-Target-Base-Url` header and your `Authorization` header untouched.

A minimal Cloudflare Worker:

```js
export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const target = req.headers.get('x-target-base-url');
    if (!target) return new Response('missing X-Target-Base-Url', { status: 400, headers: cors() });
    const url = new URL(req.url);
    const upstream = await fetch(target.replace(/\/$/, '') + url.pathname.replace(/^\/v1/, ''), {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        authorization: req.headers.get('authorization') ?? '',
      },
      body: req.body,
    });
    const res = new Response(upstream.body, upstream);
    Object.entries(cors()).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  },
};
const cors = () => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type,x-target-base-url',
  'access-control-allow-methods': 'POST,OPTIONS',
});
```

Set the proxy URL to the worker's URL plus `/v1`.

## JSON mode

The app asks for `response_format: {"type": "json_object"}` so models return clean JSON. Some local servers reject that parameter; turn off **Advanced → JSON mode** if you see an error mentioning `response_format`. The app parses JSON out of prose and code fences anyway, and retries once if the reply was not JSON.

## Adding a preset

Edit `src/ai/presets.ts`. Each preset declares its base URL, default model, and most importantly how image support should be labelled (`vision: 'yes' | 'no' | 'depends'` with a human note). Keep that label honest; users rely on it.
