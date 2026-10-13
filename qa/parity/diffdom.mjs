// Element-by-element computed-style diff between the ORIGINAL and the CLONE at one scroll offset.
//   node qa/parity/diffdom.mjs [--route /] [--viewport desktop|mobile] [--y 0] [--clone URL] [--live URL] [--top 40] [--root "#main"]
// Elements are paired by their tag/child-index path from --root. Prints the elements whose geometry or paint differs most.
import { chromium } from "playwright";
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LIVE = opt("live", "https://heyparker.ai"), CLONE = opt("clone", "http://localhost:5330");
const route = opt("route", "/"), y = +opt("y", 0), TOP = +opt("top", 40), ROOT = opt("root", "body");
const vp = opt("viewport", "desktop") === "mobile" ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const PROPS = ["transform", "opacity", "backgroundColor", "color", "display", "visibility", "position", "clipPath", "filter", "zIndex", "backgroundImage", "borderRadius", "fontSize", "overflow"];

async function dump(base) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  const pg = await ctx.newPage();
  await pg.goto(base + route, { waitUntil: "load", timeout: 60000 });
  await pg.waitForTimeout(3500);
  await pg.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
  await pg.waitForTimeout(1500);
  const data = await pg.evaluate(({ ROOT, PROPS }) => {
    const out = {};
    const walk = (el, path) => {
      const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      const o = { tag: el.tagName.toLowerCase(), name: el.getAttribute("data-framer-name") || "", cls: (el.getAttribute("class") || "").slice(0, 50),
        x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), text: el.children.length ? "" : (el.textContent || "").trim().slice(0, 30) };
      for (const p of PROPS) o[p] = c[p];
      out[path] = o;
      [...el.children].forEach((ch, i) => { if (!/^(script|style|noscript|link|meta)$/i.test(ch.tagName)) walk(ch, path + "/" + ch.tagName.toLowerCase() + i); });
    };
    walk(document.querySelector(ROOT), ROOT);
    return out;
  }, { ROOT, PROPS });
  await b.close();
  return data;
}

const [L, C] = await Promise.all([dump(LIVE), dump(CLONE)]);
const rows = [];
let onlyLive = 0, onlyClone = 0;
for (const k of Object.keys(L)) {
  const a = L[k], c = C[k];
  if (!c) { onlyLive++; continue; }
  const diffs = [];
  for (const p of ["x", "y", "w", "h"]) if (Math.abs(a[p] - c[p]) > 2) diffs.push(`${p}: ${a[p]} -> ${c[p]}`);
  for (const p of PROPS) if (a[p] !== c[p]) diffs.push(`${p}: ${String(a[p]).slice(0, 50)} -> ${String(c[p]).slice(0, 50)}`);
  if (diffs.length) rows.push({ k, name: a.name || a.cls, area: a.w * a.h, diffs });
}
for (const k of Object.keys(C)) if (!L[k]) onlyClone++;
rows.sort((p, q) => q.area - p.area);
console.log(`elements live ${Object.keys(L).length} clone ${Object.keys(C).length} | only-live ${onlyLive} only-clone ${onlyClone} | differing ${rows.length}`);
for (const r of rows.slice(0, TOP)) console.log(`\n${r.k.slice(-70)}  [${r.name}] area ${r.area}\n   ` + r.diffs.slice(0, 6).join("\n   "));
