# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything exploitable.

- Preferred: open a private report via GitHub's
  [**Security → Report a vulnerability**](https://github.com/ashwingoyal154/Vocabulary-Games/security/advisories/new)
  (private vulnerability reporting).
- Or email **ashwingoyal154@gmail.com** with steps to reproduce.

You'll get an acknowledgement within a few days. Please give a reasonable window
to ship a fix before any public disclosure.

## Security model (what's in scope)

Lexicon is a static single-page app with an **optional** Supabase backend. Useful
context for assessing a report:

- **No secrets in the client.** The only env vars shipped to the browser are
  `VITE_SUPABASE_URL` and the Supabase **anon/publishable** key — both are designed
  to be public. Data is protected by **row-level security**, not by hiding the key.
- **Row-level security is the boundary.** `game_state` rows are readable/writable
  only by their owner. The analytics `events` table is **insert-only** for the anon
  role (the browser can write events but can't read anyone's data). The `#admin`
  dashboard aggregates are gated server-side by an admin email check.
- **Known, accepted limitation:** because analytics inserts use the public anon key,
  a determined user could submit junk events. If this ever matters, the insert moves
  behind an Edge Function or rate limiting (noted in `lexicon/README.md`).
- **Player progress integrity** is treated as a first-class safety property — see the
  fail-closed sync contract in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Supported versions

This is a continuously deployed app; only the current `main` / production deployment
is supported. There are no long-lived release branches to backport to.
