import type { ReviewMode, SessionReview } from "./store";

/* Turns a saved SessionReview into a shareable, paste-anywhere recap and ships it
 * via the Web Share API where available (mobile), falling back to the clipboard. */

export const MODE_LABEL: Record<ReviewMode, string> = {
  clusters: "Clusters",
  lightning: "Lightning",
  antonym: "Antonyms",
};

// Color squares for a solved clusters board — matches CLUSTER_COLORS order
// (blue, rust, gold, green) used on the results screen.
const CLUSTER_SQUARES = ["🟦", "🟥", "🟨", "🟩"];

/** "2026-6-8" -> "Jun 8" in the viewer's locale. */
export function fmtDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Plain-text recap, e.g.
 *   Lexicon — Lightning · Jun 8
 *   9/12 correct · best ×5
 *   🟩🟩🟥🟩🟩🟩🟩🟥🟩🟩🟩🟩
 *   +124 pts · ▲ 5-day streak
 *   Play: Lexicon — GRE Vocabulary
 */
export function buildShareText(r: SessionReview, opts?: { streak?: number }): string {
  const lines: string[] = [`Lexicon — ${MODE_LABEL[r.mode]} · ${fmtDay(r.day)}`];

  if (r.mode === "clusters") {
    const solved = r.correct; // groups solved out of 4
    if (r.missed) {
      lines.push(`Ran out of guesses — solved ${solved}/4`);
    } else {
      const m = r.mistakes ?? 0;
      lines.push(`Solved 4/4${m === 0 ? " · flawless" : ` · ${m} mistake${m === 1 ? "" : "s"}`}`);
    }
    lines.push(CLUSTER_SQUARES.slice(0, solved).join("") || "—");
  } else {
    lines.push(`${r.correct}/${r.total} correct${r.bestCombo ? ` · best ×${r.bestCombo}` : ""}`);
    if (r.marks && r.marks.length) lines.push(r.marks.map((m) => (m ? "🟩" : "🟥")).join(""));
  }

  const tail: string[] = [];
  if (r.points) tail.push(`+${r.points} pts`);
  if (opts?.streak) tail.push(`▲ ${opts.streak}-day streak`);
  if (tail.length) lines.push(tail.join(" · "));

  lines.push("Play: Lexicon — GRE Vocabulary");
  return lines.join("\n");
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Share a review. Uses the native share sheet when present, otherwise copies the
 *  recap to the clipboard. "cancelled" means the user dismissed the share sheet. */
export async function shareReview(r: SessionReview, opts?: { streak?: number }): Promise<ShareResult> {
  const text = buildShareText(r, opts);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Lexicon", text });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      // Any other share failure (e.g. permission) falls through to clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
