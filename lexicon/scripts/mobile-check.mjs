/**
 * Mobile responsiveness harness for the Lexicon app.
 *
 * Drives a real headless Chrome over the DevTools Protocol (no extra deps), but
 * unlike smoke.mjs it *emulates phones*: for each viewport in DEVICES it turns on
 * mobile device-metrics + touch, walks every screen (Hub -> Clusters -> Lightning
 * -> Antonyms -> Library -> Settings -> Auth), and at each stop it:
 *   - captures a PNG screenshot into scripts/mobile-shots/
 *   - measures horizontal overflow (page-level + the worst offending elements)
 *   - flags interactive elements with a tap target smaller than 44x44 CSS px
 *
 * Usage:
 *   1. npm run dev          (in another terminal)
 *   2. node scripts/mobile-check.mjs            # default http://localhost:5173/
 *      node scripts/mobile-check.mjs <url>
 *
 * Exit code: 0 = no overflow + no tiny tap targets, 1 = problems found.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const URL = process.argv[2] || process.env.SMOKE_URL || "http://localhost:5173/";
const PORT = 9223;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, "mobile-shots");

const MIN_TAP = 44; // px — Apple HIG / Material minimum
const TAP_SLOP = 2; // ignore sub-pixel rounding

const DEVICES = [
  { name: "iphone-se",      w: 320, h: 568, dpr: 2 }, // smallest still-common phone
  { name: "android-360",    w: 360, h: 640, dpr: 3 }, // most common Android width
  { name: "iphone-12",      w: 390, h: 844, dpr: 3 },
  { name: "iphone-plus",    w: 414, h: 896, dpr: 2 },
  { name: "iphone-pro-max", w: 430, h: 932, dpr: 3 }, // largest phone
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) { console.error("FATAL: " + msg); process.exit(2); }

// --- pre-flight: dev server up? ---
try {
  const res = await fetch(URL);
  if (!res.ok) fail(`dev server at ${URL} returned HTTP ${res.status}`);
} catch {
  fail(`dev server not reachable at ${URL} — start it first (npm run dev).`);
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) fail("Could not find Chrome/Chromium. Set CHROME_PATH.");
  return found;
}

const CHROME = findChrome();
const profile = mkdtempSync(join(tmpdir(), "lexicon-mobile-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-allow-origins=*", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

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
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* CDP not up yet */ }
    await sleep(250);
  }
  fail("Chrome DevTools endpoint did not come up.");
}

function cleanup(code) {
  try { chrome.kill(); } catch { /* gone */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(code);
}

rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

const wsUrl = await openTarget();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const errors = [];
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

async function evalInPage(expr) {
  const r = await send(ws, "Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) fail("in-page eval threw: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

async function setDevice(d) {
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: true,
    screenWidth: d.w, screenHeight: d.h,
  });
  await send(ws, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send(ws, "Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
}

async function screenshot(name) {
  // Viewport-only (no captureBeyondViewport) → represents the actual mobile fold.
  const r = await send(ws, "Page.captureScreenshot", { format: "png" });
  if (r?.data) writeFileSync(join(SHOT_DIR, name + ".png"), Buffer.from(r.data, "base64"));
}

// In-page measurement: returns page overflow + worst offenders + tiny tap targets.
const MEASURE = `(() => {
  const vw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\\s+/).slice(0,2).join(".");
    return s;
  };
  const overflowers = [];
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if (r.right > vw + 1) {
      overflowers.push({ sel: sel(el), right: Math.round(r.right), w: Math.round(r.width), text: (el.textContent||"").trim().slice(0,24) });
    }
  });
  // keep the worst 8 by how far they spill
  overflowers.sort((a,b) => b.right - a.right);
  const tiny = [];
  document.querySelectorAll("button, a[href], input, select, textarea, [role=button], [role=radio], [role=tab]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || el.disabled) return;
    const w = r.width, h = r.height;
    if (w < ${MIN_TAP - TAP_SLOP} || h < ${MIN_TAP - TAP_SLOP}) {
      tiny.push({ sel: sel(el), w: Math.round(w), h: Math.round(h), text: (el.textContent||el.getAttribute("aria-label")||"").trim().slice(0,20) });
    }
  });
  return { vw, docW, hScroll: docW > vw + 1, overflowers: overflowers.slice(0,8), tiny };
})()`;

const $click = (sel, text) => `(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
  const el = ${text ? `els.find(e => e.textContent.includes(${JSON.stringify(text)}))` : "els[0]"};
  if (el) { el.click(); return true; } return false;
})()`;

const SCREENS = [
  { id: "hub", enter: async () => { await evalInPage(`document.querySelector(".brand")?.click()`); } },
  { id: "clusters", enter: async () => {
      await evalInPage($click(".mode-card", "Clusters")); await sleep(450);
      // select 4 tiles so the action bar + selection state is exercised
      await evalInPage(`[...document.querySelectorAll(".ctile")].slice(0,4).forEach(t=>t.click())`); await sleep(150);
  } },
  { id: "lightning", enter: async () => {
      await evalInPage(`document.querySelector(".brand")?.click()`); await sleep(250);
      await evalInPage($click(".mode-card", "Lightning")); await sleep(450);
  } },
  { id: "lightning-answered", enter: async () => {
      await evalInPage(`document.querySelector(".qopt")?.click()`); await sleep(400);
  } },
  { id: "antonyms", enter: async () => {
      await evalInPage(`document.querySelector(".brand")?.click()`); await sleep(250);
      await evalInPage($click(".mode-card", "Antonyms")); await sleep(450);
  } },
  { id: "library", enter: async () => {
      await evalInPage(`document.querySelector(".brand")?.click()`); await sleep(250);
      await evalInPage($click(".study-link", "Browse")); await sleep(450);
  } },
  { id: "settings", enter: async () => {
      await evalInPage(`document.querySelector(".brand")?.click()`); await sleep(250);
      await evalInPage(`[...document.querySelectorAll(".settings-trigger")].find(b=>/Settings/.test(b.textContent))?.click()`); await sleep(300);
  } },
  { id: "auth", enter: async () => {
      await evalInPage(`document.querySelector(".settings-overlay")?.click()`); await sleep(200); // close settings
      await evalInPage(`[...document.querySelectorAll(".settings-trigger")].find(b=>/Sign in|Account/.test(b.textContent))?.click()`); await sleep(300);
  } },
];

let problems = 0;
const summary = [];

for (const d of DEVICES) {
  await setDevice(d);
  await send(ws, "Page.navigate", { url: URL });
  await sleep(1800); // React mount + fonts
  console.log(`\n=== ${d.name}  (${d.w}x${d.h} @${d.dpr}x) ===`);
  for (const screen of SCREENS) {
    try { await screen.enter(); } catch (e) { console.log(`  ! ${screen.id}: nav error ${e}`); }
    await sleep(200);
    await screenshot(`${d.name}__${screen.id}`);
    const m = await evalInPage(MEASURE);
    const issues = [];
    if (m.hScroll) {
      issues.push(`H-SCROLL docW=${m.docW} > vw=${m.vw}`);
      problems++;
    }
    if (m.tiny.length) {
      problems += m.tiny.length;
      issues.push(`${m.tiny.length} tiny tap targets`);
    }
    const status = issues.length ? "FAIL" : "ok";
    console.log(`  [${status}] ${screen.id.padEnd(20)} ${issues.join(" | ")}`);
    if (m.hScroll && m.overflowers.length) {
      m.overflowers.forEach((o) => console.log(`        overflow: ${o.sel}  right=${o.right} (vw=${m.vw})  "${o.text}"`));
    }
    if (m.tiny.length) {
      m.tiny.forEach((t) => console.log(`        tap<44: ${t.sel}  ${t.w}x${t.h}  "${t.text}"`));
    }
    if (issues.length) summary.push(`${d.name}/${screen.id}: ${issues.join(", ")}`);
  }
  // close any open overlay before next device
  await evalInPage(`document.querySelector(".settings-overlay")?.click()`);
}

console.log("\n──────── SUMMARY ────────");
if (errors.length) { console.log(`console/runtime errors: ${errors.length}`); errors.forEach(e => console.log("  - " + e)); }
if (summary.length === 0) console.log("No overflow / tiny-tap-target problems on any viewport. ✓");
else { console.log(`${summary.length} screen(s) with problems:`); summary.forEach(s => console.log("  - " + s)); }
console.log(`\nScreenshots: ${SHOT_DIR}`);
console.log(problems === 0 && errors.length === 0 ? "\nPASS" : "\nFAIL");
cleanup(problems === 0 && errors.length === 0 ? 0 : 1);
