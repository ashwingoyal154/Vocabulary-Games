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
      <span className="trigger-ico" aria-hidden="true">{user ? "●" : "○"}</span>
      <span className="trigger-label">{user ? shortEmail(user.email) : "Sign in"}</span>
    </button>
  );
}

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signIn, signUp, resendConfirm, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setCanResend(false);
    if (mode === "signup" && password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    const res = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      setCanResend(Boolean(res.needsConfirm));
      return;
    }
    if (mode === "signup" && res.needsConfirm) {
      setInfo(`We emailed a confirmation link to ${email} — click it, then sign in. (Check spam too.)`);
      setCanResend(true);
      setMode("signin");
      setPassword("");
      setConfirm("");
      return;
    }
    onClose(); // session is live — progress sync runs automatically
  }

  async function resend() {
    setBusy(true);
    const res = await resendConfirm(email);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setErr(null);
    setInfo(`Confirmation email re-sent to ${email} — check your inbox and spam folder.`);
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
              <div className="auth-input-wrap">
                <input
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                />
                <button
                  type="button"
                  className="auth-reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {mode === "signup" && (
              <label className="auth-field">
                <span className="settings-label">Confirm password</span>
                <input
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                />
              </label>
            )}

            {err && <p className="auth-error">{err}</p>}
            {info && <p className="auth-info">{info}</p>}
            {canResend && (
              <button type="button" className="auth-toggle" onClick={resend} disabled={busy || !email}>
                Resend confirmation email
              </button>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              className="auth-toggle"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setInfo(null); setConfirm(""); setCanResend(false); }}
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
