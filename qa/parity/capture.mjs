// Visual parity capture: loads the ORIGINAL (live) and the CLONE at the same viewport and the same scroll positions and saves
// one viewport screenshot per position. compare.py then scores the pairs and writes qa/parity/parity.json.
//
//   node qa/parity/capture.mjs [--clone http://localhost:5330] [--live https://heyparker.ai] [--routes /,/support/terms-of-service]
//                              [--viewports desktop,mobile] [--out qa/parity/shots] [--settle 1400]
//
// Scroll positions are every viewport-height step across the ORIGINAL's scroll height (the clone is scrolled to the same
// offsets, so a clone that is taller/shorter than the original is penalised by what it shows, not hidden by stitching).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LIVE = opt("live", "https://heyparker.ai").replace(/\/$/, "");
const CLONE = opt("clone", "http://localhost:5330").replace(/\/$/, "");
const ROUTES = opt("routes", "/,/support/terms-of-service,/support/privacy-policy,/support/data-deletion-request").split(",");
const OUT = opt("out", "qa/parity/shots");
const SETTLE = +opt("settle", 1400);
const MAXSTEPS = +opt("max-steps", 60);
const VIEWPORTS = { desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
                    mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } };
const which = opt("viewports", "desktop,mobile").split(",");
const slug = (r) => (r === "/" ? "home" : r.replace(/^\/|\/$/g, "").replace(/\//g, "_"));

const settle = async (pg) => {
  // fonts + images, but never wait forever: lazy/off-screen images may never fire load
  await pg.evaluate(() => Promise.race([
    Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))]),
    new Promise((r) => setTimeout(r, 6000))]));
  await pg.waitForTimeout(SETTLE);
};

async function shoot(browser, base, route, vpName, vp, heights) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, reducedMotion: "no-preference" });
  const pg = await ctx.newPage();
  await pg.goto(base + route, { waitUntil: "load", timeout: 60000 });
  await pg.waitForTimeout(3000);
  await settle(pg);
  const total = await pg.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const sections = await pg.evaluate(() => [...document.querySelectorAll("[data-framer-name]")]
    .filter((e) => e.getBoundingClientRect().height > 40 && e.getBoundingClientRect().width > innerWidth * 0.5)
    .slice(0, 80).map((e) => ({ name: e.getAttribute("data-framer-name"), top: Math.round(e.getBoundingClientRect().top + scrollY), height: Math.round(e.getBoundingClientRect().height) })));
  const limit = heights ?? total;
  const steps = []; for (let y = 0; y < limit && steps.length < MAXSTEPS; y += vp.height) steps.push(y);
  const dir = path.join(OUT, vpName, slug(route), base === LIVE ? "live" : "clone");
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, y] of steps.entries()) {
    await pg.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
    await pg.waitForTimeout(SETTLE);
    await pg.screenshot({ path: path.join(dir, String(i).padStart(3, "0") + ".png"), timeout: 30000 });
  }
  await ctx.close();
  return { total, steps, sections };
}

const browser = await chromium.launch();
const meta = {};
for (const vpName of which) {
  for (const route of ROUTES) {
    const vp = VIEWPORTS[vpName];
    try {
      const live = await shoot(browser, LIVE, route, vpName, vp, null);
      const clone = await shoot(browser, CLONE, route, vpName, vp, live.total);
      meta[`${vpName}${route}`] = { viewport: vp, live: { height: live.total, frames: live.steps.length, sections: live.sections }, clone: { height: clone.total, sections: clone.sections }, steps: live.steps };
      console.log(vpName, route, "live", live.total, "clone", clone.total, "frames", live.steps.length);
    } catch (e) { console.log("FAILED", vpName, route, e.message.split("\n")[0]); meta[`${vpName}${route}`] = { error: e.message.split("\n")[0] }; }
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "capture-meta.json"), JSON.stringify({ live: LIVE, clone: CLONE, capturedAt: new Date().toISOString(), settleMs: SETTLE, runs: meta }, null, 2));
