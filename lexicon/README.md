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

## Share & session history

Finishing any round (Clusters, Lightning, Antonyms) saves a **session review** — a
recap of that game (mode, date, score, points, best combo / mistakes). Each review is
stored alongside your progress, so it rides the same `localStorage` save and, when
you're signed in, the same Supabase mirror — no extra setup or table needed. The last
50 are kept and de-duplicated across devices on sign-in.

- **Share** buttons on the results screen and in the Hub's **Recent sessions** list
  produce a Wordle-style text recap and post it via the native share sheet
  (mobile), falling back to copying it to the clipboard.
- The Lightning/Antonyms results screen also shows a per-question recap grid.

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

## Analytics (optional)

When Supabase is configured, the app also logs anonymous **product-analytics
events** — which modes get opened, how often rounds are finished vs abandoned,
scores, and sign-ups — so you can see what players actually do. It reuses the same
Supabase project (no third-party service, no cookies):

1. In the Supabase **SQL editor**, run `supabase/events.sql` once. It creates an
   append-only `events` table whose row-level security lets the browser *insert*
   events but never *read* them, so the public anon key can't see anyone's data.
2. That's it — `src/lib/analytics.ts` starts sending events on the next load. A
   random per-browser id (localStorage) and the signed-in `user_id` (when present)
   let you split guest vs account activity.
Events tracked: `app_open`, `mode_open`, `round_start`, `round_finish`, `sign_up`,
`sign_in`. With no Supabase env set, tracking is a silent no-op. (Inserts use the
public anon key, so a determined user could submit junk events; if that ever
matters, move the insert behind an Edge Function or add rate limiting.)

### Viewing the data

**Built-in dashboard (works on your phone).** The app has an admin-only analytics
screen at the URL hash **`#admin`** (e.g. `https://your-app/#admin`) — KPI cards,
daily-activity charts, a by-mode breakdown, and a live recent-events feed, all
auto-refreshing. To enable it:

1. Run `supabase/dashboard.sql` once in the SQL editor. It adds aggregate functions
   that read the (RLS-locked) `events` table but **only return data to you** — each
   one checks the caller's email against the admin email set at the top of the file.
   **Edit that email** to the account you'll sign in with, then run it.
2. Make sure that admin account exists (create it once via the app's
   **Sign in → Create account**, using the same email).
3. Open `…/#admin`, sign in with that account, and the dashboard loads. Bookmark it
   on your phone. Any non-admin who finds the URL just gets "not authorized".

**Ad-hoc SQL.** For one-off questions, the Supabase SQL editor (which bypasses RLS)
can run the ready-made queries in `supabase/analytics-queries.sql` — daily actives,
mode funnel + completion rate, average scores, retention, and the account funnel.

> The dashboard is part of the web app, so it's reachable wherever the app is
> hosted. If you haven't deployed yet, any static host works (`npm run build` →
> serve `dist/`); the dashboard needs no server of its own.

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

`npm test` runs the Vitest unit suite (no server needed). It covers the store's
save/load/merge behavior, the cloud-sync merge + fail-closed read contract that
protects signed-in users' progress, dataset invariants, and share-text building.

```sh
npm test             # unit tests (vitest, jsdom)
npm run test:watch   # watch mode
```

`npm run smoke` is a fast headless-Chrome check that every screen mounts;
`npm run e2e` plays full user journeys (complete rounds, reload persistence,
old-save migration, backup/restore/reset, settings, search, #admin). Both fail
on any console/runtime error and need the dev server running:

```sh
npm run dev          # in one terminal
npm run smoke        # in another (tests http://localhost:5173)
npm run e2e          # full playthrough against the same URL
```

## Project layout

- `src/data/vocab-data.ts` — the meaning-family dataset (clusters, roles, antonyms)
- `src/lib/store.ts` — persistent game state (mastery, streak, daily goal, backup codes, session reviews)
- `src/lib/hooks.ts` — shared hooks/helpers (`useStore`, `displayWord`, `useToast`, …)
- `src/lib/share.ts` — builds the shareable recap text and posts it (Web Share API → clipboard)
- `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/sync.ts` — optional accounts + cloud progress sync
- `src/lib/analytics.ts` — optional first-party event tracking (`track()`)
- `src/modes/Dashboard.tsx`, `src/components/Charts.tsx` — admin analytics dashboard (`#admin`) + SVG charts
- `src/components/` — shared UI (badges, progress ring, toasts, settings sheet, auth sheet, `ProgressSync`, `ShareReviewButton`)
- `src/modes/` — Hub, Library, Clusters, and Quiz (Lightning/Antonyms) screens
- `src/styles/` — base + layout CSS (warm paper palette, Newsreader/Space Grotesk)
- `supabase/schema.sql` — Postgres table + row-level security for saved progress
- `supabase/events.sql` — analytics event table (append-only, insert-only RLS)
- `supabase/dashboard.sql` — admin-gated aggregate functions powering the `#admin` dashboard
- `supabase/analytics-queries.sql` — ready-made aggregate queries for the SQL editor
- `scripts/smoke.mjs` — headless E2E smoke test
- `scripts/e2e-full.mjs` — headless E2E full playthrough (journeys, persistence, backup/restore)
- `tests/` — Vitest unit tests (store, sync contract, dataset invariants, share text, ProgressSync)
