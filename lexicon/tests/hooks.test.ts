import { describe, expect, it } from "vitest";
import { displayWord, sample, shuffle } from "../src/lib/hooks";

describe("displayWord", () => {
  it("title-cases stored-uppercase words", () => {
    expect(displayWord("ABATE", false)).toBe("Abate");
  });

  it("title-cases each part across spaces and hyphens", () => {
    expect(displayWord("RUN-DOWN", false)).toBe("Run-Down");
    expect(displayWord("DE FACTO", false)).toBe("De Facto");
  });

  it("returns uppercase verbatim when the UPPERCASE setting is on", () => {
    expect(displayWord("run-down", true)).toBe("RUN-DOWN");
  });
});

describe("shuffle / sample", () => {
  it("shuffle keeps the same elements and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    const out = shuffle(input);
    expect(input).toEqual(copy);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("sample returns n distinct elements drawn from the array", () => {
    const input = ["a", "b", "c", "d"];
    const out = sample(input, 2);
    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(2);
    out.forEach((x) => expect(input).toContain(x));
  });

  it("sample of more than available returns everything", () => {
    expect(sample([1, 2], 5).sort()).toEqual([1, 2]);
  });
});
