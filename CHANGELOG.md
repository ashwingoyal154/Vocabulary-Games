# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Lexicon is **continuously deployed** to production from the working branch, so
entries are grouped by date rather than tagged releases.

## [Unreleased]

### Added
- Repository hardening: GitHub Actions CI (lint · validate · test · build),
  Dependabot, issue/PR templates, `LICENSE` (MIT), `CONTRIBUTING`, `SECURITY`,
  `CODE_OF_CONDUCT`, an architecture guide, and a screenshot-rich README.

## 2026-07-04

### Added
- **Vocab List 14 ingested.** Added 58 new meaning-families and 119 word entries
  via the screenshot → game content pipeline, growing the dataset from 262 → **320
  families / 1,721 words** (1,834 total entries incl. antonyms). New themes span
  HARSH/BITING/SHARP, REVENGE, VARIETY, INACTIVE, REVEAL/HIDE, EXAGGERATE, EMBARRASS,
  TO STIR UP/REVOLT, RULE/PRINCIPLE/LAW, SPREAD, MALICIOUS SELF-SATISFACTION, and more.
  The list's MISCELLANEOUS section became small definition-named families (e.g. PANACEA →
  "CURE-ALL") so each word is quizzable in Lightning; DEVASTATE, CONTEMPORARY, GLUTTON and
  MERCENARY were merged into existing families, and INANE was skipped as already taught
  under STUPID/FOOLISH. Pure data change — no game code touched; validator, unit, smoke,
  and e2e suites all pass.

## 2026-06-28

### Added
- **Vocab Lists 12–13 ingested.** Added 51 new meaning-families and 269 word entries
  via the screenshot → game content pipeline, growing the dataset from 211 → **262
  families / 1,610 words** (1,715 total entries incl. antonyms). New themes span HUGE/BIG,
  CAREFUL/PRECISE, HINT/INDIRECT REFERENCE, WEAKEN, REMOVE/DESTROY, CAN'T DECIDE/FICKLE,
  ACTIVATE/SPEED UP, CONFIRM/SUPPORT, TO BLAME/ACCUSE/CHARGE, FREE FROM BLAME, and more.
  Pure data change — no game code touched; the dataset validator and unit suite pass.

## 2026-06-21

### Added
- **Vocab Lists 9–11 ingested.** Added 62 new meaning-families and 388 word entries
  via the screenshot → game content pipeline, growing the dataset from 149 → **211
  families / 1,345 words** (1,446 total entries incl. antonyms). New themes span RUDE,
  FLUENT/CLEAR, BRAVE, PUZZLING, ACCUSE/DEFAME, FRIENDLY, IRRITABLE, INTELLIGENT/WISE,
  PERSUADE, and more. Pure data change — no game code touched; the dataset validator and
  unit suite pass.

## 2026-06-19

### Added
- **Interactive charts in the `#admin` dashboard.** Hovering the Activity line charts
  scrubs to the nearest day, drawing a dashed guide line, a highlighted point, and a
  tooltip with that day's value and date. Hovering a By-mode bar brightens it and fades
  the rest so the focused one stands out. Pure CSS + SVG pointer handling — no chart
  library or extra bundle weight added.

## 2026-06-15

### Added
- **In-app feedback.** A **Feedback** button in the top bar opens a sheet to report a
  bug, send a suggestion / feature request, rate the app (1–5★), or leave general
  feedback. Submissions are stored in a dedicated, insert-only Supabase `feedback`
  table (separate from analytics `events`) and surfaced in the `#admin` dashboard
  (counts, average rating, latest notes). Identity (anon / session / signed-in user)
  is shared with analytics. With no backend configured — or if a write fails — it
  falls back to a `mailto:` link, so feedback is never lost.

### Safety
- A new **insert-only table only** — no change to the `localStorage` key, `GameState`
  shape, `mergeStates`, or the fail-closed sync contract, so signed-in players'
  progress is unaffected. `supabase/feedback.sql` is non-destructive
  (`create table if not exists` + new admin-gated read functions).

## 2026-06-14

### Changed
- **Lightning is now adaptive.** A correct answer masters the word outright and it
  drops out of the Lightning pool — only missed / not-yet-seen words repeat. Mastered
  words still surface in Clusters. The mastered count reflects a Lightning win
  immediately.

### Added
- **Full meaning-family reveals.** On reveal, Clusters (solved rows + results) shows
  the four sorted tiles plus every other family member (dimmed), and Lightning lists
  the entire family instead of a truncated sample — reinforcing which words belong
  together.

### Safety
- Verified no change to the `localStorage` key or `GameState` shape; cloud sync still
  max-merges mastery, so a merge can never downgrade a mastered word.

## Earlier

### Added
- Optional **email + password accounts** with local-first cloud sync (Supabase).
- **Admin analytics dashboard** at `#admin` with first-party, cookie-less event tracking.
- A real **test suite**: Vitest unit tests plus headless-Chrome smoke and full
  end-to-end playthrough harnesses, and a mobile responsiveness audit.
- The **screenshot → game content pipeline** (transcribe → curate → ingest) for
  growing the vocabulary dataset without touching game code.

### Security
- **Fail-closed sync contract:** a failed remote read never triggers a push, so a
  transient network error can't overwrite good cloud progress with an empty device.
