import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/* The reconcile rules that keep signed-in users' progress safe. The contract
 * (also documented in src/lib/sync.ts):
 *   1. a FAILED cloud read must change nothing and must never trigger a push —
 *      otherwise an empty device would overwrite good cloud progress;
 *   2. guest progress merges into the account on first sign-in;
 *   3. a different account on a shared browser never inherits the previous
 *      account's progress. */

const h = vi.hoisted(() => ({
  pull: vi.fn(),
  push: vi.fn(),
  userId: "user-a" as string | null,
}));

vi.mock("../src/lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/sync")>();
  return { ...actual, pullRemote: h.pull, pushRemote: h.push };
});

vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ user: h.userId ? { id: h.userId } : null }),
}));

import { ProgressSync } from "../src/components/ProgressSync";
import { Store, type GameState } from "../src/lib/store";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const OWNER_KEY = "gre_vocab_owner";

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

let root: Root | null = null;

async function mountSync() {
  const host = document.createElement("div");
  root = createRoot(host);
  await act(async () => {
    root!.render(<ProgressSync />);
  });
  // let the async reconcile (pull -> merge -> push) settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  localStorage.clear();
  Store.reset();
  h.pull.mockReset();
  h.push.mockReset();
  h.push.mockResolvedValue(true);
  h.userId = "user-a";
});

afterEach(async () => {
  if (root) {
    await act(async () => { root!.unmount(); });
    root = null;
  }
});

describe("reconcile on sign-in", () => {
  it("FAILED pull: changes nothing, claims nothing, and never pushes", async () => {
    Store.recordWord("PRECIOUS", true);
    Store.commit();
    h.pull.mockResolvedValue({ ok: false, state: null });

    await mountSync();

    expect(h.pull).toHaveBeenCalledWith("user-a");
    expect(h.push).not.toHaveBeenCalled();           // the load-bearing assertion
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
    expect(Store.get().mastery["PRECIOUS"]).toBe(1); // local untouched
  });

  it("successful pull with no saved row: pushes this device's progress and claims ownership", async () => {
    Store.recordWord("GUEST", true);
    Store.commit();
    h.pull.mockResolvedValue({ ok: true, state: null });

    await mountSync();

    expect(localStorage.getItem(OWNER_KEY)).toBe("user-a");
    expect(h.push).toHaveBeenCalledTimes(1);
    const pushed = h.push.mock.calls[0][1] as GameState;
    expect(pushed.mastery["GUEST"]).toBe(1);
  });

  it("successful pull with a saved row: merges guest + cloud so nothing is lost", async () => {
    Store.recordWord("LOCALWORD", true);
    Store.commit();
    h.pull.mockResolvedValue({ ok: true, state: makeState({ mastery: { CLOUDWORD: 3 }, streak: 4 }) });

    await mountSync();

    const s = Store.get();
    expect(s.mastery["LOCALWORD"]).toBe(1);
    expect(s.mastery["CLOUDWORD"]).toBe(3);
    expect(s.streak).toBe(4);
    expect(h.push).toHaveBeenCalledTimes(1);
  });

  it("different previous owner on this browser: loads the account's own cloud state, no merge", async () => {
    localStorage.setItem(OWNER_KEY, "user-b");
    Store.recordWord("USER_B_WORD", true);
    Store.commit();
    h.pull.mockResolvedValue({ ok: true, state: makeState({ mastery: { USER_A_WORD: 2 } }) });

    await mountSync();

    const s = Store.get();
    expect(s.mastery["USER_A_WORD"]).toBe(2);
    expect(s.mastery["USER_B_WORD"]).toBeUndefined(); // no leak between accounts
    expect(localStorage.getItem(OWNER_KEY)).toBe("user-a");
  });

  it("brand-new account on a shared browser: starts clean instead of inheriting", async () => {
    localStorage.setItem(OWNER_KEY, "user-b");
    Store.recordWord("USER_B_WORD", true);
    Store.commit();
    h.pull.mockResolvedValue({ ok: true, state: null });

    await mountSync();

    expect(Store.get().mastery).toEqual({});
    expect(localStorage.getItem(OWNER_KEY)).toBe("user-a");
  });

  it("signed out: no pull, no push", async () => {
    h.userId = null;
    await mountSync();
    expect(h.pull).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe("debounced push while signed in", () => {
  it("pushes progress changes made after reconcile", async () => {
    h.pull.mockResolvedValue({ ok: true, state: null });
    await mountSync();
    h.push.mockClear();

    Store.recordWord("NEWWORD", true);
    Store.commit();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1400)); // debounce is 1200ms
    });

    expect(h.push).toHaveBeenCalledTimes(1);
    const pushed = h.push.mock.calls[0][1] as GameState;
    expect(pushed.mastery["NEWWORD"]).toBe(1);
  }, 10000);

  it("does not push while the browser is owned by a different account", async () => {
    h.pull.mockResolvedValue({ ok: false, state: null }); // reconcile failed -> no ownership
    await mountSync();

    Store.recordWord("X", true);
    Store.commit();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1400));
    });

    expect(h.push).not.toHaveBeenCalled();
  }, 10000);
});
