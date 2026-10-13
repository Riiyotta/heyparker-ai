// Turns a raw scroll recording (record-scroll.mjs) into the offline replay data the clone ships:
//   - every absolute URL in src / srcset / style is rewritten to the clone's local path (same naming rule as mirror/_serve.py)
//   - every file those URLs name is copied from mirror/public/ into public/ if it is not there yet
//   - each element's patches become cumulative states, so a jump of any size lands on the right frame
// Output: src/motion/data/<profile>-<route>.json
//
//   node qa/motion/build-timeline.mjs --profile desktop [--route /] [--origin https://heyparker.ai]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const profile = opt("profile", "desktop"), route = opt("route", "/"), ORIGIN = opt("origin", "https://heyparker.ai");
const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
const rawFile = `qa/motion/raw/${profile}-${slug}.json`;
const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));

const sha8 = (s) => crypto.createHash("sha1").update(s, "utf8").digest("hex").slice(0, 8);
const clean = (seg) => { let c = seg.replace(/[<>:"|?*\\\x00-\x1f]/g, "_"); if (/^\.+$/.test(c)) c = "_"; return Buffer.byteLength(c) > 180 ? c.slice(0, 40) + "__" + sha8(c) : c; };
function localPath(u) {
  const url = new URL(u, ORIGIN + "/");
  let p; try { p = decodeURIComponent(url.pathname); } catch { p = url.pathname; }
  if (p.endsWith("/")) p += "__index";
  const segs = p.split("/").filter(Boolean).map(clean);
  let rel = (url.origin === ORIGIN ? segs : ["_ext", clean(url.host), ...segs]).join("/");
  const q = url.search.replace(/^\?/, "");
  if (q) { let dq; try { dq = decodeURIComponent(q); } catch { dq = q; } const ext = path.posix.extname(rel); rel = rel.slice(0, rel.length - ext.length) + "__" + sha8(dq) + ext; }
  return rel;
}

const copied = new Set(), missing = new Set(), files = new Set();
function ensure(rel) {
  files.add(rel);
  const dst = path.join("public", rel);
  if (fs.existsSync(dst)) return;
  const src = path.join("mirror/public", rel);
  if (fs.existsSync(src) && fs.statSync(src).isFile()) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); copied.add(rel); }
  else missing.add(rel);
}
const URL_RE = /https?:\/\/[^\s,"')]+/g;
function localise(v) {
  if (typeof v !== "string" || !v.includes("http")) return v;
  return v.replace(URL_RE, (u) => { try { const rel = localPath(u); ensure(rel); return "/" + rel.split("/").map(encodeURIComponent).join("/"); } catch { return u; } });
}
const loc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "text" ? v : localise(v)]));

const initFile = `qa/motion/raw/${profile}-${slug}-initial.json`;
const initRaw = fs.existsSync(initFile) ? JSON.parse(fs.readFileSync(initFile, "utf8")) : { patches: {}, fresh: {} };
const init = Object.fromEntries(Object.entries(initRaw.patches).map(([p, patch]) => [p, loc(patch)]));
const fresh = initRaw.fresh || {};   // the original's state at a fresh load: the truth for "before any scroll" (scrolling back up does not restore it)

const els = raw.elements.map((e) => {
  const fields = [...new Set(e.events.flatMap(([, p]) => Object.keys(p)))];
  const base = Object.fromEntries(fields.map((f) => [f, (fresh[e.path] && fresh[e.path][f] !== undefined ? fresh[e.path][f] : e.baseline[f]) ?? null]));
  const ys = [], st = []; let cur = { ...base };
  for (const [y, patch] of e.events) { cur = { ...cur, ...patch }; ys.push(y); st.push(loc(cur)); }
  return { p: e.path, f: fields, base: loc(base), ys, st };
});


const out = { v: 1, profile, route, root: raw.root, init, rec: { vh: raw.viewport.height, vw: raw.viewport.width, total: raw.total, step: raw.step }, timeDriven: raw.timeDriven, els };
fs.mkdirSync("src/motion/data", { recursive: true });
const file = `src/motion/data/${profile}-${slug}.json`;
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${profile} ${route}: ${Object.keys(init).length} initial-state patches, ${els.length} elements, ${els.reduce((n, e) => n + e.ys.length, 0)} states -> ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
console.log(`  files referenced ${files.size}, copied into public/ ${copied.size}, already present ${files.size - copied.size - missing.size}, MISSING from mirror ${missing.size}`);
if (missing.size) console.log("  missing:", [...missing].slice(0, 10).join("\n           "));
