import { useEffect } from "react";
import { Store } from "../lib/store";
import { useAuth } from "../lib/auth";
import { mergeStates, pullRemote, pushRemote } from "../lib/sync";

/* Headless component: keeps the local store and the signed-in user's Supabase row
 * in sync. Renders nothing. Safe to mount unconditionally — it no-ops when signed
 * out or when Supabase isn't configured (pull/push return null/false). */

// Which account the local save currently belongs to. Lets us avoid leaking one
// user's progress into another account when they share a browser.
const OWNER_KEY = "gre_vocab_owner";

export function ProgressSync() {
  const { user } = useAuth();
  const userId = user?.id;

  // Reconcile local <-> remote whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { ok, state: remote } = await pullRemote(userId);
      if (cancelled) return;
      // Couldn't read the cloud (offline, transient error). Do nothing: don't
      // touch the local working copy, don't claim ownership, and — crucially —
      // don't push, which would clobber the user's saved cloud progress with
      // whatever is on this device (e.g. an empty save on a fresh browser).
      // We retry on the next reconcile rather than risk overwriting good data.
      if (!ok) return;
      const owner = localStorage.getItem(OWNER_KEY);

      if (!owner || owner === userId) {
        // Same account (or unclaimed guest progress): merge so nothing is lost.
        const merged = remote ? mergeStates(Store.get(), remote) : Store.get();
        Store.replaceState(merged);
      } else if (remote) {
        // A different account previously used this browser: load *their* account.
        Store.replaceState(remote);
      } else {
        // Brand-new account on a shared browser: start clean, don't inherit.
        Store.reset();
      }

      localStorage.setItem(OWNER_KEY, userId);
      await pushRemote(userId, Store.get());
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Debounced push on every progress change while signed in and reconciled.
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = Store.subscribe(() => {
      if (localStorage.getItem(OWNER_KEY) !== userId) return; // wait for reconcile
      clearTimeout(timer);
      timer = setTimeout(() => { void pushRemote(userId, Store.get()); }, 1200);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [userId]);

  return null;
}
