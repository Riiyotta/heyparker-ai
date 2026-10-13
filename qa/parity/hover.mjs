// Interaction-state parity: for every interactive element of the ORIGINAL, hover it and record which paint properties change;
// do the same on the same element (paired by DOM path) in the CLONE and report any element whose hover state the clone lacks.
//   node qa/parity/hover.mjs [--route /] [--viewport desktop] [--clone http://localhost:5340] [--max 120]
// Writes qa/parity/hover.json
import fs from "node:fs";
import { chromium } from "playwright";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LIVE = "https://heyparker.ai", CLONE = opt("clone", "http://localhost:5340").replace(/\/$/, ""), route = opt("route", "/"), MAX = +opt("max", 120);
const mobile = opt("viewport", "desktop") === "mobile";
const VP = mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const PROPS = ["backgroundColor", "color", "borderColor", "boxShadow", "transform", "opacity", "textDecorationLine", "outlineStyle", "filter", "scale", "translate", "rotate", "width", "height"];

async function candidates(pg) {
  return pg.evaluate(() => {
    const R = document.querySelector("#main");
    const path = (e) => { const p = []; while (e && e !== R) { p.unshift(e.tagName.toLowerCase() + [...e.parentElement.children].indexOf(e)); e = e.parentElement; } return p.join("/"); };
    const out = [];
    for (const e of R.querySelectorAll("a, button, [role=button], [data-highlight], input, textarea, summary, [tabindex]")) {
      const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
      out.push({ p: path(e), tag: e.tagName.toLowerCase(), text: (e.textContent || "").trim().slice(0, 28), y: Math.round(r.top + scrollY) });
    }
    return out;
  });
}
const sample = (pg, p) => pg.evaluate(({ p, PROPS }) => {
  const R = document.querySelector("#main"); let e = R; for (const tok of p.split("/")) { const m = /^([a-z0-9]+?)(\d+)$/.exec(tok); e = e && e.children[+m[2]]; }
  if (!e) return null;
  const grab = (el) => { const c = getComputedStyle(el); return Object.fromEntries(PROPS.map((k) => [k, c[k]])); };
  const o = { self: grab(e) }; o.kids = [...e.querySelectorAll("*")].slice(0, 12).map(grab); o.cursor = getComputedStyle(e).cursor; return o;
}, { p, PROPS });
const diff = (a, b) => { const d = []; if (!a || !b) return d; const cmp = (x, y, tag) => { for (const k of PROPS) if (x[k] !== y[k]) d.push(`${tag}.${k}: ${String(x[k]).slice(0, 40)} -> ${String(y[k]).slice(0, 40)}`); }; cmp(a.self, b.self, "self"); a.kids.forEach((k, i) => b.kids[i] && cmp(k, b.kids[i], "kid" + i)); return d; };

async function measure(base, list) {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
  await pg.goto(base + route, { waitUntil: "load", timeout: 90000 }); await pg.waitForTimeout(4500);
  const res = {};
  for (const c of list) {
    try {
      const sel = await pg.evaluateHandle(({ p }) => { const R = document.querySelector("#main"); let e = R; for (const tok of p.split("/")) { const m = /^([a-z0-9]+?)(\d+)$/.exec(tok); e = e && e.children[+m[2]]; } return e; }, { p: c.p });
      const el = sel.asElement(); if (!el) continue;
      await el.scrollIntoViewIfNeeded(); await pg.mouse.move(2, 2); await pg.waitForTimeout(250);
      const before = await sample(pg, c.p);
      await el.hover({ timeout: 3000, force: true }); await pg.waitForTimeout(450);
      const after = await sample(pg, c.p);
      res[c.p] = { changes: diff(before, after), cursor: after && after.cursor };
      await pg.mouse.move(2, 2);
    } catch (e) { res[c.p] = { error: e.message.split("\n")[0].slice(0, 80) }; }
  }
  await b.close(); return res;
}

const b0 = await chromium.launch();
const lp = await (await b0.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
await lp.goto(LIVE + route, { waitUntil: "load", timeout: 90000 }); await lp.waitForTimeout(4500);
const list = (await candidates(lp)).slice(0, MAX); await b0.close();
const [L, C] = [await measure(LIVE, list), await measure(CLONE, list)];
const rows = [];
for (const c of list) {
  const l = L[c.p], k = C[c.p]; if (!l || l.error) continue;
  const lc = (l.changes || []).length, kc = k && !k.error ? (k.changes || []).length : 0;
  const same = JSON.stringify((l.changes || []).slice().sort()) === JSON.stringify(((k && k.changes) || []).slice().sort());
  rows.push({ path: c.p, tag: c.tag, text: c.text, liveHover: l.changes, cloneHover: k && k.changes, liveCursor: l.cursor, cloneCursor: k && k.cursor, status: lc === 0 && kc === 0 ? "no-hover-state" : same ? "match" : kc === 0 ? "MISSING in clone" : "differs" });
}
const tally = rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
fs.writeFileSync("qa/parity/hover.json", JSON.stringify({ route, viewport: mobile ? "mobile" : "desktop", checked: rows.length, tally, rows }, null, 1));
console.log(route, mobile ? "mobile" : "desktop", "interactive elements checked:", rows.length, JSON.stringify(tally));
for (const r of rows.filter((r) => r.status === "MISSING in clone" || r.status === "differs").slice(0, 12)) console.log(" ", r.status, r.tag, JSON.stringify(r.text), r.path.slice(-40), "\n     live :", (r.liveHover || []).slice(0, 3).join(" | "), "\n     clone:", (r.cloneHover || []).slice(0, 3).join(" | "));
