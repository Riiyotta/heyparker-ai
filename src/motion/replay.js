// Scroll replay: reproduces the original's scroll-driven state (scrubbed image sequences, nav collapse, scene switches).
//
// The original site rewrites element attributes (src, style, class, text) from its own scroll runtime. That runtime is not
// carried over; instead qa/motion/record-scroll.mjs measured, per element, what each attribute is at each scroll offset, and
// build-timeline.mjs wrote it to src/motion/data/<profile>-<route>.json with local URLs only. This file applies those states.
//
// Scroll position is mapped by progress (scrollY / scrollable height) so the recorded offsets still land on the right frame
// when the viewport is not the size the recording was made at. At the recorded size it is exactly the recorded offset.
const loaders = import.meta.glob("./data/*.json", { import: "default" });   // lazy: only the profile in use is fetched

const BP_MOBILE = "(max-width: 809.98px)";

async function pickData(route) {
  const profile = window.matchMedia(BP_MOBILE).matches ? "mobile" : "desktop";
  const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
  const load = loaders[`./data/${profile}-${slug}.json`];
  return load ? load() : null;
}

const resolve = (root, p) => {
  let el = root;
  if (!p) return el;
  for (const tok of p.split("/")) {
    const m = /^([a-z0-9]+?)(\d+)$/.exec(tok);
    if (!m || !el.children[+m[2]] || el.children[+m[2]].tagName.toLowerCase() !== m[1]) return null;
    el = el.children[+m[2]];
  }
  return el;
};

const apply = (el, s) => {
  for (const k in s) {
    const v = s[k];
    if (k === "text") { if (el.children.length === 0 && el.textContent !== v) el.textContent = v ?? ""; }
    else if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); }
    else if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
};

const bisect = (ys, y) => { let lo = 0, hi = ys.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ys[m] <= y) lo = m + 1; else hi = m; } return lo - 1; };

export async function startReplay(route = "/") {
  const data = await pickData(route);
  if (!data) return () => {};
  const root = document.querySelector(data.root || "#main");
  if (!root) return () => {};
  // 1) the original's state at scroll 0 for elements the clone's baked-in DOM has in another state
  for (const [p, patch] of Object.entries(data.init || {})) { const el = resolve(root, p); if (el) apply(el, patch); }
  // 2) scroll-driven elements
  const tracked = data.els.map((d) => ({ d, el: resolve(root, d.p), idx: -2 })).filter((t) => t.el);

  const docH = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const toRecorded = () => {
    const span = Math.max(1, docH() - window.innerHeight);
    const recSpan = Math.max(1, data.rec.total - data.rec.vh);
    return (window.scrollY / span) * recSpan;
  };

  let raf = 0;
  const update = () => {
    raf = 0;
    const y = toRecorded();
    for (const t of tracked) {
      const i = bisect(t.d.ys, y);
      if (i === t.idx) continue;
      t.idx = i;
      apply(t.el, i < 0 ? t.d.base : t.d.st[i]);
    }
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // warm every frame the timeline can show, nearest-to-current first, so scrubbing never waits on a decode
  const urls = [];
  for (const t of tracked) for (const s of t.d.st) for (const k of ["src", "srcset"]) if (s[k]) for (const u of String(s[k]).split(",")) urls.push(u.trim().split(/\s+/)[0]);
  const warm = [...new Set(urls)];
  let n = 0;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
  const pump = () => { for (let k = 0; k < 4 && n < warm.length; k++) { const im = new Image(); im.decoding = "async"; im.src = warm[n++]; } if (n < warm.length) idle(pump); };
  if (document.readyState === "complete") idle(pump); else window.addEventListener("load", () => idle(pump), { once: true });

  return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
}
