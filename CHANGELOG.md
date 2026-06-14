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
- **In-app feedback** — bug reports, suggestions, and 1–5★ ratings into a dedicated
  insert-only table, surfaced in the admin dashboard, with a `mailto:` fallback.
- A real **test suite**: Vitest unit tests plus headless-Chrome smoke and full
  end-to-end playthrough harnesses, and a mobile responsiveness audit.
- The **screenshot → game content pipeline** (transcribe → curate → ingest) for
  growing the vocabulary dataset without touching game code.

### Security
- **Fail-closed sync contract:** a failed remote read never triggers a push, so a
  transient network error can't overwrite good cloud progress with an empty device.
