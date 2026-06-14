# Origin: from Claude Design prototype to shipped app

Lexicon began as a **Claude Design** ([claude.ai/design](https://claude.ai/design))
prototype and was implemented for real by a coding agent. This document preserves
the original handoff note and explains what the root folders contain.

## How it was built

1. **Design.** The UI was mocked up in HTML/CSS/JS in Claude Design — the visual
   source of truth.
2. **Handoff.** The prototypes, assets, and the full design conversation were
   exported as a bundle.
3. **Implementation.** A coding agent read the transcripts and prototypes, then
   rebuilt the design as a production React + Vite + TypeScript app in
   [`../lexicon/`](../lexicon/) — matching the visual output rather than copying the
   prototype's internal structure.

## What the root folders are

| Path | What it is |
|---|---|
| [`lexicon/`](../lexicon/) | **The real app.** Implemented React/Vite/TS game. |
| `project/` | The original HTML/CSS/JS design prototypes (`Lexicon.html`, components, `store.js`). The source of intent — not shipped code. |
| `chats/` | The design conversation transcript(s). The prototypes are the output; the chat is where the *intent* lives. |

## Original handoff note

> **CODING AGENTS: READ THIS FIRST**
>
> This is a **handoff bundle** from Claude Design.
>
> A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported
> this bundle so a coding agent can implement the designs for real.
>
> - **Read the chat transcripts first** (`chats/`) — they tell you what the user
>   actually wants and where they landed after iterating.
> - **Read `project/Lexicon.html` in full**, then follow its imports, before
>   implementing.
> - The design medium is HTML/CSS/JS — these are prototypes, not production code.
>   Recreate them in whatever technology fits the target codebase; match the visual
>   output, don't copy the prototype's internal structure.
> - If anything is ambiguous, confirm with the user before implementing.
