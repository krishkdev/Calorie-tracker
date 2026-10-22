# Calorie Tracker

A free, open-source calorie tracker in the spirit of Cal AI, with no subscription.
You bring your own AI API key, and all of your data stays on your device.

- **Bring your own AI.** Works with any OpenAI-compatible API: DeepSeek, OpenRouter, Google Gemini, OpenAI, Ollama, LM Studio, or a custom URL.
- **Private by design.** Food logs, weight, and goals live in your browser's local database. There is no server and no account.
- **Installable.** It is a Progressive Web App: add it to your phone's home screen and it works like a native app, including offline.
- **Open source forever.** Licensed under the AGPL-3.0.

> Status: under active development. See the milestones in `CONTRIBUTING.md`.

## Quick start (development)

```bash
npm install
npm run dev
```

Then open the printed URL. To try it on your phone, run `npm run dev -- --host` and open your computer's LAN address.

## Other commands

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run build`     | Type-check and build to `dist/`     |
| `npm run preview`   | Serve the production build          |
| `npm test`          | Run unit tests                      |
| `npm run lint`      | Lint                                |
| `npm run typecheck` | Type-check only                     |
| `npm run icons`     | Regenerate PWA icons (needs Pillow) |

## Deploying

The repository ships with a GitHub Actions workflow that publishes to GitHub Pages from the `main` branch. Enable it once under **Settings → Pages → Source: GitHub Actions**. Any static host works too, and there is a `Dockerfile` for self-hosting. See `docs/SELF_HOSTING.md`.

## License

AGPL-3.0-only. See `LICENSE`.
