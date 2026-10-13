// Which elements change over TIME at a fixed scroll offset? (tickers, typing text, rotating rings, svg/css animation)
import { chromium } from "playwright";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const URL_ = opt("url", "https://heyparker.ai/"), ys = opt("ys", "0,3000,9000,15000,22000").split(",").map(Number), mobile = opt("viewport", "desktop") === "mobile";
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile })).newPage();
await pg.goto(URL_, { waitUntil: "load" }); await pg.waitForTimeout(4000);
for (const y of ys) {
  await pg.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y); await pg.waitForTimeout(1500);
  const res = await pg.evaluate(async () => {
    const ROOT = document.querySelector("#main"); const els = [...ROOT.querySelectorAll("*")].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(e.tagName));
    const st = (e) => [e.getAttribute("style"), e.getAttribute("class"), e.tagName === "IMG" ? e.getAttribute("src") : "", e.children.length ? "" : e.textContent].join("¦");
    const a = new Map(els.map((e) => [e, st(e)])); const ch = new Map();
    for (let t = 0; t < 30; t++) { await new Promise((r) => setTimeout(r, 120)); for (const e of els) { const s = st(e); if (s !== a.get(e)) { ch.set(e, (ch.get(e) || 0) + 1); a.set(e, s); } } }
    const path = (e) => { const p = []; while (e && e !== ROOT) { if (!e.parentElement) return "DETACHED:" + p.join("/"); p.unshift(e.tagName.toLowerCase() + [...e.parentElement.children].indexOf(e)); e = e.parentElement; } return p.join("/"); };
    return [...ch.entries()].map(([e, n]) => ({ p: path(e).slice(-70), n, name: e.getAttribute("data-framer-name") || "", tag: e.tagName.toLowerCase() }));
  });
  console.log(`y=${y}: ${res.length} time-driven elements`); for (const r of res.slice(0, 12)) console.log("  ", r.n, r.tag, r.name, r.p);
}
await b.close();
