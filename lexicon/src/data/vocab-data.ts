/* GRE Vocabulary — meaning-family dataset.
 * Each cluster: { name, conn: '+'|'-'|null, words: [...] }
 * Word string prefixes encode role:
 *   "X "  -> antonym  (role 'x')
 *   "* "  -> near / slightly different (role 'n')
 *   "# "  -> unrelated, neither syn nor antonym (role 'u')
 *   (none)-> synonym  (role 's')
 */

import rawClusters from "./clusters.json";

export type Connotation = "+" | "-" | null;
export type WordRole = "s" | "n" | "x" | "u";

export interface ParsedWord {
  w: string;
  role: WordRole;
}

export interface Cluster {
  id: number;
  name: string;
  conn: Connotation;
  words: ParsedWord[];
  /** synonyms + near-synonyms — the "members" of the family */
  members: string[];
  antonyms: string[];
}

export interface WordIndexEntry {
  clusterId: number;
  role: WordRole;
}

export interface RawCluster {
  name: string;
  conn: Connotation;
  words: string[];
}

/** Canonical vocabulary, sourced from the append-friendly data file. The screenshot
 *  ingestion pipeline (scripts/ingest.mjs) writes here; everything below derives from it. */
const RAW: RawCluster[] = rawClusters as unknown as RawCluster[];

function parseWord(s: string): ParsedWord {
  if (s.startsWith("X ")) return { w: s.slice(2), role: "x" };
  if (s.startsWith("* ")) return { w: s.slice(2), role: "n" };
  if (s.startsWith("# ")) return { w: s.slice(2), role: "u" };
  return { w: s, role: "s" };
}

export const CLUSTERS: Cluster[] = RAW.map((c, i) => {
  const words = c.words.map(parseWord);
  return {
    id: i,
    name: c.name,
    conn: c.conn,
    words,
    members: words.filter((x) => x.role === "s" || x.role === "n").map((x) => x.w),
    antonyms: words.filter((x) => x.role === "x").map((x) => x.w)
  };
});

export const WORD_INDEX: Record<string, WordIndexEntry[]> = {};
CLUSTERS.forEach((c) => {
  c.words.forEach((x) => {
    const key = x.w;
    if (!WORD_INDEX[key]) WORD_INDEX[key] = [];
    WORD_INDEX[key].push({ clusterId: c.id, role: x.role });
  });
});

export const ALL_MEMBER_WORDS: string[] = Object.keys(WORD_INDEX).filter((w) =>
  WORD_INDEX[w].some((e) => e.role === "s" || e.role === "n")
);

/** clusters that can host a 4-tile group in the Clusters game */
export const BIG_CLUSTERS: Cluster[] = CLUSTERS.filter((c) => c.members.length >= 4);

/** clusters with antonyms (for the Antonym mode) */
export const ANTONYM_CLUSTERS: Cluster[] = CLUSTERS.filter((c) => c.antonyms.length >= 1 && c.members.length >= 1);
