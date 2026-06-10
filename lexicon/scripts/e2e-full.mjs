/**
 * Full end-to-end test for the Lexicon app — the "manual playthrough", automated.
 *
 * Where smoke.mjs proves every screen mounts, this drives complete user journeys
 * over the DevTools Protocol (no extra deps, Node 22+):
 *
 *   1. an old/partial localStorage save loads cleanly (migration / progress safety)
 *   2. a full 12-question Lightning round: scoring, recap, session review
 *   3. progress survives a page reload
 *   4. settings (UPPERCASE) apply and persist
 *   5. Library search narrows results
 *   6. an Antonyms question answers and teaches
 *   7. a Clusters board plays to completion and "Next puzzle" deals a fresh board
 *   8. backup -> reset -> restore round-trip carries progress
 *   9. the #admin hash shows the analytics gate and returns to the game
 *
 * Fails on any assertion or any console error / uncaught exception.
 *
 * Usage:
 *   npm run dev          (in another terminal)
 *   npm run e2e          # tests http://localhost:5173/
 *   npm run e2e <url>    # test a different URL
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.argv[2] || process.env.E2E_URL || "http://localhost:5173/";
const PORT = 9223;
const KEY = "gre_vocab_game_v1";

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) fail("Could not find Chrome/Chromium. Set CHROME_PATH to a browser binary.");
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

try {
  const res = await fetch(URL);
  if (!res.ok) fail(`server at ${URL} returned HTTP ${res.status}`);
} catch {
  fail(`server not reachable at ${URL} — start it first (npm run dev).`);
}

const CHROME = findChrome();
const profile = mkdtempSync(join(tmpdir(), "lexicon-e2e-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-allow-origins=*", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

const errors = [];
let id = 0;
const pending = new Map();

function send(ws, method, params = {}) {
  return new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

async function openTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" });
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* CDP not up yet */ }
    await sleep(250);
  }
  fail("Chrome DevTools endpoint did not come up.");
}

function cleanup(code) {
  try { chrome.kill(); } catch { /* already gone */ }
  process.exit(code);
}

const wsUrl = await openTarget();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    errors.push("exception: " + (d?.exception?.description || d?.text));
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errors.push("console.error: " + m.params.args.map((a) => a.value || a.description || "").join(" "));
  }
};

await send(ws, "Runtime.enable");
await send(ws, "Page.enable");

async function navigate(extraWait = 0) {
  await send(ws, "Page.navigate", { url: URL });
  await sleep(2200 + extraWait);
}

async function evalInPage(expr) {
  const r = await send(ws, "Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) fail("in-page eval threw: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

const checks = [];
function check(name, ok, detail = "") {
  checks.push([name, !!ok, detail]);
}

/* Shared in-page helpers injected before each journey. */
const HELPERS = `
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const clickText = (sel, text) => {
    const el = $$(sel).find(e => e.textContent.includes(text));
    if (el) { el.click(); return true; } return false;
  };
  const setInput = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const save = () => JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "null");
`;

// ---------- Phase 1: old/partial save loads cleanly ----------
await navigate();
const phase1 = await evalInPage(`(async () => { ${HELPERS}
  const d = new Date(Date.now() - 86400000);
  const yesterday = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  // an "old version" save: no seen/totals/settings/reviews, daily missing hitGoalDays
  localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify({
    mastery: { ZWORDA: 2, ZWORDB: 3 },
    streak: 4,
    lastPlayed: yesterday,
    daily: { day: yesterday, points: 55, goal: 100 },
  }));
  return true;
})()`);
check("old save: seeded", phase1);

await navigate();
const phase1b = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  out.hubRendered = !!$(".hub");
  out.streakShown = ($(".stat-pill.flame")?.textContent || "").includes("4");
  const s = save();
  out.upgraded = Array.isArray(s.daily.hitGoalDays) && !!s.settings && !!s.totals && Array.isArray(s.reviews);
  out.masteryKept = s.mastery.ZWORDA === 2 && s.mastery.ZWORDB === 3;
  out.dailyRolled = s.daily.points === 0; // yesterday's bucket rolled to today
  return out;
})()`);
check("old save: app boots on it", phase1b.hubRendered);
check("old save: streak survives (yesterday -> today keeps chain)", phase1b.streakShown);
check("old save: missing fields get defaults", phase1b.upgraded);
check("old save: mastery preserved", phase1b.masteryKept);
check("old save: daily bucket rolls to today", phase1b.dailyRolled);

// ---------- Phase 2: full Lightning round ----------
const phase2 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  clickText(".mode-card", "Lightning");
  await sleep(500);
  out.entered = !!$(".qcard");
  for (let i = 0; i < 12; i++) {
    const opts = $$(".qopt:not([disabled])");
    if (!opts.length) { out.stuckAt = i; break; }
    opts[Math.floor(Math.random() * opts.length)].click();
    await sleep(120);
    const btn = $$("button").find(b => /Continue|See results/.test(b.textContent));
    if (!btn) { out.noContinueAt = i; break; }
    btn.click();
    await sleep(150);
  }
  await sleep(400);
  out.results = !!$(".results");
  out.recapCells = $$(".recap-cell").length;
  out.shareBtn = !!$$("button").find(b => b.getAttribute("aria-label") === "Share this session");
  const s = save();
  out.roundCounted = s.totals.rounds >= 1;
  out.reviewSaved = Array.isArray(s.reviews) && s.reviews.length === 1 && s.reviews[0].mode === "lightning" && s.reviews[0].total === 12;
  out.streakBumped = s.streak === 5; // 4 (yesterday) + today's play
  clickText("button", "Hub");
  await sleep(400);
  out.recentSessions = $$(".review-row").length === 1;
  return out;
})()`);
check("lightning: round enters", phase2.entered);
check("lightning: 12 questions complete to results", phase2.results, JSON.stringify(phase2));
check("lightning: recap grid has 12 cells", phase2.recapCells === 12, `got ${phase2.recapCells}`);
check("lightning: share button on results", phase2.shareBtn);
check("lightning: round recorded in totals", phase2.roundCounted);
check("lightning: session review saved", phase2.reviewSaved);
check("lightning: streak extends 4 -> 5", phase2.streakBumped);
check("hub: recent sessions lists the round", phase2.recentSessions);

// ---------- Phase 3: progress survives reload ----------
await navigate();
const phase3 = await evalInPage(`(async () => { ${HELPERS}
  const s = save();
  return {
    streak: s.streak === 5,
    review: s.reviews.length === 1,
    pill: ($(".stat-pill.flame")?.textContent || "").includes("5"),
    sessions: $$(".review-row").length === 1,
  };
})()`);
check("reload: streak persists", phase3.streak && phase3.pill);
check("reload: session review persists", phase3.review && phase3.sessions);

// ---------- Phase 4: settings apply + persist ----------
const phase4 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  // AuthTrigger shares the .settings-trigger class — pick the real settings button
  $$(".settings-trigger").find(b => b.getAttribute("aria-label") === "Open settings")?.click();
  await sleep(300);
  out.sheet = !!$(".settings-sheet") && !!$(".seg-control");
  clickText(".seg-btn", "UPPERCASE");
  await sleep(200);
  $(".settings-close")?.click();
  await sleep(200);
  out.saved = save().settings.upper === true;
  return out;
})()`);
check("settings: sheet opens", phase4.sheet);
check("settings: UPPERCASE persists to save", phase4.saved);

// ---------- Phase 5: library search + uppercase display ----------
const phase5 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  clickText(".study-link", "Browse");
  await sleep(500);
  const first = $(".lw-text")?.textContent?.trim() || "";
  out.upperApplied = first !== "" && first === first.toUpperCase();
  const before = $$(".lib-word").length;
  setInput($(".lib-search"), first);
  await sleep(600); // 150ms debounce + rerender
  const after = $$(".lib-word").length;
  out.searchNarrows = after > 0 && after < before;
  out.searchFinds = $$(".lw-text").some(e => e.textContent.trim() === first);
  setInput($(".lib-search"), "zzzznotaword");
  await sleep(600);
  out.emptyState = !!$(".lib-empty");
  clickText(".back-link", "Hub");
  await sleep(300);
  return out;
})()`);
check("library: UPPERCASE setting reflected", phase5.upperApplied);
check("library: search narrows results", phase5.searchNarrows);
check("library: search finds the word", phase5.searchFinds);
check("library: empty state for no matches", phase5.emptyState);

// ---------- Phase 6: one Antonyms question ----------
const phase6 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  clickText(".mode-card", "Antonyms");
  await sleep(500);
  out.entered = !!$(".q-anchor");
  $$(".qopt")[0]?.click();
  await sleep(300);
  out.teach = !!$(".q-teach");
  out.reveal = !!$(".qopt.right");
  clickText(".back-link", "Hub");
  await sleep(300);
  return out;
})()`);
check("antonyms: question renders", phase6.entered);
check("antonyms: answer reveals teach panel", phase6.teach);
check("antonyms: correct option highlighted", phase6.reveal);

// ---------- Phase 7: clusters to completion ----------
const phase7 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  clickText(".mode-card", "Clusters");
  await sleep(500);
  out.entered = $$(".ctile").length === 16;
  for (let round = 0; round < 12 && !$(".results"); round++) {
    const desel = $$("button").find(b => b.textContent.trim() === "Deselect");
    if (desel && !desel.disabled) { desel.click(); await sleep(100); }
    const tiles = $$(".ctile").slice(0, 4);
    if (tiles.length < 4) break;
    for (const t of tiles) { t.click(); }
    await sleep(120);
    const submit = $$(".btn-primary").find(b => b.textContent.trim() === "Submit");
    if (!submit || submit.disabled) { out.submitStuck = round; break; }
    submit.click();
    await sleep(450);
  }
  out.done = !!$(".results");
  out.groupsShown = $$(".rgroup").length === 4;
  out.shareBtn = !!$$("button").find(b => b.getAttribute("aria-label") === "Share this session");
  const s = save();
  out.reviewSaved = s.reviews.some(r => r.mode === "clusters");
  clickText("button", "Next puzzle");
  await sleep(500);
  out.newBoard = $$(".ctile").length === 16;
  clickText(".back-link", "Hub");
  await sleep(300);
  return out;
})()`);
check("clusters: 16-tile board deals", phase7.entered);
check("clusters: game plays to completion", phase7.done, JSON.stringify(phase7));
check("clusters: results show all 4 families", phase7.groupsShown);
check("clusters: share button on results", phase7.shareBtn);
check("clusters: session review saved", phase7.reviewSaved);
check("clusters: next puzzle deals a fresh board", phase7.newBoard);

// ---------- Phase 8: backup -> reset -> restore ----------
const phase8 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  let backupCode = null;
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = (msg, def) => { if (def) { backupCode = def; return null; } return backupCode; };

  const before = save();
  clickText(".foot-btn", "Back up");
  await sleep(200);
  out.codeCaptured = typeof backupCode === "string" && backupCode.length > 50;

  clickText(".foot-reset", "Reset");
  await sleep(300);
  const wiped = save();
  out.resetWorked = Object.keys(wiped.mastery).length === 0 && wiped.streak === 0;

  clickText(".foot-btn", "Restore");
  await sleep(300);
  const restored = save();
  out.restoreWorked = JSON.stringify(restored.mastery) === JSON.stringify(before.mastery)
    && restored.streak === before.streak
    && restored.reviews.length === before.reviews.length;
  return out;
})()`);
check("backup: export code produced", phase8.codeCaptured);
check("reset: wipes progress (after confirm)", phase8.resetWorked);
check("restore: brings everything back", phase8.restoreWorked);

// ---------- Phase 9: #admin route ----------
const phase9 = await evalInPage(`(async () => { ${HELPERS}
  const out = {};
  window.location.hash = "admin";
  await sleep(500);
  out.dashShell = !!$(".dash");
  out.gate = /Sign in to view analytics|Analytics not configured/.test(document.body.textContent);
  clickText(".dash-refresh", "Game");
  await sleep(500);
  out.backToGame = !!$(".hub") && window.location.hash === "";
  return out;
})()`);
check("admin: #admin shows analytics shell", phase9.dashShell);
check("admin: gated behind sign-in / config", phase9.gate);
check("admin: returns to the game", phase9.backToGame);

// ---------- results ----------
check("no console / runtime errors", errors.length === 0);

let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "  — " + detail}`);
  if (!ok) failed++;
}
if (errors.length) {
  console.log("\nCaptured errors:");
  for (const e of errors) console.log("  - " + e);
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${checks.length - failed}/${checks.length} checks passed (${URL})`);
cleanup(failed === 0 ? 0 : 1);
