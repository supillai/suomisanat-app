# SuomiSanat - Agents Guide

Purpose: give agents the minimum context and guardrails to work safely and quickly on this repo.

## Product snapshot
- Finnish YKI level 3 vocab trainer with offline-first UI and optional Supabase sync.
- Vite + React + TypeScript + Tailwind; PWA shell cached under `public/`.
- Public `main` ships only a small self-authored sample dataset in `public/data/words.v4.json`; keep larger private or third-party datasets off this branch.

## Default workflow
- Install deps: `npm install` (Node 20.19+ or 22.12+).
- Dev server: `npm run dev` (Vite).
- Fast check: `npm run verify` (eslint -> typecheck -> vitest -> build).
- Unit tests only: `npm run test` (Vitest runner script in `scripts/run-vitest.mjs`).
- E2E: `npm run test:e2e` (build in e2e mode, then Playwright with web server on 127.0.0.1:4173).
- Supabase migration status: `npm run supabase:migration:list` (requires Supabase CLI and a linked project).
- Supabase remote dry run: `npm run supabase:db:push:dry`.

## Playwright specifics
- Config: `playwright.config.ts` (projects for desktop Chrome, Pixel 5/short, iPhone 13; trace `retain-on-failure`).
- Web server command `npm run preview:e2e`; baseURL `http://127.0.0.1:4173`.
- Re-run a single spec: `npx playwright test e2e/app.shared.spec.ts --project=chromium`.

## Data + validation
- Parser: `parseWordDataset` in `src/data/word-data.ts` validates id uniqueness, required strings, topic/pos enums from `src/types.ts`.
- Guard test: `src/data/word-data.test.ts` expects the current sample dataset shape and a few known entries; keep this updated when the dataset changes.
- Useful phrase source currently lives in `data/useful-phrases.json`.
- When editing vocabulary:
  1) Update source JSON files, then rebuild `public/data/words.v4.json` with `node scripts/build-word-dataset.mjs <output-json> <input-json...>`. The first input keeps its ids, later unique entries are renumbered sequentially, and later-input duplicates are skipped after normalizing Finnish case, punctuation, and whitespace.
  2) Rebuild the current bundled dataset with `node scripts/build-word-dataset.mjs public/data/words.v4.json public/data/words.v4.json data/useful-phrases.json` when useful phrase content changes.
  3) Run `npm run test` to catch schema/duplication issues.`r`n  4) On public `main`, only commit self-authored or clearly licensed sample data.

## Environment / Supabase
- Optional cloud sync; env vars live in `.env.local` using `.env.example` keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- App should still function offline without these; avoid introducing hard dependencies.
- Canonical database history lives in `supabase/migrations/`; `supabase/schema.sql` is a reference snapshot of the baseline.
- The initial sync schema may already exist in the target Supabase project; treat the first migration as the baseline and add future changes as new migration files.
- Repo Supabase CLI config lives in `supabase/config.toml`.
- For an already-initialized hosted project, link it and mark baseline `20260323120000` as applied before using `supabase db push`.

## Conventions & quality bar
- TypeScript strictness: prefer explicit types over `any`; keep React components functional.
- Styling via Tailwind; avoid inline magic numbers - prefer semantic utility combos.
- Keep offline experience intact (service worker registered in `src/registerServiceWorker.ts`).
- Definition of done: targeted tests updated/added, `npm run verify` passes, no regressions in dataset validator, PWA build still succeeds (`npm run build`).

## Repo map (quick lookup)
- `src/App.tsx` - root UI orchestration.
- `src/features/` - feature folders (app shell, progress, quiz, study, sync, words).
- `src/components/WordStatusActions.tsx` - shared word-progress controls.
- `src/data/` - dataset parsing + tests.
- `public/` - static assets, manifest, vocab JSON.
- `e2e/` - Playwright specs + support helpers.
- `supabase/` - SQL migrations + reference schema for optional backend.

## Deploy
- Static build: `npm run build` -> `dist/`.
- Cloudflare Pages ready; SPA fallback configured in `wrangler.jsonc` if using Wrangler static assets.

If you add new tooling or workflows, append them here so future agents run the right commands first try.



