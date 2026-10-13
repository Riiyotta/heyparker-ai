import { chromium } from "playwright";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const CLONE = opt("clone", "http://localhost:5340/"), route = opt("route", "/"), mobile = opt("viewport", "desktop") === "mobile";
const b = await chromium.launch();
const grab = async (url) => { const pg = await (await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile })).newPage(); await pg.goto(url + (url.includes("localhost") ? "?motion=off" : ""), { waitUntil: "load" }); await pg.waitForTimeout(3500);
  return pg.evaluate(() => { const o = {}; const R = document.querySelector("#main"); const w = (e, p) => { o[p] = [e.tagName, (e.getAttribute("class") || "").split(" ").slice(0, 2).join(" "), e.children.length ? "" : (e.textContent || "").trim().slice(0, 20)]; [...e.children].forEach((c, i) => { if (!/^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(c.tagName)) w(c, p + "/" + c.tagName.toLowerCase() + i); }); }; w(R, "#main"); return o; }); };
const L = await grab("https://heyparker.ai" + route), C = await grab(CLONE.replace(/\/$/, "") + route);
let same = 0, tagOnly = 0, miss = 0, textDiff = 0; const bad = [];
for (const k of Object.keys(L)) { const c = C[k]; if (!c) { miss++; bad.push(k + " MISSING"); continue; } if (c[0] === L[k][0] && c[1] === L[k][1]) same++; else if (c[0] === L[k][0]) { tagOnly++; if (bad.length < 12) bad.push(`${k.slice(-50)} class ${L[k][1]} -> ${c[1]}`); } else bad.push(k.slice(-50) + " TAG " + L[k][0] + "->" + c[0]); }
console.log(`live ${Object.keys(L).length} clone ${Object.keys(C).length} | same tag+class ${same} | tag only ${tagOnly} | missing ${miss}`); console.log(bad.slice(0, 14).join("\n")); await b.close();
