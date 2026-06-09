import { useState } from "react";
import type { SessionReview } from "../lib/store";
import { shareReview } from "../lib/share";

/* A self-contained "Share" button for a session review. It manages its own brief
 * confirmation label (Copied ✓ / Shared ✓) so it can drop into any screen without
 * needing a toast context wired in. */

export function ShareReviewButton({
  review,
  streak,
  className = "btn btn-ghost",
  label = "Share",
}: {
  review: SessionReview;
  streak?: number;
  className?: string;
  label?: string;
}) {
  const [note, setNote] = useState<string | null>(null);

  async function onShare() {
    const res = await shareReview(review, { streak });
    if (res === "cancelled") return; // user dismissed the native sheet — say nothing
    setNote(res === "failed" ? "Couldn't share" : res === "shared" ? "Shared ✓" : "Copied ✓");
    window.setTimeout(() => setNote(null), 1800);
  }

  return (
    <button className={className} onClick={onShare} aria-label="Share this session">
      {note ?? label}
    </button>
  );
}
