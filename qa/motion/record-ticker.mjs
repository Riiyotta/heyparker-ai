// Long recording of the tickers' translateX to find speed, direction and the wrap (loop) distance.
//   node qa/motion/record-ticker.mjs --viewport desktop --seconds 120
import fs from "node:fs";
import { chromium } from "playwright";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const profile = opt("viewport", "desktop"), SECS = +opt("seconds", 120), route = opt("route", "/");
const VP = profile === "mobile" ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const b = await chromium.launch(); const out = {};
const pg = await (await b.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
await pg.goto("https://heyparker.ai" + route, { waitUntil: "load" }); await pg.waitForTimeout(4000);
// every ul that is a Framer ticker (flex row, will-change: transform, translateX)
const meta = await pg.evaluate(() => { const R = document.querySelector("#main"); const path = (e) => { const p = []; while (e && e !== R) { p.unshift(e.tagName.toLowerCase() + [...e.parentElement.children].indexOf(e)); e = e.parentElement; } return p.join("/"); };
  return [...R.querySelectorAll("ul")].filter((u) => /translateX/.test(u.getAttribute("style") || "")).map((u) => ({ path: path(u), n: u.children.length, gap: getComputedStyle(u).gap, itemW: Math.round(u.children[0].getBoundingClientRect().width), L: Math.round([...u.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0) + u.children.length * parseFloat(getComputedStyle(u).gap)), style0: u.getAttribute("style") })); });   // L: one full loop = every item + its gap
console.log(meta.length, "tickers");
// keep them all running: scroll so each is visible in turn is not needed (they run when in view only?) -> check by sampling while parked at each
for (const m of meta) {
  const res = await pg.evaluate(async ({ path, SECS }) => {
    const R = document.querySelector("#main"); let e = R; for (const tok of path.split("/")) { const mm = /^([a-z0-9]+?)(\d+)$/.exec(tok); e = e.children[+mm[2]]; }
    window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - innerHeight / 2, behavior: "instant" }); await new Promise((r) => setTimeout(r, 1200));
    const s = []; const t0 = performance.now();
    while (performance.now() - t0 < SECS * 1000) { const mt = /translateX\((-?[\d.]+)px\)/.exec(e.getAttribute("style") || ""); s.push([Math.round(performance.now() - t0), mt ? +mt[1] : null, e.children.length]); await new Promise((r) => setTimeout(r, 250)); }
    return s;
  }, { path: m.path, SECS });
  out[m.path] = { ...m, samples: res };
  const v = res.map((x) => x[1]).filter((x) => x != null); const jumps = res.map((x, i) => [x, res[i - 1]]).filter(([x, p]) => p && x[1] != null && p[1] != null && Math.abs(x[1] - p[1]) > 150).map(([x, p]) => `${p[0]}ms ${p[1]}->${x[1]}`);
  console.log(m.path.slice(-26).padEnd(28), `n=${m.n} gap=${m.gap} itemW=${m.itemW}`, `range ${Math.min(...v).toFixed(0)}..${Math.max(...v).toFixed(0)}`, "jumps:", jumps.slice(0, 4).join(" | ") || "none");
}
await b.close();
fs.writeFileSync(`qa/motion/raw/ticker-${profile}.json`, JSON.stringify({ profile, seconds: SECS, tickers: out }));
