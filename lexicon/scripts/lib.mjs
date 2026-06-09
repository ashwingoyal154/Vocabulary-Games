/**
 * Shared helpers for the vocabulary data pipeline (validate + ingest).
 *
 * The canonical dataset is src/data/clusters.json — an array of raw clusters:
 *   { name: string, conn: "+" | "-" | null, words: string[] }
 *
 * A word string encodes its role with a leading prefix (mirrors src/data/vocab-data.ts):
 *   "X "  -> antonym            (role 'x')
 *   "* "  -> near / slightly different (role 'n')
 *   "# "  -> unrelated          (role 'u')
 *   (none)-> synonym            (role 's')
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_PATH = join(here, "..", "src", "data", "clusters.json");

export const PREFIXES = { "X ": "x", "* ": "n", "# ": "u" };
export const CONNOTATIONS = new Set(["+", "-", null]);

export function loadClusters(path = DATA_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveClusters(clusters, path = DATA_PATH) {
  writeFileSync(path, JSON.stringify(clusters, null, 2) + "\n", "utf8");
}

/** Split a word string into { prefix, role, term } using the role prefixes. */
export function parseWord(s) {
  for (const [prefix, role] of Object.entries(PREFIXES)) {
    if (s.startsWith(prefix)) return { prefix, role, term: s.slice(prefix.length) };
  }
  return { prefix: "", role: "s", term: s };
}

/** Canonical comparison key for a family name (case/space-insensitive). */
export const normName = (name) => String(name).trim().replace(/\s+/g, " ").toUpperCase();

/** Canonical comparison key for a word term, ignoring role prefix. */
export const normTerm = (term) => String(term).trim().replace(/\s+/g, " ").toUpperCase();

/** Re-assemble a word string from a role + term, in canonical (UPPERCASE, single-spaced) form. */
export function makeWord(role, term) {
  const t = String(term).trim().replace(/\s+/g, " ").toUpperCase();
  const prefix = Object.entries(PREFIXES).find(([, r]) => r === role)?.[0] ?? "";
  return prefix + t;
}

/**
 * Validate a clusters array. Returns { errors, warnings, stats }.
 * `errors` are blocking (corrupt data); `warnings` are worth a human glance but non-fatal.
 */
export function validate(clusters) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(clusters)) {
    return { errors: ["top-level value is not an array"], warnings, stats: {} };
  }

  let entries = 0, members = 0, antonyms = 0, unrelated = 0, near = 0;
  let bigClusters = 0, antonymClusters = 0, memberlessClusters = 0;
  const memberHomes = new Map();   // term -> [family names] (for cross-family dup report)
  const names = new Map();         // normName -> family name (duplicate-family detection)

  clusters.forEach((c, i) => {
    const where = `cluster #${i}` + (c && c.name ? ` ("${c.name}")` : "");

    if (typeof c !== "object" || c === null) { errors.push(`${where}: not an object`); return; }
    if (typeof c.name !== "string" || !c.name.trim()) errors.push(`${where}: missing/empty "name"`);
    if (!CONNOTATIONS.has(c.conn ?? null)) errors.push(`${where}: "conn" must be "+", "-", or null (got ${JSON.stringify(c.conn)})`);
    if (!Array.isArray(c.words) || c.words.length === 0) { errors.push(`${where}: "words" must be a non-empty array`); return; }

    const nn = normName(c.name);
    if (names.has(nn)) errors.push(`${where}: duplicate family name (also "${names.get(nn)}") — merge them`);
    else names.set(nn, c.name);

    const seenInCluster = new Set();
    let memberCount = 0, antonymCount = 0;

    c.words.forEach((w) => {
      entries++;
      if (typeof w !== "string" || !w.trim()) { errors.push(`${where}: empty word entry`); return; }
      const { role, term, prefix } = parseWord(w);
      if (!term.trim()) { errors.push(`${where}: word "${w}" has a prefix but no term`); return; }
      if (/^[^A-Za-z(]/.test(w) && !prefix) {
        warnings.push(`${where}: word "${w}" starts with an unexpected symbol — encode role as "X "/"* "/"# " or remove it`);
      }
      if (/\([+-]\)/.test(w)) warnings.push(`${where}: word "${w}" contains a (+)/(-) marker — connotation belongs on the cluster's "conn", not the word`);

      const key = normTerm(term);
      if (seenInCluster.has(key)) errors.push(`${where}: duplicate word "${term}" within the family`);
      seenInCluster.add(key);

      if (role === "x") { antonyms++; antonymCount++; }
      else if (role === "u") unrelated++;
      else {
        if (role === "n") near++;
        members++; memberCount++;
        if (!memberHomes.has(key)) memberHomes.set(key, []);
        memberHomes.get(key).push(c.name);
      }
    });

    if (memberCount >= 4) bigClusters++;
    if (antonymCount >= 1 && memberCount >= 1) antonymClusters++;
    if (memberCount === 0) { memberlessClusters++; warnings.push(`${where}: has no synonym members — it won't be teachable as a family`); }
  });

  // Cross-family duplicate members (allowed — a word with two senses — but surfaced).
  const crossDups = [...memberHomes.entries()].filter(([, homes]) => homes.length > 1);
  for (const [term, homes] of crossDups) {
    warnings.push(`word "${term}" is a member of ${homes.length} families: ${homes.join(", ")}`);
  }

  const uniqueMembers = memberHomes.size;
  const stats = {
    clusters: clusters.length,
    entries, members, near, antonyms, unrelated,
    uniqueMembers,
    bigClusters, antonymClusters, memberlessClusters,
    crossFamilyMembers: crossDups.length,
  };

  return { errors, warnings, stats };
}
