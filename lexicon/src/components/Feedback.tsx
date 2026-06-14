import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../lib/auth";
import {
  submitFeedback,
  feedbackMailto,
  validateFeedback,
  isFeedbackConfigured,
  MAX_MESSAGE,
  type FeedbackKind,
  type FeedbackInput,
} from "../lib/feedback";

/* Lightweight "share feedback" feature. One trigger in the topbar opens a sheet
 * where anyone can report a bug, send a suggestion/feature request, rate the app,
 * or leave general feedback — each stored as a row in the Supabase `feedback`
 * table (see lib/feedback.ts). Always available: when storage isn't configured,
 * or a write fails, the sheet offers a mailto fallback so nothing is lost. */

interface KindOption {
  kind: FeedbackKind;
  label: string;
  hint: string;
}

const KIND_OPTIONS: KindOption[] = [
  { kind: "bug", label: "Report a bug", hint: "Something looks or works wrong" },
  { kind: "suggestion", label: "Suggestion", hint: "An idea or feature request" },
  { kind: "rating", label: "Rate the app", hint: "Give it a 1–5 star rating" },
  { kind: "feedback", label: "General feedback", hint: "Anything else on your mind" },
];

const MESSAGE_PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: "What happened? What did you expect instead?",
  suggestion: "What would you like to see? What problem would it solve?",
  rating: "Anything you'd add? (optional)",
  feedback: "Tell us what's on your mind…",
};

/** Topbar button. Always shown — feedback works with or without Supabase. */
export function FeedbackTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="settings-trigger" onClick={onOpen} aria-label="Share feedback">
      <span className="trigger-ico" aria-hidden="true">✎</span>
      <span className="trigger-label">Feedback</span>
    </button>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="fb-stars" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={"fb-star " + (n <= shown ? "on" : "")}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          {n <= shown ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const input: FeedbackInput = {
    kind,
    message,
    rating: kind === "rating" ? rating : null,
    email: email || user?.email || "",
  };
  const canSubmit = validateFeedback(input) === null;

  function reset() {
    setKind("bug");
    setMessage("");
    setRating(0);
    setEmail("");
    setErr(null);
    setSent(false);
    setBusy(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await submitFeedback(input);
    setBusy(false);
    if (res.ok) {
      setSent(true);
      return;
    }
    if (res.reason === "not-configured") {
      // No backend on this build — hand off to email so the feedback still lands.
      setErr("This build can't store feedback directly — use the email option below and it'll reach us.");
      return;
    }
    setErr(res.error ?? "Couldn't send that. Try the email option below.");
  }

  return (
    <div className="settings-overlay" onClick={close}>
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3>{sent ? "Thank you" : "Share feedback"}</h3>
          <button className="settings-close" onClick={close} aria-label="Close feedback">✕</button>
        </div>

        {sent ? (
          <div className="settings-section">
            <p className="auth-account">Your feedback was sent — thank you for helping make Lexicon better.</p>
            <p className="settings-note">We read every note. Want to add something else?</p>
            <div className="fb-actions">
              <button className="btn btn-ghost" onClick={reset}>Send more</button>
              <button className="btn btn-primary" onClick={close}>Done</button>
            </div>
          </div>
        ) : (
          <form className="settings-section auth-form" onSubmit={submit}>
            <div className="settings-row">
              <span className="eyebrow">What's this about?</span>
              <div className="fb-kinds" role="radiogroup" aria-label="Feedback type">
                {KIND_OPTIONS.map((o) => (
                  <button
                    key={o.kind}
                    type="button"
                    className={"fb-kind " + (kind === o.kind ? "on" : "")}
                    onClick={() => { setKind(o.kind); setErr(null); }}
                    role="radio"
                    aria-checked={kind === o.kind}
                  >
                    <span className="fb-kind-label">{o.label}</span>
                    <span className="fb-kind-hint">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {kind === "rating" && (
              <div className="settings-row">
                <span className="settings-label">Your rating</span>
                <StarRating value={rating} onChange={(v) => { setRating(v); setErr(null); }} />
              </div>
            )}

            <label className="auth-field">
              <span className="settings-label">
                {kind === "rating" ? "Comments" : "Details"}
              </span>
              <textarea
                className="auth-input fb-textarea"
                value={message}
                maxLength={MAX_MESSAGE}
                onChange={(e) => { setMessage(e.target.value); setErr(null); }}
                placeholder={MESSAGE_PLACEHOLDER[kind]}
                rows={4}
              />
            </label>

            <label className="auth-field">
              <span className="settings-label">Email <span className="fb-optional">(optional, for a reply)</span></span>
              <input
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email || user?.email || ""}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            {err && (
              <div className="fb-error-block">
                <p className="auth-error">{err}</p>
                <a className="auth-toggle" href={feedbackMailto(input)}>Send by email instead →</a>
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy || !canSubmit}>
              {busy ? "Sending…" : "Send feedback"}
            </button>

            <p className="settings-note">
              {isFeedbackConfigured
                ? "Feedback is sent privately to the team. Add your email only if you'd like a reply."
                : "We'll open your email app to send this — nothing is stored on this device."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
