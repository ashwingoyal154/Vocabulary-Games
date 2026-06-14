import { beforeEach, describe, expect, it, vi } from "vitest";

/* Feedback validation + the submit/store path. Supabase is mocked so these are
 * deterministic whether or not a real .env is present — `h.client` controls
 * whether the build is "configured" and what an insert returns. */

const h = vi.hoisted(() => ({
  client: null as unknown,
  lastInsert: null as { table: string; row: Record<string, unknown> } | null,
}));

vi.mock("../src/lib/supabase", () => ({
  get supabase() { return h.client; },
  get isSupabaseConfigured() { return h.client !== null; },
}));

import {
  validateFeedback,
  submitFeedback,
  feedbackMailto,
  FEEDBACK_EMAIL,
  type FeedbackInput,
} from "../src/lib/feedback";

/** A minimal Supabase stand-in: records the insert and resolves with `error`. */
function fakeClient(error: { message: string } | null = null) {
  return {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          if (table === "feedback") h.lastInsert = { table, row };
          return Promise.resolve({ error });
        },
      };
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}

beforeEach(() => {
  h.client = null;
  h.lastInsert = null;
});

describe("validateFeedback", () => {
  it("requires a message for bug/suggestion/feedback", () => {
    expect(validateFeedback({ kind: "bug", message: "   " })).toMatch(/description/i);
    expect(validateFeedback({ kind: "suggestion", message: "" })).toMatch(/description/i);
    expect(validateFeedback({ kind: "feedback", message: "" })).toMatch(/description/i);
  });

  it("accepts those kinds once a message is present", () => {
    expect(validateFeedback({ kind: "bug", message: "The timer freezes" })).toBeNull();
  });

  it("requires a star for a rating, but not a message", () => {
    expect(validateFeedback({ kind: "rating", message: "" })).toMatch(/star/i);
    expect(validateFeedback({ kind: "rating", message: "", rating: 4 })).toBeNull();
  });

  it("rejects out-of-range ratings", () => {
    expect(validateFeedback({ kind: "rating", message: "", rating: 0 })).toMatch(/star/i);
    expect(validateFeedback({ kind: "rating", message: "", rating: 9 })).toMatch(/star/i);
  });

  it("rejects an over-long message", () => {
    expect(validateFeedback({ kind: "feedback", message: "x".repeat(4001) })).toMatch(/4000/);
  });
});

describe("submitFeedback — validation gate", () => {
  it("returns 'invalid' before touching storage when input is bad", async () => {
    const res = await submitFeedback({ kind: "bug", message: "" });
    expect(res).toEqual({ ok: false, reason: "invalid", error: expect.any(String) });
    expect(h.lastInsert).toBeNull();
  });
});

describe("submitFeedback — no backend configured", () => {
  it("returns 'not-configured' for valid input so the UI can offer the mailto fallback", async () => {
    const res = await submitFeedback({ kind: "bug", message: "Cards don't flip" });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("not-configured");
  });
});

describe("submitFeedback — Supabase configured", () => {
  it("writes one row to the `feedback` table and reports success", async () => {
    h.client = fakeClient(null);
    const res = await submitFeedback({ kind: "rating", message: "Great", rating: 5 });
    expect(res.ok).toBe(true);
    expect(h.lastInsert?.table).toBe("feedback");
    expect(h.lastInsert?.row).toMatchObject({ kind: "rating", rating: 5, message: "Great" });
  });

  it("normalizes a missing message to null and keeps anon/session identity", async () => {
    h.client = fakeClient(null);
    await submitFeedback({ kind: "rating", message: "   ", rating: 3 });
    expect(h.lastInsert?.row.message).toBeNull();
    expect(h.lastInsert?.row).toHaveProperty("anon_id");
    expect(h.lastInsert?.row).toHaveProperty("session_id");
  });

  it("surfaces a storage error as reason 'error'", async () => {
    h.client = fakeClient({ message: "permission denied" });
    const res = await submitFeedback({ kind: "bug", message: "Broken" });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("error");
    expect(res.error).toMatch(/permission denied/);
  });
});

describe("feedbackMailto", () => {
  const input: FeedbackInput = { kind: "rating", message: "Love it", rating: 5 };

  it("targets the owner and encodes the rating in the subject", () => {
    const url = feedbackMailto(input);
    expect(url.startsWith(`mailto:${FEEDBACK_EMAIL}?`)).toBe(true);
    expect(decodeURIComponent(url)).toContain("Rating — 5/5");
    expect(decodeURIComponent(url)).toContain("Love it");
  });

  it("falls back to a placeholder body when there's no message", () => {
    const url = feedbackMailto({ kind: "bug", message: "  " });
    expect(decodeURIComponent(url)).toContain("(no description)");
  });
});
