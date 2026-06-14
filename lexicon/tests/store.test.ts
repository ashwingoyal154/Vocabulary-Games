import { beforeEach, describe, expect, it, vi } from "vitest";

/* The store is a module-level singleton that reads localStorage at import time,
 * so every test gets a fresh module via resetModules + dynamic import. The
 * localStorage key is part of the product's compatibility contract — existing
 * players' saves live under it — so these tests pin it explicitly. */

const KEY = "gre_vocab_game_v1";

function localDayStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

async function freshStore() {
  vi.resetModules();
  const mod = await import("../src/lib/store");
  return mod.Store;
}

beforeEach(() => {
  localStorage.clear();
});

describe("persistence key", () => {
  it("saves under gre_vocab_game_v1 (existing users' saves must keep loading)", async () => {
    const Store = await freshStore();
    Store.commit();
    expect(localStorage.getItem(KEY)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.mastery).toEqual({});
  });
});

describe("loading old / partial / corrupt saves", () => {
  it("fills nested defaults missing from an old save (daily.hitGoalDays, totals, settings, reviews)", async () => {
    localStorage.setItem(KEY, JSON.stringify({
      mastery: { FOO: 2 },
      streak: 4,
      lastPlayed: localDayStr(),
      daily: { day: localDayStr(), points: 10, goal: 100 }, // no hitGoalDays
      // no totals / settings / seen / reviews at all
    }));
    const Store = await freshStore();
    const s = Store.get();
    expect(s.mastery).toEqual({ FOO: 2 });
    expect(s.streak).toBe(4);
    expect(s.daily.hitGoalDays).toEqual([]);
    expect(s.totals).toEqual({ rounds: 0, correct: 0, wrong: 0, points: 0 });
    expect(s.settings).toEqual({ upper: false, motion: true });
    expect(s.reviews).toEqual([]);
    // the field addPoints() relies on must be usable immediately
    expect(() => Store.addPoints(200)).not.toThrow();
    expect(s.daily.hitGoalDays).toContain(localDayStr());
  });

  it("falls back to defaults on corrupt JSON without throwing", async () => {
    localStorage.setItem(KEY, "{not json");
    const Store = await freshStore();
    expect(Store.get().mastery).toEqual({});
    expect(Store.get().daily.goal).toBe(100);
  });

  it("rolls the daily bucket over to today but keeps goal and hitGoalDays", async () => {
    const yesterday = localDayStr(-1);
    localStorage.setItem(KEY, JSON.stringify({
      mastery: {},
      daily: { day: yesterday, points: 80, goal: 140, hitGoalDays: [yesterday] },
    }));
    const Store = await freshStore();
    const d = Store.get().daily;
    expect(d.day).toBe(localDayStr());
    expect(d.points).toBe(0);
    expect(d.goal).toBe(140);
    expect(d.hitGoalDays).toEqual([yesterday]);
  });
});

describe("streaks", () => {
  it("extends the streak when last played yesterday", async () => {
    localStorage.setItem(KEY, JSON.stringify({ mastery: {}, streak: 5, lastPlayed: localDayStr(-1) }));
    const Store = await freshStore();
    expect(Store.get().streak).toBe(5); // 1-day gap: not decayed on load
    Store.finishRound({ correct: 3 });
    expect(Store.get().streak).toBe(6);
    expect(Store.get().lastPlayed).toBe(localDayStr());
  });

  it("decays a broken streak to 0 on load, then restarts at 1 on next play", async () => {
    localStorage.setItem(KEY, JSON.stringify({ mastery: {}, streak: 7, lastPlayed: localDayStr(-3) }));
    const Store = await freshStore();
    expect(Store.get().streak).toBe(0);
    Store.finishRound();
    expect(Store.get().streak).toBe(1);
  });

  it("does not double-bump the streak for two rounds on the same day", async () => {
    const Store = await freshStore();
    Store.finishRound();
    Store.finishRound();
    expect(Store.get().streak).toBe(1);
  });
});

describe("mastery and points", () => {
  it("clamps mastery between 0 and 3", async () => {
    const Store = await freshStore();
    expect(Store.recordWord("ABATE", false)).toBe(0); // can't go below 0
    expect(Store.recordWord("ABATE", true)).toBe(1);
    Store.recordWord("ABATE", true);
    Store.recordWord("ABATE", true);
    expect(Store.recordWord("ABATE", true)).toBe(3); // capped at 3
    expect(Store.get().seen["ABATE"]).toBe(true);
  });

  it("counts mastered (>=3) and learning (1..2) words", async () => {
    const Store = await freshStore();
    for (let i = 0; i < 3; i++) Store.recordWord("AAA", true);
    Store.recordWord("BBB", true);
    expect(Store.masteredCount()).toBe(1);
    expect(Store.learningCount()).toBe(1);
  });

  it("masterWord jumps a word straight to mastered in one shot (Lightning rule)", async () => {
    const Store = await freshStore();
    expect(Store.masterWord("ZEAL")).toBe(3); // one correct Lightning answer = mastered
    expect(Store.level("ZEAL")).toBe(3);
    expect(Store.get().seen["ZEAL"]).toBe(true);
    expect(Store.masteredCount()).toBe(1);
  });

  it("records a goal-hit day exactly once", async () => {
    const Store = await freshStore();
    Store.addPoints(120);
    Store.addPoints(50);
    const d = Store.get().daily;
    expect(d.points).toBe(170);
    expect(d.hitGoalDays.filter((x) => x === d.day)).toHaveLength(1);
    expect(Store.get().totals.points).toBe(170);
  });
});

describe("session reviews", () => {
  it("keeps newest first and caps history at 50", async () => {
    const Store = await freshStore();
    for (let i = 0; i < 55; i++) {
      Store.addReview({ mode: "lightning", day: localDayStr(), ts: i, correct: i, total: 12, points: 10 });
    }
    const reviews = Store.recentReviews();
    expect(reviews).toHaveLength(50);
    expect(reviews[0].correct).toBe(54); // newest first
    expect(new Set(reviews.map((r) => r.id)).size).toBe(50); // unique ids
  });
});

describe("backup / restore codes", () => {
  it("round-trips full state through exportCode/importCode", async () => {
    const Store = await freshStore();
    Store.recordWord("LUCID", true);
    Store.addPoints(42);
    Store.commit();
    const code = Store.exportCode();
    expect(code).toBeTruthy();

    Store.reset();
    expect(Store.get().mastery).toEqual({});
    expect(Store.importCode(code)).toBe(true);
    expect(Store.get().mastery["LUCID"]).toBe(1);
    expect(Store.get().totals.points).toBe(42);
  });

  it("accepts a legacy bare-state payload (no {v,t,state} wrapper)", async () => {
    const Store = await freshStore();
    const bare = btoa(unescape(encodeURIComponent(JSON.stringify({ mastery: { OLD: 3 } }))));
    expect(Store.importCode(bare)).toBe(true);
    expect(Store.get().mastery["OLD"]).toBe(3);
    expect(Store.get().daily.goal).toBe(100); // defaults filled in
  });

  it("rejects garbage without changing state", async () => {
    const Store = await freshStore();
    Store.recordWord("KEEP", true);
    Store.commit();
    expect(Store.importCode("definitely-not-base64!!!")).toBe(false);
    expect(Store.importCode(btoa("42"))).toBe(false); // valid JSON, not a state
    expect(Store.get().mastery["KEEP"]).toBe(1);
  });
});

describe("replaceState (cloud sync entry point)", () => {
  it("normalizes a partial incoming state through merge()", async () => {
    const Store = await freshStore();
    Store.replaceState({ mastery: { CLOUD: 2 } } as never);
    const s = Store.get();
    expect(s.mastery["CLOUD"]).toBe(2);
    expect(s.daily.goal).toBe(100);
    expect(s.settings.motion).toBe(true);
    expect(s.reviews).toEqual([]);
  });

  it("persists the replaced state to localStorage", async () => {
    const Store = await freshStore();
    Store.replaceState({ ...Store.get(), streak: 9 });
    expect(JSON.parse(localStorage.getItem(KEY)!).streak).toBe(9);
  });
});
