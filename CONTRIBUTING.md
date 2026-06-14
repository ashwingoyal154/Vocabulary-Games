# Contributing to Lexicon

Thanks for your interest in improving Lexicon. This guide gets you productive fast.

> **Repo layout:** the app lives in [`lexicon/`](lexicon/). The root holds the
> original Claude Design prototypes (`project/`) and design transcripts (`chats/`)
> that document intent. Do almost all work inside `lexicon/`.

## Prerequisites

- **Node.js 22+** (the test/E2E harnesses use Node's built-in `fetch`/`WebSocket`)
- npm (a committed `package-lock.json` is the source of truth)

## Getting started

```sh
cd lexicon
npm install
npm run dev        # http://localhost:5173
```

The app is fully functional **local-only** — accounts, cloud sync, and analytics
are optional and no-op until you add Supabase env vars (see [`lexicon/README.md`](lexicon/README.md)).

## Quality gates

Run these before opening a PR — CI runs the same set:

```sh
npm run lint       # eslint
npm run validate   # dataset invariants + coverage stats (gates the build)
npm test           # Vitest unit suite (store, sync contract, dataset, share text)
npm run build      # validate -> tsc -b -> vite build
```

For anything that changes behavior or UI, also run the headless harnesses
(they need `npm run dev` running in another terminal):

```sh
npm run smoke      # every screen mounts, no console/runtime errors
npm run e2e        # full playthroughs: rounds, persistence, backup/restore, #admin
npm run mobile     # overflow + tap-target audit across 5 phone widths
```

## Adding vocabulary (the content pipeline)

Words are **content, not code** — `src/data/clusters.json` is the canonical dataset,
bundled at build time. To add words from a screenshot:

```
data/incoming/*.png  ──►  data/incoming/*.json  ──►  src/data/clusters.json
   (1) transcribe            (2) curate                  (3) ingest
```

Stages 1–2 are handled by the `vocab-transcriber` and `vocab-curator` agents
(vision by Claude Code — no paid API). You can also hand-author a candidate JSON
and skip to the merge:

```sh
node scripts/ingest.mjs <file> --dry-run   # preview the merge
npm run ingest                             # merge + validate (nothing writes if invalid)
```

See [`lexicon/data/README.md`](lexicon/data/README.md) for the candidate format.

## Non-negotiable constraints

These are project invariants — a PR that violates them won't be merged:

1. **No paid external services.** Vision is done by Claude Code, the dataset is
   bundled, Supabase (free tier) is strictly optional.
2. **Never lose players' progress.** Don't change the `localStorage` key
   `gre_vocab_game_v1`; keep `GameState` and `mergeStates()` in sync; no destructive
   SQL migrations; preserve the fail-closed sync contract (a failed remote read must
   never trigger a push). See [`SECURITY.md`](SECURITY.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
3. **Mobile-first.** The UI must not introduce horizontal overflow or sub-44px tap
   targets — verify with `npm run mobile`.

## Commit & PR conventions

- Keep commits focused; write imperative subject lines (e.g. *"Add streak-freeze token"*).
- Fill out the PR template, including the **player-progress safety** checklist.
- Link issues with `Closes #123`.

## Code style

TypeScript + React 19, function components and hooks. ESLint is the arbiter
(`npm run lint`). Match the surrounding code's naming and density; prefer deriving
from the dataset exports (`CLUSTERS`, `WORD_INDEX`, …) over hardcoding word lists.
