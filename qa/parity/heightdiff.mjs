// Which elements are taller/shorter in the clone than in the original? (outermost differences first)
//   node qa/parity/heightdiff.mjs [--viewport mobile] [--route /] [--clone URL] [--min 20]
import { chromium } from "playwright";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LIVE = "https://heyparker.ai", CLONE = opt("clone", "http://localhost:5340"), route = opt("route", "/"), MIN = +opt("min", 20);
const mobile = opt("viewport", "mobile") === "mobile";
const grab = async (url) => { const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile })).newPage();
  await pg.goto(url, { waitUntil: "load", timeout: 90000 }); await pg.waitForTimeout(4500);
  const r = await pg.evaluate(() => { const o = {}; const R = document.querySelector("#main"); const w = (e, p, d) => { const r = e.getBoundingClientRect(); o[p] = { d, tag: e.tagName.toLowerCase(), n: e.getAttribute("data-framer-name") || (e.getAttribute("class") || "").split(" ")[0], x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top + scrollY), disp: getComputedStyle(e).display }; [...e.children].forEach((c, i) => { if (!/^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(c.tagName)) w(c, p + "/" + c.tagName.toLowerCase() + i, d + 1); }); }; w(R, "#main", 0); return o; });
  await b.close(); return r; };
const [L, C] = [await grab(LIVE + route), await grab(CLONE.replace(/\/$/, "") + route + (opt("motion","on")==="off" ? "?motion=off" : ""))];
const rows = [];
for (const k of Object.keys(L)) { const a = L[k], c = C[k]; if (!c) continue; const dh = c.h - a.h, dw = c.w - a.w; if (Math.abs(dh) >= MIN || Math.abs(dw) >= MIN) rows.push({ k, d: a.d, n: a.n, a, c, dh, dw }); }
rows.sort((p, q) => p.d - q.d || Math.abs(q.dh) - Math.abs(p.dh));
console.log(`differing: ${rows.length} (|dh| or |dw| >= ${MIN})`);
for (const r of rows.slice(0, 40)) console.log(`d${r.d} ${r.n.slice(0, 26).padEnd(26)} ${r.k.slice(-46).padEnd(46)} h ${r.a.h}->${r.c.h} (${r.dh > 0 ? "+" : ""}${r.dh}) w ${r.a.w}->${r.c.w} disp ${r.a.disp}->${r.c.disp}`);
