/* ============ Persistent store: mastery, streak, daily goal ============ */
(function () {
  const KEY = "gre_vocab_game_v1";

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function dayDiff(a, b) {
    // a,b are "Y-M-D"
    const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    const da = new Date(pa[0], pa[1] - 1, pa[2]);
    const db = new Date(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }

  const DEFAULT = {
    mastery: {},          // word -> level 0..3
    seen: {},             // word -> true (encountered)
    streak: 0,
    lastPlayed: null,     // "Y-M-D"
    daily: { day: null, points: 0, goal: 100, hitGoalDays: [] },
    totals: { rounds: 0, correct: 0, wrong: 0, points: 0 },
    settings: { upper: false, motion: true }
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      const data = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT)), data);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }

  let state = load();
  const subs = new Set();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function emit() { persist(); subs.forEach((fn) => fn(state)); }

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

  const Store = {
    get() { return state; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    level(word) { return state.mastery[word] || 0; },

    masteredCount() {
      let n = 0;
      for (const k in state.mastery) if (state.mastery[k] >= 3) n++;
      return n;
    },
    learningCount() {
      let n = 0;
      for (const k in state.mastery) if (state.mastery[k] >= 1 && state.mastery[k] < 3) n++;
      return n;
    },

    // record a single word result
    recordWord(word, correct) {
      state.seen[word] = true;
      const cur = state.mastery[word] || 0;
      let next = cur;
      if (correct) next = Math.min(3, cur + 1);
      else next = Math.max(0, cur - 1);
      state.mastery[word] = next;
      return next;
    },

    addPoints(p) {
      ensureDay();
      state.daily.points += p;
      state.totals.points += p;
      if (state.daily.points >= state.daily.goal && state.daily.hitGoalDays.indexOf(state.daily.day) === -1) {
        state.daily.hitGoalDays.push(state.daily.day);
      }
    },

    // call when a round/puzzle is completed
    finishRound(opts) {
      opts = opts || {};
      ensureDay();
      touchStreak();
      state.totals.rounds += 1;
      if (opts.correct) state.totals.correct += opts.correct;
      if (opts.wrong) state.totals.wrong += opts.wrong;
      emit();
    },

    // batch helper used mid-round (does not bump streak)
    commit() { emit(); },

    setGoal(g) { ensureDay(); state.daily.goal = g; emit(); },
    setSetting(k, v) { state.settings[k] = v; emit(); },

    reset() {
      state = JSON.parse(JSON.stringify(DEFAULT));
      emit();
    },

    // ---- portable backup / restore (carry progress across browsers/devices) ----
    exportCode() {
      try {
        const payload = { v: 1, t: Date.now(), state: state };
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      } catch (e) { return ""; }
    },
    importCode(code) {
      try {
        const payload = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        const incoming = payload && payload.state ? payload.state : payload;
        if (!incoming || typeof incoming !== "object" || !("mastery" in incoming)) return false;
        state = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), incoming);
        ensureDay();
        emit();
        return true;
      } catch (e) { return false; }
    },
    lastSaved() { return state.lastPlayed; },

    todayStr, dayDiff
  };

  // ensure daily is initialised on load (without bumping streak)
  ensureDay();
  // streak decay: if more than 1 day gap, reset to 0 on load
  if (state.lastPlayed && dayDiff(state.lastPlayed, todayStr()) > 1) {
    state.streak = 0;
  }
  persist();

  window.Store = Store;
})();
