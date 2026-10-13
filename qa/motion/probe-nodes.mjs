// Is the scroll-scrubbed image the SAME <img> node with a changing src, or are nodes mounted/unmounted per frame?
import { chromium } from "playwright";
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await pg.goto("https://heyparker.ai/", { waitUntil: "load" }); await pg.waitForTimeout(4000);
await pg.evaluate(() => { window.__tag = 0; document.querySelectorAll("#main *").forEach((e) => { e.__id = ++window.__tag; }); window.__n0 = window.__tag; });
const rows = [];
for (const y of [0, 600, 750, 1050, 1200, 1500, 1800, 2400, 3300, 4050]) {
  await pg.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y); await pg.waitForTimeout(500);
  rows.push(y + " " + await pg.evaluate(() => {
    const vis = [...document.querySelectorAll("#main img")].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 300; });
    return vis.map((i) => `id${i.__id ?? "NEW"} ${i.getAttribute("src")?.split("/").pop().slice(0, 16)} ${i.hasAttribute("srcset") ? "srcset" : ""} ${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)} parent=${i.parentElement.className.slice(0, 20)} gp=${i.parentElement.parentElement.className.slice(0, 20)}`).join(" | ") + ` || total imgs ${document.querySelectorAll("#main img").length}, new nodes ${[...document.querySelectorAll("#main *")].filter((e) => !e.__id).length}`;
  }));
}
console.log(rows.join("\n")); await b.close();
