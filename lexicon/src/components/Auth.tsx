import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../lib/auth";

function shortEmail(email: string | undefined): string {
  if (!email) return "Account";
  return email.length > 18 ? email.slice(0, 16) + "…" : email;
}

/** Topbar button. Renders nothing when Supabase isn't configured. */
export function AuthTrigger({ onOpen }: { onOpen: () => void }) {
  const { user, configured } = useAuth();
  if (!configured) return null;
  return (
    <button className="settings-trigger" onClick={onOpen} aria-label="Account">
      <span aria-hidden="true">{user ? "●" : "○"}</span> {user ? shortEmail(user.email) : "Sign in"}
    </button>
  );
}

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    const res = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    if (mode === "signup" && res.needsConfirm) {
      setInfo("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setPassword("");
      return;
    }
    onClose(); // session is live — progress sync runs automatically
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3>{user ? "Account" : mode === "signin" ? "Sign in" : "Create account"}</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {user ? (
          <div className="settings-section">
            <p className="auth-account">
              Signed in as <strong>{user.email}</strong>.
            </p>
            <p className="settings-note">
              Your progress syncs to this account — sign in on any device to pick up where you left off.
            </p>
            <button className="btn btn-ghost" onClick={async () => { await signOut(); onClose(); }}>
              Sign out
            </button>
          </div>
        ) : (
          <form className="settings-section auth-form" onSubmit={submit}>
            <label className="auth-field">
              <span className="settings-label">Email</span>
              <input
                className="auth-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="auth-field">
              <span className="settings-label">Password</span>
              <input
                className="auth-input"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              />
            </label>

            {err && <p className="auth-error">{err}</p>}
            {info && <p className="auth-info">{info}</p>}

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              className="auth-toggle"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setInfo(null); }}
            >
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>

            <p className="settings-note">
              Creating an account saves your current progress on this device and syncs it across your devices.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
