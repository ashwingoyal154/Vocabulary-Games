import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthSheet } from "../components/Auth";
import { BarChart, LineChart } from "../components/Charts";
import "../styles/dashboard.css";

interface Overview {
  days: number; events: number; visitors: number; signed_in_users: number;
  app_opens: number; rounds_started: number; rounds_finished: number;
  sign_ups: number; sign_ins: number;
}
interface DailyRow { day: string; visitors: number; events: number; finishes: number; }
interface ModeRow {
  mode: string; opens: number; starts: number; finishes: number;
  avg_points: number | null; avg_pct: number | null;
}
interface RecentRow {
  ts: string; name: string; props: Record<string, unknown>;
  anon_id: string; user_id: string | null;
}

const RANGES = [7, 30, 90];
const MODE_COLOR: Record<string, string> = {
  clusters: "var(--c-blue)", lightning: "var(--c-gold)", antonym: "var(--c-rust)", study: "var(--c-green)",
};
const EVENT_COLOR: Record<string, string> = {
  round_finish: "var(--c-green)", round_start: "var(--c-gold)", mode_open: "var(--c-blue)",
  sign_up: "var(--c-plum)", sign_in: "var(--c-plum)", app_open: "var(--ink-faint)",
};

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return Math.round((part / whole) * 100) + "%";
}
function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}
function timeAgo(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${Math.floor(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export function Dashboard({ onExit }: { onExit: () => void }) {
  const { user, configured, signOut } = useAuth();
  const [days, setDays] = useState(30);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [modes, setModes] = useState<ModeRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);

  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const mine = ++reqId.current;
    setLoading(true); setErr(null);
    const [o, d, m, r] = await Promise.all([
      supabase.rpc("analytics_overview", { p_days: days }),
      supabase.rpc("analytics_daily", { p_days: days }),
      supabase.rpc("analytics_by_mode", { p_days: days }),
      supabase.rpc("analytics_recent", { p_limit: 40 }),
    ]);
    if (mine !== reqId.current) return; // a newer load superseded this one
    const failure = o.error || d.error || m.error || r.error;
    if (failure) {
      setErr(/not authorized/i.test(failure.message)
        ? "This account isn't the analytics admin. Sign out and sign in with your admin email (the one set in dashboard.sql)."
        : failure.message);
      setLoading(false);
      return;
    }
    setOverview(o.data as Overview);
    setDaily((d.data as DailyRow[]) ?? []);
    setModes((m.data as ModeRow[]) ?? []);
    setRecent((r.data as RecentRow[]) ?? []);
    setUpdatedAt(Date.now());
    setLoading(false);
  }, [days, user]);

  // Reload whenever the range/user changes. This is a genuine data-sync effect
  // (Supabase is the external system); the spinner flip it triggers is intended.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Live-ish: refresh every 60s while the tab is open and signed in.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => { void load(); }, 60000);
    return () => clearInterval(t);
  }, [user, load]);

  if (!configured) {
    return <DashShell onExit={onExit}><div className="dash-msg"><h2>Analytics not configured</h2>
      <p>Set <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> and run the SQL in <code>supabase/</code>.</p></div></DashShell>;
  }

  if (!user) {
    return (
      <DashShell onExit={onExit}>
        <div className="dash-msg">
          <h2>Sign in to view analytics</h2>
          <p>Use your admin account (the email set in <code>dashboard.sql</code>).</p>
          <button className="btn btn-primary" onClick={() => setAuthOpen(true)}>Sign in</button>
        </div>
        <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      </DashShell>
    );
  }

  const o = overview;
  const finishRate = o ? pct(o.rounds_finished, o.rounds_started) : "—";
  const visitorSeries = daily.map((r) => ({ label: shortDay(r.day), value: r.visitors }));
  const finishSeries = daily.map((r) => ({ label: shortDay(r.day), value: r.finishes }));
  const modeFinishBars = modes
    .filter((m) => m.mode !== "study")
    .map((m) => ({ label: m.mode, value: m.finishes, color: MODE_COLOR[m.mode] ?? "var(--c-blue)" }));
  const modeOpenBars = modes.map((m) => ({
    label: m.mode, value: m.opens, color: MODE_COLOR[m.mode] ?? "var(--ink-soft)",
  }));

  return (
    <DashShell onExit={onExit}>
      <div className="dash-top" style={{ marginTop: -6 }}>
        <div className="dash-updated">
          {loading ? "Refreshing…" : updatedAt ? `Updated ${timeAgo(new Date(updatedAt).toISOString())} ago · auto-refreshes` : ""}
        </div>
        <div className="dash-controls">
          <div className="dash-range">
            {RANGES.map((r) => (
              <button key={r} className={r === days ? "on" : ""} onClick={() => setDays(r)}>{r}d</button>
            ))}
          </div>
          <button className="dash-refresh" onClick={() => void load()}>↻</button>
        </div>
      </div>

      {err && (
        <div className="dash-msg">
          <p className="dash-err">{err}</p>
          <button className="btn btn-ghost" onClick={async () => { await signOut(); }}>Sign out</button>
        </div>
      )}

      {!err && o && (
        <>
          <div className="kpis">
            <Kpi num={o.visitors} label="Visitors" />
            <Kpi num={o.signed_in_users} label="Accounts active" />
            <Kpi num={o.app_opens} label="App opens" />
            <Kpi num={o.rounds_finished} label="Rounds finished" />
            <Kpi num={finishRate} label="Finish rate" />
            <Kpi num={o.sign_ups} label="Sign-ups" />
          </div>

          <div className="card">
            <div className="card-head"><h2>Activity · last {days} days</h2></div>
            <div className="card-grid">
              <div>
                <div className="lc-foot" style={{ marginBottom: 4 }}><span>Daily visitors</span></div>
                <LineChart data={visitorSeries} color="var(--c-blue)" />
              </div>
              <div>
                <div className="lc-foot" style={{ marginBottom: 4 }}><span>Rounds finished</span></div>
                <LineChart data={finishSeries} color="var(--c-green)" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>By mode</h2></div>
            <div className="card-grid">
              <div>
                <div className="lc-foot" style={{ marginBottom: 8 }}><span>Opens</span></div>
                <BarChart data={modeOpenBars} />
              </div>
              <div>
                <div className="lc-foot" style={{ marginBottom: 8 }}><span>Rounds finished</span></div>
                <BarChart data={modeFinishBars} />
              </div>
            </div>
            {modes.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="mode-table">
                  <thead>
                    <tr><th>Mode</th><th>Opens</th><th>Started</th><th>Finished</th><th>Finish %</th><th>Avg pts</th><th>Avg score</th></tr>
                  </thead>
                  <tbody>
                    {modes.map((m) => (
                      <tr key={m.mode}>
                        <td>{m.mode}</td>
                        <td>{m.opens}</td>
                        <td>{m.starts}</td>
                        <td>{m.finishes}</td>
                        <td>{m.starts ? pct(m.finishes, m.starts) : "—"}</td>
                        <td>{m.avg_points ?? "—"}</td>
                        <td>{m.avg_pct != null ? m.avg_pct + "%" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head"><h2>Recent events</h2><span className="dash-updated">latest {recent.length}</span></div>
            <div className="feed">
              {recent.length === 0 && <div className="chart-empty">No events yet.</div>}
              {recent.map((e, i) => {
                const mode = typeof e.props?.mode === "string" ? e.props.mode : null;
                return (
                  <div className="feed-row" key={i}>
                    <span className="feed-dot" style={{ background: EVENT_COLOR[e.name] ?? "var(--ink-faint)" }} />
                    <span className="feed-meta">
                      <span className="feed-name">{e.name}</span>
                      {mode ? ` · ${mode}` : ""}
                      {e.user_id ? " · account" : " · guest"}
                    </span>
                    <span className="feed-time">{timeAgo(e.ts)} ago</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </DashShell>
  );
}

function DashShell({ onExit, children }: { onExit: () => void; children: ReactNode }) {
  return (
    <div className="dash">
      <div className="dash-top">
        <h1>Lex<em>icon</em> · Analytics</h1>
        <div className="dash-controls">
          <button className="dash-refresh" onClick={onExit}>← Game</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Kpi({ num, label }: { num: number | string; label: string }) {
  return (
    <div className="kpi">
      <span className="kpi-num">{num}</span>
      <span className="kpi-label">{label}</span>
    </div>
  );
}
