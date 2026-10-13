// Breakpoint variants. Framer renders ONLY the active breakpoint's markup, so the desktop-captured clone has no mobile DOM
// (measured: at 390px only 568 of 1091 original elements pair with the clone by tag+class). This script captures the original's
// rendered DOM at the variant's viewport, converts it with the generator's own serialiser (clone-dom.js) and writes a page:
//
//   node qa/clone/export-variant.mjs --viewport mobile --route / [--url https://heyparker.ai]
//   -> src/pages/<Page>Mobile.jsx          (registered in src/variants.js)
//
// Media URLs become local files (copied from mirror/public, or downloaded once if the desktop crawl never saw them);
// links to other sites become "#". The site's JavaScript is not carried over (see src/motion/ for the behaviour).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { exportClone } from "./clone-dom.js";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LIVE = opt("url", "https://heyparker.ai").replace(/\/$/, ""), route = opt("route", "/"), profile = opt("viewport", "mobile");
const VPS = { mobile: { width: 390, height: 844, isMobile: true, hasTouch: true }, tablet: { width: 834, height: 1112, isMobile: false, hasTouch: true } };
const VP = VPS[profile];
const pageName = opt("page", route === "/" ? "Home" : route.replace(/^\/|\/$/g, "").split(/[\/-]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("")) ;

const sha8 = (s) => crypto.createHash("sha1").update(s, "utf8").digest("hex").slice(0, 8);
const clean = (seg) => { let c = seg.replace(/[<>:"|?*\\\x00-\x1f]/g, "_"); if (/^\.+$/.test(c)) c = "_"; return Buffer.byteLength(c) > 180 ? c.slice(0, 40) + "__" + sha8(c) : c; };
function localPath(u) {
  const url = new URL(u, LIVE + "/");
  let p; try { p = decodeURIComponent(url.pathname); } catch { p = url.pathname; }
  if (p.endsWith("/")) p += "__index";
  const segs = p.split("/").filter(Boolean).map(clean);
  let rel = (url.origin === LIVE ? segs : ["_ext", clean(url.host), ...segs]).join("/");
  const q = url.search.replace(/^\?/, "");
  if (q) { let dq; try { dq = decodeURIComponent(q); } catch { dq = q; } const ext = path.posix.extname(rel); rel = rel.slice(0, rel.length - ext.length) + "__" + sha8(dq) + ext; }
  return rel;
}
const TRACKER = /googletagmanager|google-analytics|doubleclick|googleadservices|facebook\.com\/tr|connect\.facebook|events\.framer|posthog|hotjar|clarity\.ms|vercel-insights|_vercel\/insights/i;
const stats = { copied: 0, downloaded: 0, present: 0, failed: [], links: 0, trackers: 0 };
const todo = new Map();
function ensureLater(u, rel) { todo.set(rel, u); }
async function fetchMissing() {
  for (const [rel, u] of todo) {
    const dst = path.join("public", rel);
    if (fs.existsSync(dst)) { stats.present++; continue; }
    const src = path.join("mirror/public", rel);
    if (fs.existsSync(src) && fs.statSync(src).isFile()) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); stats.copied++; continue; }
    try { const r = await fetch(u); if (!r.ok) throw new Error(r.status); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer())); stats.downloaded++; }
    catch (e) { stats.failed.push(rel + " (" + e.message + ")"); }
  }
}
const URL_RE = /https?:\/\/[^\s,"')\\}]+/g;
function localiseJsx(s) {
  // external navigation links -> "#"  (same policy as the generator)
  s = s.replace(/href="(https?:\/\/[^"]+)"/g, (m, u) => { try { if (new URL(u).origin === LIVE) return `href="${new URL(u).pathname}${new URL(u).hash}"`; } catch {} stats.links++; return 'href="#"'; });
  return s.replace(URL_RE, (u) => {
    if (/^https?:\/\/www\.w3\.org\//.test(u)) return u;   // XML namespaces (xmlns, xlink), not requests
    if (TRACKER.test(u)) { stats.trackers++; return "about:blank"; }
    try { const rel = localPath(u); ensureLater(u, rel); return "/" + rel.split("/").map(encodeURIComponent).join("/"); } catch { return u; }
  });
}

const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: !!VP.isMobile, hasTouch: !!VP.hasTouch })).newPage();
await pg.goto(LIVE + route, { waitUntil: "load", timeout: 90000 });
await pg.waitForTimeout(4500);
await pg.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await pg.waitForTimeout(1200);
const data = await pg.evaluate(exportClone);
await b.close();

let jsx = localiseJsx(data.skeleton).replace(/\u0001S\d+\u0001/g, "");
if (/\u0001STILL/.test(jsx)) { console.log("note: canvas/animation stills present — not captured by this script:", data.stills.length); jsx = jsx.replace(/\u0001STILL\d+\u0001/g, "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"); }
await fetchMissing();

// stylesheets in force on the variant: any that the desktop build does not already ship?
const have = new Set(fs.readdirSync("public/styles").map((f) => sha8(fs.readFileSync(path.join("public/styles", f), "utf8"))));
let newCss = 0;
let indexHtml = fs.readFileSync("index.html", "utf8");
for (const st of data.styles) if (st.text && !have.has(sha8(st.text))) {
  const name = `${profile}-${sha8(st.text)}.css`; fs.writeFileSync(path.join("public/styles", name), localiseJsx(st.text)); newCss++;   // @font-face etc. must not point at another site
  if (!indexHtml.includes(name)) indexHtml = indexHtml.replace("</head>", `<link rel="stylesheet" href="/styles/${name}">\n</head>`);
}
fs.writeFileSync("index.html", indexHtml);
await fetchMissing();

fs.mkdirSync("src/pages", { recursive: true });
const comp = `${pageName}${profile[0].toUpperCase()}${profile.slice(1)}`;
fs.writeFileSync(`src/pages/${comp}.jsx`, `// ${route} at the ${profile} breakpoint. The original's rendered DOM at ${VP.width}px, converted by the same serialiser as the\n// desktop pages (qa/clone/export-variant.mjs). Framer renders only the active breakpoint's markup, so this is a separate variant.\nexport default function ${comp}Page() {\n  return (\n    <>${jsx}</>\n  );\n}\n`);
const vf = "src/variants.js";
let v = fs.existsSync(vf) ? fs.readFileSync(vf, "utf8") : `// Breakpoint variants: route -> page for each variant (see qa/clone/export-variant.mjs). main.jsx picks one by media query.\nexport const variants = {\n};\n`;
const entry = `  ${JSON.stringify(profile + ":" + route)}: () => import("./pages/${comp}.jsx"),\n`;
if (!v.includes(JSON.stringify(profile + ":" + route))) v = v.replace(/\n};\n$/, "\n" + entry + "};\n");
fs.writeFileSync(vf, v);
console.log(`${profile} ${route}: ${jsx.length} chars JSX -> src/pages/${comp}.jsx | assets: present ${stats.present}, copied ${stats.copied}, downloaded ${stats.downloaded}, failed ${stats.failed.length} | external links -> "#": ${stats.links} | tracker URLs blanked: ${stats.trackers} | new stylesheets: ${newCss}`);
if (stats.failed.length) console.log("  failed:", stats.failed.slice(0, 8).join("\n          "));
