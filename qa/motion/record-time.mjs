// Records the TIME-driven elements (tickers, typed text, rotating rings) on the ORIGINAL: for each, scroll it to the middle of
// the viewport and sample its style / class / text every 100 ms for a while. Output: qa/motion/raw/time-<profile>-<route>.json
//   node qa/motion/record-time.mjs --viewport desktop [--seconds 30] [--hz 10]
import fs from "node:fs";
import { chromium } from "playwright";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const profile = opt("viewport", "desktop"), route = opt("route", "/"), SECS = +opt("seconds", 30), HZ = +opt("hz", 10);
const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
const VP = profile === "mobile" ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const raw = JSON.parse(fs.readFileSync(`qa/motion/raw/${profile}-${slug}.json`, "utf8"));
const out = { profile, route, seconds: SECS, hz: HZ, viewport: VP, roots: {} };
const b = await chromium.launch();
for (const p of raw.timeDriven) {
  const pg = await (await b.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
  await pg.goto("https://heyparker.ai" + route, { waitUntil: "load", timeout: 90000 }); await pg.waitForTimeout(4000);
  const r = await pg.evaluate(async ({ p, SECS, HZ }) => {
    const R = document.querySelector("#main");
    const find = () => { let e = R; for (const tok of p.split("/")) { const m = /^([a-z0-9]+?)(\d+)$/.exec(tok); e = e && e.children[+m[2]]; } return e; };
    let el = find(); if (!el) return { missing: true };
    const top = el.getBoundingClientRect().top + scrollY; window.scrollTo({ top: Math.max(0, top - innerHeight / 2), behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1200));
    const samples = []; const t0 = performance.now();
    while (performance.now() - t0 < SECS * 1000) {
      el = find() || el;   // React may replace the node
      const r = el.getBoundingClientRect();
      samples.push([Math.round(performance.now() - t0), el.getAttribute("style"), el.getAttribute("class"), el.textContent.slice(0, 200), Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height), el.isConnected ? 1 : 0]);
      await new Promise((r) => setTimeout(r, 1000 / HZ));
    }
    return { samples, scrollY: Math.round(scrollY), tag: el.tagName.toLowerCase(), name: el.getAttribute("data-framer-name") || "", kids: el.children.length };
  }, { p, SECS, HZ });
  out.roots[p] = r; console.log(p.slice(-60).padEnd(62), r.missing ? "MISSING" : `${r.samples.length} samples y=${r.scrollY} ${r.tag} "${r.name}"`);
  await pg.context().close();
}
await b.close();
fs.writeFileSync(`qa/motion/raw/time-${profile}-${slug}.json`, JSON.stringify(out));
