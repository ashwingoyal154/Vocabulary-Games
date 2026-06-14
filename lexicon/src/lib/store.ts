/* ============ Persistent store: mastery, streak, daily goal ============ */

export interface DailyState {
  day: string | null;
  points: number;
  goal: number;
  hitGoalDays: string[];
}

export interface Totals {
  rounds: number;
  correct: number;
  wrong: number;
  points: number;
}

export interface Settings {
  upper: boolean;
  motion: boolean;
}

export type ReviewMode = "clusters" | "lightning" | "antonym";

/** A saved recap of one completed game session — the unit the "Share review"
 *  feature shares and the "Recent sessions" list shows. Stored inside GameState
 *  so it rides the existing localStorage save and Supabase mirror for free. */
export interface SessionReview {
  id: string;
  mode: ReviewMode;
  day: string;          // local day string (Store.todayStr), e.g. "2026-6-8"
  ts: number;           // Date.now() at completion — sort/merge key
  correct: number;      // quiz: questions right · clusters: groups solved
  total: number;        // quiz: round length · clusters: 4
  points: number;       // points earned during this session
  bestCombo?: number;   // quiz modes only
  marks?: boolean[];    // quiz modes: per-question correctness (recap grid)
  missed?: boolean;     // clusters: ran out of guesses
  mistakes?: number;    // clusters: wrong group guesses
}

export interface GameState {
  mastery: Record<string, number>;
  seen: Record<string, boolean>;
  streak: number;
  lastPlayed: string | null;
  daily: DailyState;
  totals: Totals;
  settings: Settings;
  reviews: SessionReview[];
}

const KEY = "gre_vocab_game_v1";
const MAX_REVIEWS = 50;

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function dayDiff(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const da = new Date(pa[0], pa[1] - 1, pa[2]);
  const db = new Date(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

const DEFAULT: GameState = {
  mastery: {},
  seen: {},
  streak: 0,
  lastPlayed: null,
  daily: { day: null, points: 0, goal: 100, hitGoalDays: [] },
  totals: { rounds: 0, correct: 0, wrong: 0, points: 0 },
  settings: { upper: false, motion: true },
  reviews: []
};

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function merge(data: Partial<GameState>): GameState {
  // Shallow-merge top-level keys, but deep-merge the fixed-shape nested objects so
  // older / partial saves that predate a field still get sane defaults (e.g. a saved
  // `daily` without `hitGoalDays` must not leave it undefined — addPoints() would throw).
  const base = clone(DEFAULT);
  const out = Object.assign(base, data);
  out.daily = Object.assign(clone(DEFAULT.daily), data.daily);
  out.totals = Object.assign(clone(DEFAULT.totals), data.totals);
  out.settings = Object.assign(clone(DEFAULT.settings), data.settings);
  out.reviews = Array.isArray(data.reviews) ? data.reviews.slice(0, MAX_REVIEWS) : [];
  return out;
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT);
    const data = JSON.parse(raw);
    return merge(data);
  } catch {
    return clone(DEFAULT);
  }
}

let state: GameState = load();
const subs = new Set<(s: GameState) => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}
function emit() {
  persist();
  subs.forEach((fn) => fn(state));
}

function ensureDay() {
  const t = todayStr();
  if (state.daily.day !== t) {
    state.daily = { day: t, points: 0, goal: state.daily.goal || 100, hitGoalDays: state.daily.hitGoalDays || [] };
  }
}

function touchStreak() {
  const t = todayStr();
  if (state.lastPlayed === t) return;
  if (state.lastPlayed && dayDiff(state.lastPlayed, t) === 1) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }
  state.lastPlayed = t;
}

export const Store = {
  get(): GameState { return state; },
  subscribe(fn: (s: GameState) => void) { subs.add(fn); return () => { subs.delete(fn); }; },

  level(word: string): number { return state.mastery[word] || 0; },

  masteredCount(): number {
    let n = 0;
    for (const k in state.mastery) if (state.mastery[k] >= 3) n++;
    return n;
  },
  learningCount(): number {
    let n = 0;
    for (const k in state.mastery) if (state.mastery[k] >= 1 && state.mastery[k] < 3) n++;
    return n;
  },

  recordWord(word: string, correct: boolean): number {
    state.seen[word] = true;
    const cur = state.mastery[word] || 0;
    const next = correct ? Math.min(3, cur + 1) : Math.max(0, cur - 1);
    state.mastery[word] = next;
    return next;
  },

  /** Mark a word fully mastered in one shot. Lightning uses this: a single correct
   *  answer there counts the word as mastered, which both bumps masteredCount() and
   *  removes it from the Lightning pool (only missed words repeat there). */
  masterWord(word: string): number {
    state.seen[word] = true;
    state.mastery[word] = 3;
    return 3;
  },

  addPoints(p: number) {
    ensureDay();
    state.daily.points += p;
    state.totals.points += p;
    if (state.daily.points >= state.daily.goal && state.daily.hitGoalDays.indexOf(state.daily.day!) === -1) {
      state.daily.hitGoalDays.push(state.daily.day!);
    }
  },

  finishRound(opts: { correct?: number; wrong?: number } = {}) {
    ensureDay();
    touchStreak();
    state.totals.rounds += 1;
    if (opts.correct) state.totals.correct += opts.correct;
    if (opts.wrong) state.totals.wrong += opts.wrong;
    emit();
  },

  commit() { emit(); },

  // ---- session reviews (shareable recaps of finished games) ----
  /** Save a completed session. Assigns an id, keeps newest first, caps history.
   *  Returns the stored review so callers can share it immediately. */
  addReview(r: Omit<SessionReview, "id">): SessionReview {
    const review: SessionReview = { ...r, id: makeId() };
    state.reviews = [review, ...state.reviews].slice(0, MAX_REVIEWS);
    emit();
    return review;
  },
  recentReviews(n: number = MAX_REVIEWS): SessionReview[] { return state.reviews.slice(0, n); },
  clearReviews() { state.reviews = []; emit(); },

  setGoal(g: number) { ensureDay(); state.daily.goal = g; emit(); },
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]) { state.settings[k] = v; emit(); },

  reset() {
    state = clone(DEFAULT);
    emit();
  },

  /** Replace the entire state (used by cloud sync). Normalizes through merge() so
   *  nested defaults are always present, then re-evaluates the current day. */
  replaceState(next: GameState) {
    state = merge(next);
    ensureDay();
    emit();
  },

  // ---- portable backup / restore (carry progress across browsers/devices) ----
  exportCode(): string {
    try {
      const payload = { v: 1, t: Date.now(), state };
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch {
      return "";
    }
  },
  importCode(code: string): boolean {
    try {
      const payload = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      const incoming = payload && payload.state ? payload.state : payload;
      if (!incoming || typeof incoming !== "object" || !("mastery" in incoming)) return false;
      state = merge(incoming);
      ensureDay();
      emit();
      return true;
    } catch {
      return false;
    }
  },
  lastSaved(): string | null { return state.lastPlayed; },

  todayStr,
  dayDiff
};

// ensure daily is initialised on load (without bumping streak)
ensureDay();
// streak decay: if more than 1 day gap, reset to 0 on load
if (state.lastPlayed && dayDiff(state.lastPlayed, todayStr()) > 1) {
  state.streak = 0;
}
persist();
