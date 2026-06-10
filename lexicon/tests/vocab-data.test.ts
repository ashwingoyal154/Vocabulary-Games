import { describe, expect, it } from "vitest";
import {
  ALL_MEMBER_WORDS,
  ANTONYM_CLUSTERS,
  BIG_CLUSTERS,
  CLUSTERS,
  WORD_INDEX,
} from "../src/data/vocab-data";

/* Invariants every game mode relies on. The dataset is content that grows over
 * time via the ingest pipeline — these tests make sure growth can't silently
 * break the parsing contract or starve a game mode. */

describe("cluster parsing", () => {
  it("parses at least one cluster and ids match array positions", () => {
    expect(CLUSTERS.length).toBeGreaterThan(0);
    CLUSTERS.forEach((c, i) => expect(c.id).toBe(i));
  });

  it("strips role prefixes — no parsed word starts with 'X ', '* ' or '# '", () => {
    for (const c of CLUSTERS) {
      for (const w of c.words) {
        expect(w.w).not.toMatch(/^([X*#] )/);
        expect(w.w.trim().length).toBeGreaterThan(0);
        expect(["s", "n", "x", "u"]).toContain(w.role);
      }
    }
  });

  it("stores words uppercase (displayWord depends on this)", () => {
    for (const c of CLUSTERS) {
      for (const w of c.words) expect(w.w).toBe(w.w.toUpperCase());
    }
  });

  it("members = synonyms + near-synonyms, antonyms = X-prefixed only", () => {
    for (const c of CLUSTERS) {
      const expectMembers = c.words.filter((w) => w.role === "s" || w.role === "n").map((w) => w.w);
      const expectAnts = c.words.filter((w) => w.role === "x").map((w) => w.w);
      expect(c.members).toEqual(expectMembers);
      expect(c.antonyms).toEqual(expectAnts);
    }
  });

  it("connotation is '+', '-' or null", () => {
    for (const c of CLUSTERS) expect(["+", "-", null]).toContain(c.conn);
  });
});

describe("word index", () => {
  it("every index entry points back to a cluster that contains the word", () => {
    for (const [word, entries] of Object.entries(WORD_INDEX)) {
      for (const e of entries) {
        const c = CLUSTERS[e.clusterId];
        expect(c).toBeDefined();
        expect(c.words.some((w) => w.w === word && w.role === e.role)).toBe(true);
      }
    }
  });

  it("every cluster word appears in the index", () => {
    for (const c of CLUSTERS) {
      for (const w of c.words) {
        expect(WORD_INDEX[w.w]?.some((e) => e.clusterId === c.id)).toBe(true);
      }
    }
  });
});

describe("game-mode coverage", () => {
  it("Clusters mode can always build a board (>=4 families with >=4 members)", () => {
    expect(BIG_CLUSTERS.length).toBeGreaterThanOrEqual(4);
    for (const c of BIG_CLUSTERS) expect(c.members.length).toBeGreaterThanOrEqual(4);
  });

  it("Antonym mode has playable families (>=1 antonym and >=1 member each)", () => {
    expect(ANTONYM_CLUSTERS.length).toBeGreaterThan(0);
    for (const c of ANTONYM_CLUSTERS) {
      expect(c.antonyms.length).toBeGreaterThanOrEqual(1);
      expect(c.members.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("Lightning mode has a healthy quiz pool and 3 distractor families available", () => {
    expect(ALL_MEMBER_WORDS.length).toBeGreaterThan(100);
    // every quizzable word must have at least one synonym-family to ask about
    for (const w of ALL_MEMBER_WORDS) {
      expect(WORD_INDEX[w].some((e) => e.role === "s" || e.role === "n")).toBe(true);
    }
    // and there must be enough other clusters to fill 3 wrong options
    expect(CLUSTERS.length).toBeGreaterThanOrEqual(4);
  });
});
