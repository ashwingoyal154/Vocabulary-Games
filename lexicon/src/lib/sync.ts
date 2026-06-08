import type { GameState } from "./store";
import { supabase } from "./supabase";

/* Cloud sync for game progress.
 *
 * Strategy: the app stays local-first (localStorage is the working copy). When the
 * user is signed in we mirror that state to a single per-user row in Supabase
 * (`game_state.state` jsonb) and merge on sign-in so progress is never lost when
 * combining a device's guest progress with an existing account.
 */
const TABLE = "game_state";

function toTime(day: string | null): number {
  if (!day) return 0;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function laterDay(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return toTime(a) >= toTime(b) ? a : b;
}

/** Combine two saves without losing progress. `local` wins ties for device-specific
 *  preferences (settings); everything cumulative takes the better of the two. */
export function mergeStates(local: GameState, remote: GameState): GameState {
  const mastery: Record<string, number> = { ...remote.mastery };
  for (const w in local.mastery) mastery[w] = Math.max(mastery[w] ?? 0, local.mastery[w]);

  const seen: Record<string, boolean> = { ...remote.seen };
  for (const w in local.seen) if (local.seen[w]) seen[w] = true;

  const hitGoalDays = Array.from(new Set([
    ...(local.daily.hitGoalDays || []),
    ...(remote.daily.hitGoalDays || []),
  ]));

  let daily: GameState["daily"];
  if (local.daily.day && local.daily.day === remote.daily.day) {
    daily = {
      day: local.daily.day,
      points: Math.max(local.daily.points, remote.daily.points),
      goal: local.daily.goal || remote.daily.goal,
      hitGoalDays,
    };
  } else {
    const newer = toTime(local.daily.day) >= toTime(remote.daily.day) ? local.daily : remote.daily;
    daily = { ...newer, hitGoalDays };
  }

  return {
    mastery,
    seen,
    streak: Math.max(local.streak, remote.streak),
    lastPlayed: laterDay(local.lastPlayed, remote.lastPlayed),
    daily,
    totals: {
      rounds: Math.max(local.totals.rounds, remote.totals.rounds),
      correct: Math.max(local.totals.correct, remote.totals.correct),
      wrong: Math.max(local.totals.wrong, remote.totals.wrong),
      points: Math.max(local.totals.points, remote.totals.points),
    },
    // device-local preference — keep what's set on this device
    settings: local.settings,
  };
}

/** Fetch the signed-in user's saved state, or null if they have none yet. */
export async function pullRemote(userId: string): Promise<GameState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[sync] pull failed:", error.message);
    return null;
  }
  return (data?.state as GameState | undefined) ?? null;
}

/** Upsert the signed-in user's state. Returns whether it persisted. */
export async function pushRemote(userId: string, state: GameState): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
  if (error) {
    console.warn("[sync] push failed:", error.message);
    return false;
  }
  return true;
}
