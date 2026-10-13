// Initial-state patch: elements whose attributes on the ORIGINAL at scroll 0 differ from what the clone's baked-in DOM has
// (the generator snapshotted the DOM after scrolling, so inline styles/classes/text/src are those of a different moment).
// Time-driven elements are skipped (tickers etc. are reproduced by src/motion/time/*.js).
//
//   node qa/motion/record-baseline.mjs --viewport desktop --clone http://localhost:5340 [--route /]
// Output: qa/motion/raw/<profile>-<route>-initial.json   
import fs from "node:fs";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LIVE = opt("url", "https://heyparker.ai").replace(/\/$/, ""), CLONE = opt("clone", "http://localhost:5340").replace(/\/$/, ""), route = opt("route", "/");
const profile = opt("viewport", "desktop");
const VP = profile === "mobile" ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");

const dump = async (base) => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
  await pg.goto(base + route + (base === CLONE ? "?motion=off" : ""), { waitUntil: "load", timeout: 90000 }); await pg.waitForTimeout(4500);
  await pg.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await pg.waitForTimeout(1500);
  const r = await pg.evaluate(async () => {
    const ROOT = document.querySelector("#main");
    const els = [...ROOT.querySelectorAll("*")].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(e.tagName));
    const path = (e) => { const p = []; while (e && e !== ROOT) { p.unshift(e.tagName.toLowerCase() + [...e.parentElement.children].indexOf(e)); e = e.parentElement; } return p.join("/"); };
    const st = (e) => ({ style: e.getAttribute("style"), class: e.getAttribute("class"), src: e.getAttribute("src"), srcset: e.getAttribute("srcset"), text: e.children.length ? undefined : e.textContent });
    const paths = els.map(path), a = els.map((e) => JSON.stringify(st(e))); const cnt = els.map(() => 0);
    for (let t = 0; t < 26; t++) { await new Promise((r) => setTimeout(r, 120)); els.forEach((e, i) => { if (!e.isConnected) return; const k = JSON.stringify(st(e)); if (k !== a[i]) { cnt[i]++; a[i] = k; } }); }
    const timeRoots = els.filter((e, i) => cnt[i] >= 2);
    const out = {}; els.forEach((e, i) => { if (!e.isConnected) return; if (timeRoots.some((t) => t === e || t.contains(e))) return; out[paths[i]] = st(e); });
    return out;
  });
  await b.close(); return r;
};

const [L, C] = [await dump(LIVE), await dump(CLONE)];
const patches = {};
for (const [p, s] of Object.entries(L)) {
  const c = C[p]; if (!c) continue;
  const d = {}; for (const f of ["style", "class", "src", "srcset", "text"]) if (s[f] !== c[f] && !(s[f] === undefined && c[f] === undefined)) d[f] = s[f] ?? null;
  if (Object.keys(d).length) patches[p] = d;
}
fs.mkdirSync("qa/motion/raw", { recursive: true });
const file = `qa/motion/raw/${profile}-${slug}-initial.json`;
fs.writeFileSync(file, JSON.stringify({ profile, route, root: "#main", viewport: VP, recordedAt: new Date().toISOString(), patches, fresh: L }));
console.log(`${profile} ${route}: ${Object.keys(L).length} live elements, ${Object.keys(C).length} clone, ${Object.keys(patches).length} differ at scroll 0 -> ${file}`);
