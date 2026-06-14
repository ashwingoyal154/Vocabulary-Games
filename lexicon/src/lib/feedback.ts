import { supabase, isSupabaseConfigured } from "./supabase";
import { track, getAnonId, getSessionId, getCurrentUserId } from "./analytics";

/* First-party user feedback.
 *
 * `submitFeedback(input)` validates and writes ONE row into the Supabase
 * `feedback` table (see supabase/feedback.sql) — separate from the analytics
 * `events` table, so reports/ratings/ideas live on their own and are easy to
 * triage. It reuses the same anon / session / user identity as analytics so a
 * piece of feedback can be tied back to a visitor.
 *
 * No paid service: storage is Supabase (free tier, optional). When Supabase
 * isn't configured — or an insert fails — nothing is lost: the caller can fall
 * back to `feedbackMailto(input)`, a plain mailto link to the site owner.
 */

export type FeedbackKind = "bug" | "feedback" | "rating" | "suggestion";

export const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "suggestion", "rating", "feedback"];

/** Where mailto-fallback feedback is sent (the site owner / analytics admin). */
export const FEEDBACK_EMAIL = "ashwingoyal154@gmail.com";

export const MAX_MESSAGE = 4000;

/** True when feedback persists to Supabase; otherwise the UI uses the mailto fallback. */
export const isFeedbackConfigured = isSupabaseConfigured;

export interface FeedbackInput {
  kind: FeedbackKind;
  /** Free-text description. Required for every kind except `rating`. */
  message: string;
  /** 1–5, only meaningful for `kind: "rating"`. */
  rating?: number | null;
  /** Optional reply-to address; defaults to the signed-in user's email in the UI. */
  email?: string | null;
}

export interface FeedbackResult {
  ok: boolean;
  /** machine-readable reason when `ok` is false */
  reason?: "invalid" | "not-configured" | "error";
  /** human-readable detail to surface in the UI */
  error?: string;
}

export const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: "Bug report",
  suggestion: "Suggestion",
  rating: "Rating",
  feedback: "Feedback",
};

function normalizeRating(r: number | null | undefined): number | null {
  if (r == null) return null;
  const n = Math.round(r);
  return n >= 1 && n <= 5 ? n : null;
}

/** Shared validation — returns an error string, or null when the input is sendable. */
export function validateFeedback(input: FeedbackInput): string | null {
  const message = (input.message ?? "").trim();
  if (input.kind === "rating") {
    if (normalizeRating(input.rating) == null) return "Pick a star rating first.";
  } else if (message.length === 0) {
    return "Add a short description first.";
  }
  if (message.length > MAX_MESSAGE) return `Keep it under ${MAX_MESSAGE} characters.`;
  return null;
}

/** Persist one piece of feedback. Never throws; returns a tagged result. */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const invalid = validateFeedback(input);
  if (invalid) return { ok: false, reason: "invalid", error: invalid };

  if (!supabase) return { ok: false, reason: "not-configured" };

  const message = (input.message ?? "").trim();
  const rating = normalizeRating(input.rating);
  const email = (input.email ?? "").trim() || null;

  const row = {
    anon_id: getAnonId(),
    user_id: getCurrentUserId(),
    session_id: getSessionId(),
    kind: input.kind,
    rating,
    message: message || null,
    email,
    props: {
      route: typeof window !== "undefined" ? window.location.hash || "/" : null,
      ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
  };

  try {
    const { error } = await supabase.from("feedback").insert(row);
    if (error) return { ok: false, reason: "error", error: error.message };
    track("feedback_submit", { kind: input.kind, rating, has_email: Boolean(email) });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** A `mailto:` link that carries the feedback — used when Supabase is off or an insert fails. */
export function feedbackMailto(input: FeedbackInput): string {
  const rating = normalizeRating(input.rating);
  const subject = `Lexicon ${KIND_LABEL[input.kind]}` + (rating ? ` — ${rating}/5` : "");
  const bodyLines = [
    `Type: ${KIND_LABEL[input.kind]}`,
    rating ? `Rating: ${rating}/5` : null,
    "",
    (input.message ?? "").trim() || "(no description)",
  ].filter((l) => l !== null);
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
}
