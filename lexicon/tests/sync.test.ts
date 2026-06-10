import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../src/lib/store";

/* mergeStates is the function that decides what survives when a device's guest
 * progress meets an account's cloud progress — the "never lose progress" core.
 * pullRemote/pushRemote carry the fail-closed contract: a failed read must be
 * distinguishable from "no saved row" so callers never overwrite good cloud data. */

const h = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock("../src/lib/supabase", () => ({
  get supabase() { return h.client; },
  get isSupabaseConfigured() { return h.client !== null; },
}));

import { mergeStates, pullRemote, pushRemote } from "../src/lib/sync";

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    mastery: {},
    seen: {},
    streak: 0,
    lastPlayed: null,
    daily: { day: null, points: 0, goal: 100, hitGoalDays: [] },
    totals: { rounds: 0, correct: 0, wrong: 0, points: 0 },
    settings: { upper: false, motion: true },
    reviews: [],
    ...over,
  };
}

beforeEach(() => {
  h.client = null;
});

describe("mergeStates — combining two saves never loses progress", () => {
  it("takes the higher mastery per word and unions both vocabularies", () => {
    const merged = mergeStates(
      makeState({ mastery: { SHARED: 1, LOCAL: 2 } }),
      makeState({ mastery: { SHARED: 3, REMOTE: 1 } }),
    );
    expect(merged.mastery).toEqual({ SHARED: 3, LOCAL: 2, REMOTE: 1 });
  });

  it("unions seen words", () => {
    const merged = mergeStates(
      makeState({ seen: { A: true } }),
      makeState({ seen: { B: true } }),
    );
    expect(merged.seen).toEqual({ A: true, B: true });
  });

  it("keeps the better streak, later lastPlayed, and max of every total", () => {
    const merged = mergeStates(
      makeState({ streak: 2, lastPlayed: "2026-6-9", totals: { rounds: 10, correct: 50, wrong: 20, points: 900 } }),
      makeState({ streak: 6, lastPlayed: "2026-6-7", totals: { rounds: 12, correct: 40, wrong: 30, points: 700 } }),
    );
    expect(merged.streak).toBe(6);
    expect(merged.lastPlayed).toBe("2026-6-9");
    expect(merged.totals).toEqual({ rounds: 12, correct: 50, wrong: 30, points: 900 });
  });

  it("same-day daily: max points, union of goal-hit days", () => {
    const merged = mergeStates(
      makeState({ daily: { day: "2026-6-10", points: 40, goal: 140, hitGoalDays: ["2026-6-8"] } }),
      makeState({ daily: { day: "2026-6-10", points: 90, goal: 100, hitGoalDays: ["2026-6-9"] } }),
    );
    expect(merged.daily.day).toBe("2026-6-10");
    expect(merged.daily.points).toBe(90);
    expect(merged.daily.goal).toBe(140); // local goal wins when set
    expect(merged.daily.hitGoalDays.sort()).toEqual(["2026-6-8", "2026-6-9"]);
  });

  it("different days: the newer day's bucket wins, hit days still unioned", () => {
    const merged = mergeStates(
      makeState({ daily: { day: "2026-6-8", points: 500, goal: 100, hitGoalDays: ["2026-6-8"] } }),
      makeState({ daily: { day: "2026-6-10", points: 30, goal: 120, hitGoalDays: ["2026-6-10"] } }),
    );
    expect(merged.daily.day).toBe("2026-6-10");
    expect(merged.daily.points).toBe(30);
    expect(new Set(merged.daily.hitGoalDays)).toEqual(new Set(["2026-6-8", "2026-6-10"]));
  });

  it("keeps this device's settings", () => {
    const merged = mergeStates(
      makeState({ settings: { upper: true, motion: false } }),
      makeState({ settings: { upper: false, motion: true } }),
    );
    expect(merged.settings).toEqual({ upper: true, motion: false });
  });

  it("unions reviews by id, newest first, capped at 50", () => {
    const mk = (id: string, ts: number) => ({ id, ts, mode: "lightning" as const, day: "2026-6-10", correct: 1, total: 12, points: 1 });
    const local = makeState({ reviews: [mk("a", 5), mk("dup", 100)] });
    const remote = makeState({ reviews: [mk("dup", 100), ...Array.from({ length: 52 }, (_, i) => mk("r" + i, i + 10))] });
    const merged = mergeStates(local, remote);
    expect(merged.reviews).toHaveLength(50);
    expect(merged.reviews.filter((r) => r.id === "dup")).toHaveLength(1); // de-duped, kept (newest)
    expect(merged.reviews.find((r) => r.id === "a")).toBeUndefined();     // oldest fell off the cap
    const ts = merged.reviews.map((r) => r.ts);
    expect(ts).toEqual([...ts].sort((a, b) => b - a)); // newest first
  });

  it("handles old remote saves that predate reviews/hitGoalDays fields", () => {
    const remote = makeState();
    delete (remote as Partial<GameState>).reviews;
    (remote.daily as Partial<GameState["daily"]>).hitGoalDays = undefined;
    const merged = mergeStates(makeState({ mastery: { A: 1 } }), remote);
    expect(merged.mastery).toEqual({ A: 1 });
    expect(merged.reviews).toEqual([]);
  });
});

describe("pullRemote — fail-closed read contract", () => {
  it("returns ok:false when Supabase isn't configured", async () => {
    h.client = null;
    expect(await pullRemote("u1")).toEqual({ ok: false, state: null });
  });

  it("returns ok:false on a database error (never 'no progress')", async () => {
    h.client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "boom" } }) }) }),
      }),
    };
    const res = await pullRemote("u1");
    expect(res.ok).toBe(false);
    expect(res.state).toBeNull();
  });

  it("returns ok:true with state:null when the user simply has no row", async () => {
    h.client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    };
    expect(await pullRemote("u1")).toEqual({ ok: true, state: null });
  });

  it("returns ok:true with the saved state when a row exists", async () => {
    const saved = makeState({ streak: 3 });
    h.client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { state: saved }, error: null }) }) }),
      }),
    };
    const res = await pullRemote("u1");
    expect(res.ok).toBe(true);
    expect(res.state?.streak).toBe(3);
  });
});

describe("pushRemote", () => {
  it("returns false when Supabase isn't configured", async () => {
    h.client = null;
    expect(await pushRemote("u1", makeState())).toBe(false);
  });

  it("returns false when the upsert fails, true when it persists", async () => {
    h.client = { from: () => ({ upsert: async () => ({ error: { message: "nope" } }) }) };
    expect(await pushRemote("u1", makeState())).toBe(false);
    h.client = { from: () => ({ upsert: async () => ({ error: null }) }) };
    expect(await pushRemote("u1", makeState())).toBe(true);
  });
});
