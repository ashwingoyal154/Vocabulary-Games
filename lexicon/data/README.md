# Adding more words (screenshot → game)

The vocabulary is **data, not code**. The canonical dataset lives at
[`src/data/clusters.json`](../src/data/clusters.json) and is bundled into the app at
build time — so word lookups are instant and there is no database to pay for. Every
game mode, the Library, and mastery tracking derive from this one file
(`src/data/vocab-data.ts`), so the dataset can grow to thousands of words and the rest
of the app scales automatically.

## The pipeline

```
 screenshots                 candidate JSON              canonical dataset
 data/incoming/*.png   ──►    data/incoming/*.json   ──►  src/data/clusters.json
        (1) transcribe              (2) curate                 (3) ingest
```

1. **Transcribe** — drop word screenshots into `data/incoming/`, then run the
   `vocab-transcriber` agent. It reads the images (Claude Code's own vision — no paid
   API) and writes a candidate JSON, applying the symbol legend below.
2. **Curate** — run the `vocab-curator` agent. It reconciles the candidate against the
   existing families (merge vs. new, role/connotation tags, duplicates) and previews the
   merge with a dry run.
3. **Ingest** — merge into the canonical dataset and validate:
   ```sh
   node scripts/ingest.mjs            # consume every data/incoming/*.json
   node scripts/validate-data.mjs     # confirm the dataset is still valid
   ```

You can also do step 1–2 by hand (just author the candidate JSON yourself) and skip
straight to ingest.

## Candidate / cluster format

A candidate file is an array of families:

```json
[
  { "name": "VERY LITTLE", "conn": "-", "words": ["EXIGUOUS", "MEAGER", "* SPARE", "X AMPLE"] },
  { "name": "WEALTHY",     "conn": null, "words": ["OPULENT", "AFFLUENT"] }
]
```

### Symbol legend

A word's role is encoded as a leading prefix; the family's connotation lives on `conn`.

| On a **word** | Role | Write as |
|---|---|---|
| `X` | antonym | `"X WORD"` |
| `*` | near / slightly different | `"* WORD"` |
| `#` | unrelated | `"# WORD"` |
| (none) | synonym member | `"WORD"` |

| On the **family** | `conn` |
|---|---|
| `(+)` positive | `"+"` |
| `(-)` negative | `"-"` |
| (none) | `null` |

Words are stored UPPERCASE; the app handles display casing.

## Scripts

| Command (from `lexicon/`) | What it does |
|---|---|
| `npm run validate` | Validate `clusters.json`; print game-coverage stats. Exit 1 on errors. |
| `npm run ingest` | Merge every `data/incoming/*.json` into the canonical dataset, then validate. |
| `node scripts/ingest.mjs <file> --dry-run` | Preview a merge without writing or archiving anything. |

The validator runs automatically as part of `npm run build`, so a corrupt dataset can
never ship.

## Merge guarantees

- A candidate family whose name matches an existing one (case/space-insensitive) is
  **merged** into it; new words are appended, duplicates skipped, role conflicts flagged.
- A new family name is **appended**.
- Words are de-duplicated within a family (case-insensitive) and normalized to UPPERCASE.
- If the merged result fails validation, **nothing is written**.
- Consumed files from `data/incoming/` are archived to `data/incoming/processed/`.
