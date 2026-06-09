import { supabase } from "./supabase";

/* Lightweight, first-party product analytics.
 *
 * `track(name, props)` fire-and-forgets one row into the Supabase `events` table
 * (see supabase/events.sql). No third-party service, no cookies — a random anon id
 * kept in localStorage identifies a browser across reloads, and a fresh session id
 * identifies a single page load. The signed-in user's id is attached when present,
 * so you can split guest vs account activity.
 *
 * When Supabase isn't configured the whole thing is a silent no-op, so the app
 * still runs fully local-only. Failures never throw into callers and never log at
 * `error` level (the smoke test fails on console errors).
 */

const ANON_KEY = "lex_anon_id";

function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = uuid(); localStorage.setItem(ANON_KEY, id); }
    return id;
  } catch {
    return "no-storage";
  }
}

// One id per page load — lets you count sessions and order events within a visit.
const SESSION_ID = uuid();

// Kept current by an auth subscription so track() can stay synchronous.
let currentUserId: string | null = null;
if (supabase) {
  void supabase.auth.getSession().then(({ data }) => { currentUserId = data.session?.user?.id ?? null; });
  supabase.auth.onAuthStateChange((_event, session) => { currentUserId = session?.user?.id ?? null; });
}

/** Record one analytics event. Never blocks the UI and never throws. */
export function track(name: string, props: Record<string, unknown> = {}): void {
  if (!supabase) return; // local-only build: analytics off
  try {
    void supabase
      .from("events")
      .insert({ anon_id: anonId(), user_id: currentUserId, session_id: SESSION_ID, name, props })
      .then(
        ({ error }) => { if (error) console.debug("[analytics] dropped", name, error.message); },
        (e) => { console.debug("[analytics] error", name, e); },
      );
  } catch (e) {
    console.debug("[analytics] threw", name, e);
  }
}
