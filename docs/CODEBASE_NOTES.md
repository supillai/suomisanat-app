# Codebase Notes

Quick orientation for agents; keep concise and update when structure shifts.

## Layout
- `src/features/` - feature-first folders (`app`, `progress`, `quiz`, `study`, `sync`, `words`).
- `src/components/WordStatusActions.tsx` - shared UI for per-word status actions.
- `src/data/` - word dataset parser + tests; types live in `src/types.ts`.
- `src/utils/` & `src/lib/` - shared helpers (avoid duplicating logic across features).
- `public/` - manifest, icons, cached assets, vocab JSON (`data/words.v4.json`).
- `e2e/` - Playwright specs (`app.*`, `sync-conflict.spec.ts`) and `e2e/support/` helpers.
- `scripts/run-vitest.mjs` - Vitest entry (no config file).

## Data contract
- Vocab entry shape is defined in `src/types.ts` (`VocabularyWord`, `WordTopic`, `WordPos`).
- Parser enforces: positive integer ids, no duplicate ids or Finnish strings, required strings for `fi`, `en`, `fiSimple`, `enSimple`, topic/pos within enums.
- Dataset versioning via `WORD_DATASET_VERSION`/`WORD_DATASET_URL` in `src/data/word-data.ts`; changing the version requires shipping a new JSON file and updating tests/constants.

## Testing
- Unit: `npm run test` (Vitest, serial threads, includes `src/**/*.test.ts`).
- Lint: `npm run lint` (eslint config in `eslint.config.js`).
- Typecheck: `npm run typecheck`.
- E2E: `npm run test:e2e` (uses `npm run build:e2e` -> `vite build --mode e2e`, then Playwright with `preview:e2e`).
- Full gate: `npm run verify` runs lint -> typecheck -> unit tests -> typecheck (build) -> vite build.

## Build/deploy
- Standard build `npm run build` writes to `dist/`.
- Deploy target: Cloudflare Pages; SPA fallback handled by `wrangler.jsonc`.

## Runbook: update `public/data/words.v4.json`
1) Edit or regenerate `public/data/words.v4.json` (keep ids stable, no duplicate Finnish terms).
2) If schema changes or a new version is needed, bump `WORD_DATASET_VERSION`/`WORD_DATASET_URL` in `src/data/word-data.ts` and copy the JSON to the new filename (e.g., `words.v5.json`).
3) Update expectations in `src/data/word-data.test.ts` (entry count + sample word) to match the new dataset.
4) Run `npm run test` to catch parser violations (duplicates, missing fields, bad enums).
5) Run `npm run verify` to ensure type, lint, and build are still happy.
6) If ids were added/removed, assess progress-map compatibility; note breaking changes in `README.md` if needed.`r`n7) Public `main` should contain only self-authored or clearly licensed sample data.

Checklist
- [ ] JSON validates with `parseWordDataset` (no thrown errors).
- [ ] Entry count and sample expectations updated in `src/data/word-data.test.ts`.
- [ ] `npm run verify` passes.
- [ ] Offline caching still good (new file under `public/data/` so service worker picks it up via build).
- [ ] Changelog/README updated if dataset version bumped.

## Operational cautions
- Preserve offline behavior: service worker registered via `src/registerServiceWorker.ts`; avoid breaking asset cache keys and routes unintentionally.
- Do not make Supabase env vars mandatory; local/offline mode must keep working.
- When editing dataset, keep ids stable to avoid progress map clashes.

## Feature flags / dev toggles
- Supabase optional: presence of `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` enables cloud sync; absent values force offline-only.
- E2E Supabase injection: when `import.meta.env.MODE === "e2e"`, tests can provide `window.__SUOMISANAT_E2E_SUPABASE__` to mock the client (see `src/lib/supabase.ts`).
- No other runtime flags are currently implemented; add new ones via `import.meta.env` with safe defaults that preserve offline usage.

## Quick links
- Product overview + setup: `README.md`.
- Supabase schema: `supabase/schema.sql`.
- PWA entry HTML: `index.html` (includes manifest).


