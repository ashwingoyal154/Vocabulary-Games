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

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Project layout

- `src/data/vocab-data.ts` — the meaning-family dataset (clusters, roles, antonyms)
- `src/lib/store.ts` — persistent game state (mastery, streak, daily goal, backup codes)
- `src/lib/hooks.ts` — shared hooks/helpers (`useStore`, `displayWord`, `useToast`, …)
- `src/components/` — shared UI (badges, progress ring, toasts, settings sheet)
- `src/modes/` — Hub, Library, Clusters, and Quiz (Lightning/Antonyms) screens
- `src/styles/` — base + layout CSS (warm paper palette, Newsreader/Space Grotesk)
