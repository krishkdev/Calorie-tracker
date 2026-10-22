# Contributing

Thanks for helping keep a free calorie tracker alive.

## Development setup

```bash
npm install
npm run dev
```

Before opening a pull request, make sure these pass locally (CI runs the same):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Project layout

```
src/routes/       one file per screen
src/components/   reusable UI pieces
src/db/           Dexie (IndexedDB) schema, types, repository helpers, live-query hooks
src/ai/           provider interface, presets, prompt, JSON parsing, OpenAI-compatible adapter
src/nutrition/    pure functions: BMR/TDEE, macro targets, totals, unit conversion
src/barcode/      barcode detection and Open Food Facts lookup
src/lib/          small utilities (dates, ids, theme)
```

## Adding an AI provider preset

Most providers only need a new entry in `src/ai/presets.ts` (base URL, default model, whether the model can read images). If a provider does not speak the OpenAI Chat Completions format, implement the `FoodAnalysisProvider` interface in a new file under `src/ai/` and register it in `src/ai/index.ts`.

Always state clearly in the preset whether image input is supported. Users rely on that label to know whether photo logging will work.

## Conventions

- TypeScript strict mode, Prettier formatting (`npm run format`).
- Keep nutrition math in pure functions with unit tests.
- Never log or export API keys by default.
- Mobile first: every screen must work at 360px wide with a thumb.

## License

By contributing you agree that your contributions are licensed under the AGPL-3.0-only, the same license as the project.
