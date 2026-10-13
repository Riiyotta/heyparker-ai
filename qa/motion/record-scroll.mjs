// Records, on the ORIGINAL site, how every element's state changes with SCROLL position, so the clone can replay it offline.
//
//   node qa/motion/record-scroll.mjs [--viewport desktop|mobile] [--url https://heyparker.ai/] [--route /] [--step 15] [--settle 140]
//
// Per element of #main it tracks the attributes the site's runtime rewrites: style, class, src, srcset and leaf text.
// Elements that change over TIME at a fixed offset (tickers, typing text, rotating rings) are detected in a pre-pass and
// left out: those are time-driven and are reproduced by src/motion/time/*.js, not by this scroll timeline.
// Output: qa/motion/raw/<profile><route>.json  (absolute URLs, live paths). build-timeline.mjs localises it into src/motion/.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const URL_ = opt("url", "https://heyparker.ai"), route = opt("route", "/");
const profile = opt("viewport", "desktop"), STEP = +opt("step", 15), SETTLE = +opt("settle", 140);
const VP = profile === "mobile" ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };

const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
await pg.goto(URL_.replace(/\/$/, "") + route, { waitUntil: "load", timeout: 90000 });
await pg.waitForTimeout(4500);

// ---- init in page: number the elements, find the time-driven ones ----
const init = await pg.evaluate(async () => {
  const ROOT = document.querySelector("#main");
  const els = [...ROOT.querySelectorAll("*")].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(e.tagName));
  const leaf = (e) => e.children.length === 0;
  const st = (e) => ({ style: e.getAttribute("style"), class: e.getAttribute("class"), src: e.getAttribute("src"), srcset: e.getAttribute("srcset"), text: leaf(e) ? e.textContent : undefined });
  const key = (s) => JSON.stringify(s);
  const path = (e) => { const p = []; while (e && e !== ROOT) { p.unshift(e.tagName.toLowerCase() + [...e.parentElement.children].indexOf(e)); e = e.parentElement; } return p.join("/"); };
  els.forEach((e, i) => { e.__i = i; });
  const paths = els.map(path);   // computed up front: React may detach nodes during the pre-pass
  // time-driven pre-pass at three offsets
  const timeSet = new Set();
  for (const y of [0, Math.floor(document.documentElement.scrollHeight * 0.35), Math.floor(document.documentElement.scrollHeight * 0.75)]) {
    window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 1400));
    const base = els.map((e) => key(st(e))); const cnt = els.map(() => 0);
    for (let t = 0; t < 26; t++) { await new Promise((r) => setTimeout(r, 120)); els.forEach((e, i) => { const k = key(st(e)); if (k !== base[i]) { cnt[i]++; base[i] = k; } }); }
    cnt.forEach((n, i) => { if (n >= 2) timeSet.add(i); });
  }
  // a time-driven element excludes its whole subtree
  const excl = new Set(); els.forEach((e, i) => { for (const t of timeSet) if (els[t] === e || els[t].contains(e)) { excl.add(i); break; } });
  window.__R = { ROOT, els, st, key, excl, prev: null };
  window.scrollTo({ top: 0, behavior: "instant" }); await new Promise((r) => setTimeout(r, 1500));
  window.__R.prev = els.map((e) => key(st(e)));
  return { n: els.length, timeDriven: [...timeSet].map((i) => paths[i]), excluded: excl.size, paths, total: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), baseline: els.map((e) => (e.isConnected ? st(e) : {})) };
});
console.log(`${profile}: ${init.n} elements, ${init.timeDriven.length} time-driven roots (${init.excluded} excluded incl. descendants), page height ${init.total}`);

// ---- scroll sweep ----
const events = {};   // idx -> [[y, patch], ...]
let nEv = 0;
for (let y = 0; y <= init.total; y += STEP) {
  await pg.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
  await pg.waitForTimeout(SETTLE);
  const ch = await pg.evaluate(() => { const R = window.__R, out = []; R.els.forEach((e, i) => { if (R.excl.has(i) || !e.isConnected) return; const s = R.st(e), k = R.key(s); if (k !== R.prev[i]) { const p = JSON.parse(R.prev[i]), patch = {}; for (const f of ["style", "class", "src", "srcset", "text"]) if (s[f] !== p[f]) patch[f] = s[f] ?? null; out.push([i, patch]); R.prev[i] = k; } }); return out; });
  for (const [i, patch] of ch) { (events[i] ||= []).push([y, patch]); nEv++; }
  if (y % (STEP * 100) === 0) process.stdout.write(`\r  y=${y}/${init.total} events=${nEv}   `);
}
console.log(`\n  recorded ${nEv} events on ${Object.keys(events).length} elements`);
await b.close();

const out = { profile, viewport: VP, route, step: STEP, settleMs: SETTLE, total: init.total, recordedAt: new Date().toISOString(), root: "#main",
  timeDriven: init.timeDriven,
  elements: Object.keys(events).map((i) => ({ path: init.paths[i], baseline: Object.fromEntries(Object.entries(init.baseline[i]).filter(([, v]) => v !== undefined)), events: events[i] })) };
const dir = "qa/motion/raw"; fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${profile}${route === "/" ? "-home" : route.replace(/\//g, "_")}.json`);
fs.writeFileSync(file, JSON.stringify(out));
console.log("  wrote", file, (fs.statSync(file).size / 1024).toFixed(0) + " KB");
