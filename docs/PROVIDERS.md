# AI providers

The app offers two providers. Both read photos, and both are called straight from your browser with your own key: nothing passes through a server of ours.

| Provider      | Cost                       | Photos | Get a key                            |
| ------------- | -------------------------- | ------ | ------------------------------------ |
| Google Gemini | Free tier for Flash models | Yes    | https://aistudio.google.com/apikey   |
| OpenAI        | Pay as you go, very cheap  | Yes    | https://platform.openai.com/api-keys |

## Setup

1. **Settings → AI provider**, pick the provider.
2. Paste the key. It is stored only in this browser (IndexedDB) and sent only to that provider.
3. Tap **Test connection**. The app lists the models your key can use and confirms the chosen model is one of them. If it is not, the message suggests ids that are.
4. **Save**.

## Models

Defaults: `gemini-3.5-flash-lite` for Gemini and `gpt-6-luna` for OpenAI. On a free Gemini key the lite model answers text and photo requests in about a second, while `gemini-3.8-flash` is frequently overloaded (503) or silent until the timeout, so only pick it if your key has paid quota. The model field is free text, so you can type any id your key can access; Test connection tells you whether it exists.

Gemini Flash models reason before answering. The app asks for low reasoning effort and allows a generous token budget so estimates stay quick and never come back empty.

## Troubleshooting

- **"rejected the API key"**: the key is wrong, revoked, or restricted. Gemini keys from AI Studio work as-is; keys from Google Cloud with API restrictions must allow the Generative Language API. Create a fresh key in AI Studio if unsure.
- **"not in its model list"**: the model id is misspelled or not available to your key. Use one of the suggested ids.
- **"No reply after N seconds"**: a connection problem or an overloaded model. Try again, or switch to a lighter model such as `gemini-3.5-flash-lite`.
- **"rate limit hit (429)"**: the free tier allows a limited number of requests per minute and per day. Wait a minute and retry.
- **Private browsing**: the app works, but iOS Safari discards IndexedDB when the private tab closes, so your key and log disappear. Use a normal tab and add the app to your home screen.

## Advanced

Under **Advanced** you can change the base URL (for example to point at a compatible relay), turn off JSON mode, or set a proxy URL. With a proxy, requests go to `<proxy>/chat/completions` and `<proxy>/models` with the real base URL in the `X-Target-Base-Url` header; the proxy may hold the key, in which case the key field can stay empty.

## Adding a provider

Add an entry to `src/ai/presets.ts` (base URL, default model, a model filter for the Test connection suggestions, and any extra request fields). Any server that speaks the OpenAI Chat Completions format and allows browser requests (CORS) will work. Keep the badge honest about photo support.
