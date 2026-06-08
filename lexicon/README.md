# Lexicon — GRE Vocabulary Game

A daily-puzzle-style game for learning GRE vocabulary through meaning-families,
implemented from the `Lexicon.html` design exported from Claude Design
(see `../project/` and `../chats/` for the original prototype and design conversation).

Built with Vite + React + TypeScript.

## Modes

- **Clusters** — sort sixteen words into four hidden meaning-families (Connections-style).
- **Lightning** — name a flashed word's family before the combo breaks.
- **Antonyms** — spot the one word that's the opposite of a family of synonyms.
- **The Lexicon** — a searchable, filterable library of all 80 families / 481 words with mastery tracking.

Progress (mastery levels, streaks, daily points) is saved to `localStorage` and
can be carried between browsers/devices via the **Back up / Restore** codes in the footer.

## Accounts & cross-device sync (optional)

By default the game is local-only. Add a free Supabase project to enable
**email + password accounts** so progress is saved to the cloud and resumes on any device:

1. Create a project at <https://supabase.com>.
2. In **Project Settings → API**, copy the **Project URL** and the **anon / public** key.
3. Copy `.env.example` to `.env` and paste them in as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. In the Supabase **SQL editor**, run `supabase/schema.sql` once — it creates the
   `game_state` table with row-level security so each user can only read/write their own row.
5. Restart `npm run dev`; a **Sign in** button appears in the top bar.

On first sign-in, the progress already on the device is **merged** into your account
(the better of each value is kept), then signing in on any device restores it. When the
env vars are absent the app behaves exactly as before — no accounts, local-only.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Test

`npm run smoke` runs a headless-Chrome end-to-end check (it drives all four modes and
fails on any console/runtime error). Start the dev server first:

```sh
npm run dev          # in one terminal
npm run smoke        # in another (tests http://localhost:5173)
```

## Project layout

- `src/data/vocab-data.ts` — the meaning-family dataset (clusters, roles, antonyms)
- `src/lib/store.ts` — persistent game state (mastery, streak, daily goal, backup codes)
- `src/lib/hooks.ts` — shared hooks/helpers (`useStore`, `displayWord`, `useToast`, …)
- `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/sync.ts` — optional accounts + cloud progress sync
- `src/components/` — shared UI (badges, progress ring, toasts, settings sheet, auth sheet, `ProgressSync`)
- `src/modes/` — Hub, Library, Clusters, and Quiz (Lightning/Antonyms) screens
- `src/styles/` — base + layout CSS (warm paper palette, Newsreader/Space Grotesk)
- `supabase/schema.sql` — Postgres table + row-level security for saved progress
- `scripts/smoke.mjs` — headless E2E smoke test
