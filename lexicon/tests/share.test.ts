import { describe, expect, it } from "vitest";
import { buildShareText, fmtDay, MODE_LABEL } from "../src/lib/share";
import type { SessionReview } from "../src/lib/store";

function review(over: Partial<SessionReview> = {}): SessionReview {
  return {
    id: "r1",
    mode: "lightning",
    day: "2026-6-8",
    ts: 0,
    correct: 9,
    total: 12,
    points: 124,
    ...over,
  };
}

describe("buildShareText — quiz modes", () => {
  it("includes score, best combo, marks row, points and streak", () => {
    const text = buildShareText(review({ bestCombo: 5, marks: [true, false, true] }), { streak: 5 });
    const lines = text.split("\n");
    expect(lines[0]).toBe("Lexicon — Lightning · " + fmtDay("2026-6-8"));
    expect(lines[1]).toBe("9/12 correct · best ×5");
    expect(lines[2]).toBe("🟩🟥🟩");
    expect(lines[3]).toBe("+124 pts · ▲ 5-day streak");
    expect(lines[4]).toBe("Play: Lexicon — GRE Vocabulary");
  });

  it("omits the tail line when there are no points and no streak", () => {
    const text = buildShareText(review({ points: 0 }));
    expect(text).not.toContain("pts");
    expect(text).not.toContain("streak");
    expect(text.split("\n").pop()).toBe("Play: Lexicon — GRE Vocabulary");
  });
});

describe("buildShareText — clusters", () => {
  it("flawless solve", () => {
    const text = buildShareText(review({ mode: "clusters", correct: 4, total: 4, mistakes: 0 }));
    expect(text).toContain("Solved 4/4 · flawless");
    expect(text).toContain("🟦🟥🟨🟩");
  });

  it("solve with mistakes (singular/plural)", () => {
    expect(buildShareText(review({ mode: "clusters", correct: 4, total: 4, mistakes: 1 }))).toContain("1 mistake");
    expect(buildShareText(review({ mode: "clusters", correct: 4, total: 4, mistakes: 2 }))).toContain("2 mistakes");
  });

  it("ran out of guesses shows partial squares", () => {
    const text = buildShareText(review({ mode: "clusters", correct: 2, total: 4, missed: true, mistakes: 4 }));
    expect(text).toContain("Ran out of guesses — solved 2/4");
    expect(text).toContain("🟦🟥");
    expect(text).not.toContain("🟨");
  });

  it("zero groups solved renders a dash, not an empty line", () => {
    const text = buildShareText(review({ mode: "clusters", correct: 0, total: 4, missed: true }));
    expect(text.split("\n")).toContain("—");
  });
});

describe("fmtDay", () => {
  it("formats a store day string into a short date", () => {
    const out = fmtDay("2026-6-8");
    expect(out).toMatch(/8/);
    expect(out).not.toBe("2026-6-8");
  });

  it("returns malformed input unchanged", () => {
    expect(fmtDay("not-a-day")).toBe("not-a-day");
  });
});

describe("MODE_LABEL", () => {
  it("covers every review mode", () => {
    expect(MODE_LABEL.clusters).toBe("Clusters");
    expect(MODE_LABEL.lightning).toBe("Lightning");
    expect(MODE_LABEL.antonym).toBe("Antonyms");
  });
});
