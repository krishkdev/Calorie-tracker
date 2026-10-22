# Calorie Tracker

A free, open-source calorie tracker in the spirit of Cal AI, with no subscription.
You bring your own AI key. Your data stays on your device.

- **Log food four ways.** Describe it in words, snap a photo, scan a barcode, or type the numbers. The AI returns items with calories and macros that you review and edit before saving.
- **Bring your own AI.** Works with any OpenAI-compatible API: DeepSeek, OpenRouter (free vision models available), Google Gemini, OpenAI, Ollama, LM Studio, or a custom URL. Each option says clearly whether it can read photos.
- **Goals that make sense.** A short onboarding computes your daily calorie and macro targets (Mifflin-St Jeor), which you can adjust any time.
- **Private by design.** Food logs, weight and goals live in your browser's local database. There is no server and no account. Export a JSON backup whenever you like.
- **Installable.** It is a Progressive Web App: add it to your phone's home screen and it works like a native app, including offline.
- **Open source forever.** AGPL-3.0.

## Try it

Deploy your own copy in two minutes with GitHub Pages (see below), or run it locally:

```bash
npm install
npm run dev
```

Then open the printed URL. To use it on your phone, run `npm run dev -- --host` and open your computer's LAN address.

## Set up your AI key

1. Open **Settings → AI provider**.
2. Pick a preset. The badge tells you whether that provider's models can read photos:
   - **DeepSeek** – text only (great for typed logging, very cheap)
   - **OpenRouter** – depends on the model; free vision models such as `google/gemma-4-31b-it:free`
   - **Google Gemini** – text + photos, free tier available
   - **OpenAI** – text + photos
   - **Ollama / LM Studio** – free local models; photos with a vision model like `gemma3`
3. Paste your key, pick a model, tap **Test connection**, then **Save**.

Details, free-tier limits and local-model setup: [docs/PROVIDERS.md](docs/PROVIDERS.md).

## Commands

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the dev server                |
| `npm run build`     | Type-check and build to `dist/`     |
| `npm run preview`   | Serve the production build          |
| `npm test`          | Run unit tests                      |
| `npm run lint`      | Lint                                |
| `npm run typecheck` | Type-check only                     |
| `npm run icons`     | Regenerate PWA icons (needs Pillow) |

## Deploying

Production runs on Vercel through GitHub Actions: every pull request gets a preview deployment, and merging to `main` deploys to production. `main` is protected, so changes go through pull requests with passing CI and a successful preview. Setup steps are in [docs/CI_AND_DEPLOY.md](docs/CI_AND_DEPLOY.md). Any static host works too (an optional GitHub Pages workflow and a `Dockerfile` are included); see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## How it works

- `src/ai/` – the provider interface, presets, prompt, JSON parsing and the OpenAI-compatible adapter. Calls go straight from the browser to the provider.
- `src/db/` – Dexie (IndexedDB) schema, repository helpers, live-query hooks and backup.
- `src/nutrition/` – pure functions for BMR/TDEE, macro targets, totals and unit conversion.
- `src/barcode/` – camera scanning (native BarcodeDetector with a ZXing fallback) and Open Food Facts lookup.
- `src/routes/`, `src/components/` – the screens and UI pieces.

Packaged-food data comes from [Open Food Facts](https://world.openfoodfacts.org) (ODbL). AI estimates are approximate; always review before saving.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Adding a provider preset is a one-file change.

## License

AGPL-3.0-only. See `LICENSE`.
