/**
 * Merge transcribed screenshot data into the canonical dataset (src/data/clusters.json).
 *
 * Input: one or more "candidate" JSON files, each an array of raw clusters
 *   [{ name, conn, words: ["FORTUITOUS", "X DESPAIR", ...] }, ...]
 * produced by transcribing word screenshots (see .claude/agents/vocab-transcriber).
 *
 * Merge rules (deterministic & non-destructive):
 *   • A candidate family whose name matches an existing one (case/space-insensitive)
 *     is MERGED into it — new words appended, duplicates skipped, conflicting roles flagged.
 *   • A candidate family with a new name is APPENDED.
 *   • Words are normalized to canonical UPPERCASE form; the run is rejected (no write)
 *     if the merged result fails validation.
 *
 * Usage:
 *   node scripts/ingest.mjs                      # consume every data/incoming/*.json
 *   node scripts/ingest.mjs path/to/file.json    # consume specific file(s)
 *   node scripts/ingest.mjs --dry-run            # preview only; write nothing, move nothing
 */
import { readdirSync, mkdirSync, existsSync, renameSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import {
  loadClusters, saveClusters, validate,
  parseWord, makeWord, normName, normTerm, DATA_PATH,
} from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const INCOMING_DIR = join(here, "..", "data", "incoming");
const PROCESSED_DIR = join(INCOMING_DIR, "processed");

const dryRun = process.argv.includes("--dry-run");
const fileArgs = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function resolveInputs() {
  if (fileArgs.length) return fileArgs;
  if (!existsSync(INCOMING_DIR)) return [];
  return readdirSync(INCOMING_DIR)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => join(INCOMING_DIR, f));
}

const inputs = resolveInputs();
if (inputs.length === 0) {
  console.log(`No candidate files. Drop transcribed *.json into ${INCOMING_DIR} (or pass a path).`);
  process.exit(0);
}

const clusters = loadClusters();
const byName = new Map(clusters.map((c) => [normName(c.name), c]));

let familiesAdded = 0, familiesUpdated = 0, wordsAdded = 0, dupSkipped = 0;
const conflicts = [];
const updatedNames = new Set();

function familyTermRoles(c) {
  const m = new Map();
  for (const w of c.words) { const { role, term } = parseWord(w); m.set(normTerm(term), role); }
  return m;
}

for (const file of inputs) {
  let candidate;
  try {
    candidate = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`✗ skipping ${basename(file)} — not valid JSON: ${e.message}`);
    continue;
  }
  if (!Array.isArray(candidate)) {
    console.error(`✗ skipping ${basename(file)} — top level must be an array of clusters`);
    continue;
  }

  for (const inc of candidate) {
    if (!inc || typeof inc.name !== "string" || !Array.isArray(inc.words)) {
      conflicts.push(`${basename(file)}: malformed cluster entry skipped`);
      continue;
    }
    const nn = normName(inc.name);
    const existing = byName.get(nn);

    // Dedupe within the candidate family itself first.
    const incSeen = new Set();

    if (existing) {
      const roles = familyTermRoles(existing);
      for (const w of inc.words) {
        const { role, term } = parseWord(String(w));
        const key = normTerm(term);
        if (!key || incSeen.has(key)) { dupSkipped++; continue; }
        incSeen.add(key);
        if (roles.has(key)) {
          if (roles.get(key) !== role) conflicts.push(`"${term}" in "${existing.name}": already ${roles.get(key)}, candidate says ${role} — kept existing`);
          dupSkipped++;
          continue;
        }
        existing.words.push(makeWord(role, term));
        roles.set(key, role);
        wordsAdded++;
        updatedNames.add(existing.name);
      }
    } else {
      const words = [];
      for (const w of inc.words) {
        const { role, term } = parseWord(String(w));
        const key = normTerm(term);
        if (!key || incSeen.has(key)) { dupSkipped++; continue; }
        incSeen.add(key);
        words.push(makeWord(role, term));
      }
      if (words.length === 0) { conflicts.push(`"${inc.name}": no usable words, skipped`); continue; }
      const fresh = { name: inc.name.trim(), conn: inc.conn ?? null, words };
      clusters.push(fresh);
      byName.set(nn, fresh);
      familiesAdded++;
      wordsAdded += words.length;
    }
  }
}
familiesUpdated = updatedNames.size;

// Reject the whole run if it would corrupt the dataset.
const { errors, warnings, stats } = validate(clusters);

console.log(`\n${dryRun ? "DRY RUN — " : ""}Ingest summary`);
console.log("─".repeat(60));
console.log(`  files processed ...... ${inputs.length}`);
console.log(`  families added ....... ${familiesAdded}`);
console.log(`  families updated ..... ${familiesUpdated}${updatedNames.size ? "  (" + [...updatedNames].join(", ") + ")" : ""}`);
console.log(`  words added .......... ${wordsAdded}`);
console.log(`  duplicates skipped ... ${dupSkipped}`);
console.log("─".repeat(60));
console.log(`  dataset now: ${stats.clusters} families / ${stats.entries} entries / ${stats.uniqueMembers} unique members`);

if (conflicts.length) {
  console.log(`\n${conflicts.length} note(s) for review:`);
  for (const c of conflicts) console.log(`  • ${c}`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} validation warning(s):`);
  for (const w of warnings.slice(0, 20)) console.log(`  • ${w}`);
  if (warnings.length > 20) console.log(`  …and ${warnings.length - 20} more`);
}

if (errors.length) {
  console.log(`\n${errors.length} validation error(s) — nothing written:`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`\nDry run complete — no files changed. Re-run without --dry-run to apply.`);
  process.exit(0);
}

if (familiesAdded === 0 && wordsAdded === 0) {
  console.log(`\nNothing new to merge. Dataset unchanged.`);
} else {
  saveClusters(clusters);
  console.log(`\n✓ Wrote ${DATA_PATH}`);
}

// Archive consumed incoming files so they aren't ingested twice (only those from the folder).
if (fileArgs.length === 0) {
  if (!existsSync(PROCESSED_DIR)) mkdirSync(PROCESSED_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const file of inputs) {
    try { renameSync(file, join(PROCESSED_DIR, `${stamp}__${basename(file)}`)); }
    catch (e) { console.error(`  (could not archive ${basename(file)}: ${e.message})`); }
  }
  console.log(`Archived ${inputs.length} consumed file(s) -> data/incoming/processed/`);
}
