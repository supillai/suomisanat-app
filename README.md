# SuomiSanat

SuomiSanat is a Finnish YKI level 3 vocabulary trainer with offline-first study tools and optional Supabase cloud sync.

## Stack

- Vite
- React + TypeScript
- Tailwind CSS
- Versioned JSON word dataset with runtime validation
- localStorage for offline/local progress tracking
- Supabase (Auth + Postgres) for optional cloud sync
- PWA manifest + service worker for installability and offline caching

## Features

- Finnish YKI-style study workflow with a small bundled sample dataset
- English meaning plus easy Finnish clue for every word
- Flashcard study mode with shortcuts and daily-goal tracking
- Quiz mode with multiple choice, typing feedback, and mini drills
- Searchable word list with topic filters, sorting, and due-next view
- Progress dashboard with explicit sync conflict resolution
- Installable offline app shell with cached word dataset

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run verify
```

## Dataset note

This public branch ships only a small self-authored sample dataset in `public/data/words.v4.json` and `data/useful-phrases.json`.

The bundled sample data files are included under the same MIT license as the source code in this repository.

The application supports larger private or separately licensed datasets with the same schema, but those source lists are not included here.

The source code is MIT licensed. Review rights and licensing separately before committing third-party vocabulary lists or generated dataset files.

## Supabase setup

1. Install the Supabase CLI.
2. Create a Supabase project.
3. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. In Supabase Auth URL config, add local and production redirect URLs.
5. Link this repo to the hosted project:

```bash
npm run supabase:link -- --project-ref <your-project-ref>
```

6. If this hosted project already ran the old `supabase/schema.sql`, mark the baseline migration as already applied instead of re-running it:

```bash
npm run supabase:migration:baseline
```

7. For future schema changes, add a new file under `supabase/migrations/` and push it with:

```bash
npm run supabase:db:push
```

If env vars are missing, the app still works in local-only offline mode.

`supabase/schema.sql` is kept as a readable reference snapshot. Future schema changes should go in new files under `supabase/migrations/`.

## Privacy notice

This repository ships a neutral placeholder page at `public/privacy.html` for public source distribution.

If you deploy the app for real users, replace that file with an operator-specific privacy notice that matches your actual Supabase configuration, storage region, subprocessors, retention policy, and privacy contact process.

### Supabase migration workflow

- `npm run supabase:migration:list` compares local migration files with the linked remote history.
- `npm run supabase:db:push:dry` shows what would be applied before changing the remote database.
- `npm run supabase:db:reset` rebuilds a local Supabase database from `supabase/migrations/`.
- `npm run supabase:db:lint` lints the local database schema.

## PWA notes

- The app shell, icons, manifest, and `public/data/words.v4.json` are cached for offline use.
- Cloud sync stays progressive: local study mode works without Supabase, and sign-in is only required for cross-device sync.

## Deploy to Cloudflare

1. Push this repo to GitHub.
2. In Cloudflare Dashboard, create a Pages project and connect the repo.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add your custom domain in the Cloudflare project settings.
6. Ensure DNS for that domain is managed in Cloudflare.

If you deploy with Wrangler static assets, SPA routing fallback is configured in [wrangler.jsonc](/wrangler.jsonc) via `assets.not_found_handling = "single-page-application"`.
