# Calorie Tracker

[![CI](https://github.com/krishkdev/Calorie-tracker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/krishkdev/Calorie-tracker/actions/workflows/ci.yml)
[![Vercel](https://github.com/krishkdev/Calorie-tracker/actions/workflows/vercel.yml/badge.svg?branch=main)](https://github.com/krishkdev/Calorie-tracker/actions/workflows/vercel.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

A free, open-source calorie tracker in the spirit of Cal AI, with no subscription.
You bring your own AI key. Your data stays on your device.

**Live app:** https://calorie-tracker-six-navy.vercel.app

- **Log food four ways.** Describe it in words, snap a photo, scan a barcode, or type the numbers. The AI returns items with calories and macros that you review and edit before saving.
- **Bring your own AI.** Use your own Google Gemini key (free tier available) or OpenAI key. Both read photos. Nothing is billed through the app.
- **Goals that make sense.** A short onboarding computes your daily calorie and macro targets (Mifflin-St Jeor), which you can adjust any time.
- **Private by design.** Food logs, weight and goals live in your browser's local database. There is no server and no account. Export a JSON backup whenever you like.
- **Installable.** It is a Progressive Web App: add it to your phone's home screen and it works like a native app, including offline.
- **Open source forever.** AGPL-3.0.

## Try it

Use the live app above, deploy your own copy (see below), or run it locally:

```bash
npm install
npm run dev
```

Then open the printed URL. To use it on your phone, run `npm run dev -- --host` and open your computer's LAN address.

## Set up your AI key

1. Open **Settings → AI provider**.
2. Pick a provider:
   - **Google Gemini** – free tier, reads photos. Get a key at https://aistudio.google.com/apikey
   - **OpenAI** – pay as you go, reads photos. Get a key at https://platform.openai.com/api-keys
3. Paste your key, tap **Test connection** (it checks the key and that the model exists), then **Save**.

Details and troubleshooting: [docs/PROVIDERS.md](docs/PROVIDERS.md).

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
