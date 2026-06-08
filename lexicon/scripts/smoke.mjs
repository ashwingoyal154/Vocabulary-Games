/**
 * Headless end-to-end smoke test for the Lexicon app.
 *
 * Drives a real Chrome instance over the DevTools Protocol (no extra deps — uses
 * Node's built-in `fetch`/`WebSocket`, so Node 22+ is required) through every screen:
 * Hub -> Clusters -> Lightning -> Antonyms -> Library. Fails if any assertion fails
 * or if the page logs a console error / throws at runtime.
 *
 * Usage:
 *   1. In one terminal:  npm run dev
 *   2. In another:       npm run smoke            # tests http://localhost:5173/
 *                        npm run smoke <url>      # test a different URL
 *
 * Env overrides:
 *   SMOKE_URL    target URL (default http://localhost:5173/)
 *   CHROME_PATH  path to a Chrome/Chromium binary (auto-detected otherwise)
 *
 * Exit code: 0 = PASS, 1 = FAIL (CI-friendly).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.argv[2] || process.env.SMOKE_URL || "http://localhost:5173/";
const PORT = 9222;

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
  if (!found) {
    fail("Could not find Chrome/Chromium. Set CHROME_PATH to a browser binary.");
  }
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

// --- pre-flight: is the dev server up? ---
try {
  const res = await fetch(URL);
  if (!res.ok) fail(`dev server at ${URL} returned HTTP ${res.status}`);
} catch {
  fail(`dev server not reachable at ${URL} — start it first (npm run dev).`);
}

const CHROME = findChrome();
const profile = mkdtempSync(join(tmpdir(), "lexicon-smoke-"));
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
await send(ws, "Page.navigate", { url: URL });
await sleep(2500); // let React mount + fonts settle

async function evalInPage(expr) {
  const r = await send(ws, "Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) fail("in-page eval threw: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

const out = await evalInPage(`(async () => {
  const out = {};
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const clickText = (sel, text) => {
    const el = $$(sel).find(e => e.textContent.includes(text));
    if (el) { el.click(); return true; } return false;
  };

  out.hubRendered = !!$(".hub") && !!$(".mode-cards");

  // Clusters
  clickText(".mode-card", "Clusters");
  await sleep(400);
  const tiles = $$(".ctile");
  tiles.slice(0, 4).forEach(t => t.click());
  await sleep(150);
  const submit = $$(".btn-primary").find(b => b.textContent.trim() === "Submit");
  out.clusters = { entered: !!$(".cboard"), tileCount: tiles.length, selected: $$(".ctile.sel").length, submitEnabled: !!submit && !submit.disabled };
  if (submit && !submit.disabled) submit.click();
  await sleep(400);
  out.clusters.submittedCleanly = true; // no throw === clean (errors captured via CDP)
  $(".brand")?.click(); await sleep(300);

  // Lightning
  clickText(".mode-card", "Lightning");
  await sleep(400);
  out.lightning = { entered: !!$(".qcard"), word: $(".q-word")?.textContent || null, optionCount: $$(".qopt").length };
  $$(".qopt")[0]?.click();
  await sleep(400);
  out.lightning.teachShown = !!$(".q-teach");
  out.lightning.continueBtn = !!$$("button").find(b => /Continue|See results/.test(b.textContent));
  $(".brand")?.click(); await sleep(300);

  // Antonyms
  clickText(".mode-card", "Antonyms");
  await sleep(400);
  out.antonyms = { entered: !!$(".qcard"), prompt: $(".q-anchor-name")?.textContent || null, optionCount: $$(".qopt").length };
  $(".brand")?.click(); await sleep(200);

  // Library
  clickText(".study-link", "Browse");
  await sleep(400);
  out.library = { entered: !!$(".mode-wrap") && /lexicon/i.test(document.body.textContent) };

  return out;
})()`);

// --- assertions ---
const checks = [
  ["hub renders", out.hubRendered],
  ["clusters: board enters", out.clusters.entered],
  ["clusters: 16 tiles", out.clusters.tileCount === 16],
  ["clusters: 4 tiles selectable", out.clusters.selected === 4],
  ["clusters: submit enabled", out.clusters.submitEnabled],
  ["lightning: card enters", out.lightning.entered],
  ["lightning: word shown", !!out.lightning.word],
  ["lightning: 4 options", out.lightning.optionCount === 4],
  ["lightning: teach panel after answer", out.lightning.teachShown],
  ["lightning: continue button", out.lightning.continueBtn],
  ["antonyms: card enters", out.antonyms.entered],
  ["antonyms: prompt shown", !!out.antonyms.prompt],
  ["antonyms: 4 options", out.antonyms.optionCount === 4],
  ["library: renders", out.library.entered],
  ["no console / runtime errors", errors.length === 0],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
if (errors.length) {
  console.log("\nCaptured errors:");
  for (const e of errors) console.log("  - " + e);
}

console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${checks.length - failed}/${checks.length} checks passed (${URL})`);
cleanup(failed === 0 ? 0 : 1);
