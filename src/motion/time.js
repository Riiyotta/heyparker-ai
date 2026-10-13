// Time-driven motion of the original: tickers, spinning ribbon symbols, the rotating hero words, blinking eyes.
// Measured by qa/motion/record-time.mjs + record-ticker.mjs and reduced to simple models by qa/motion/build-time.mjs:
//   ticker   : translateX at a constant px/s, looping every L px (one full set of items + gaps)
//   rotate   : rotate(deg) at a constant deg/s
//   periodic : one period of 100 ms states, replayed in a loop (style/class/text), numeric parts interpolated between states
// The original's own runtime is not carried over. Under prefers-reduced-motion the elements stay in their first state.
const loaders = import.meta.glob("./data/time-*.json", { import: "default" });
const BP_MOBILE = "(max-width: 809.98px)";

const resolve = (root, p) => {
  let el = root;
  for (const tok of p.split("/")) {
    const m = /^([a-z0-9]+?)(\d+)$/.exec(tok);
    if (!m || !el.children[+m[2]] || el.children[+m[2]].tagName.toLowerCase() !== m[1]) return null;
    el = el.children[+m[2]];
  }
  return el;
};

const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
const skeleton = (s) => s.replace(NUM, "#");
// linear blend of two style strings that differ only in their numbers (scaleY(.3) -> scaleY(.33), translateY(-15%) ...)
const lerpStyle = (a, b, f) => {
  if (a === b || !a || !b || skeleton(a) !== skeleton(b)) return a;
  const nb = b.match(NUM); let i = 0;
  return a.replace(NUM, (x) => { const v = +x + (+nb[i++] - +x) * f; return String(Math.round(v * 1000) / 1000); });
};

export async function startTime(route = "/") {
  const profile = window.matchMedia(BP_MOBILE).matches ? "mobile" : "desktop";
  const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
  const load = loaders[`./data/time-${profile}-${slug}.json`];
  if (!load) return () => {};
  const data = await load();
  const root = document.querySelector(data.root || "#main");
  if (!root) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const live = [];
  for (const it of data.items) {
    const el = resolve(root, it.p);
    if (!el) continue;
    const o = { it, el, visible: true, last: null };
    if (it.kind === "periodic") {                       // expand the delta frames into full states once
      let s = "", c = "", x = "";
      o.frames = it.frames.map(([fs, fc, fx]) => { if (fs != null) s = fs; if (fc != null) c = fc; if (fx != null) x = fx; return { s, c, x }; });
    }
    live.push(o);
  }
  if ("IntersectionObserver" in window) {                // nothing to do for elements that are off screen
    const io = new IntersectionObserver((es) => es.forEach((e) => { for (const o of live) if (o.watch === e.target) o.visible = e.isIntersecting; }), { rootMargin: "200px" });
    // a visually-hidden element (screen-reader text at left:-9999px) is never "intersecting": watch its parent instead
    live.forEach((o) => { const r = o.el.getBoundingClientRect(); o.watch = r.width === 0 || r.right < 0 || /-9999px/.test(o.el.getAttribute("style") || "") ? o.el.parentElement : o.el; io.observe(o.watch); });
  }

  const frame = (ms) => {
    for (const o of live) {
      if (!o.visible) continue;
      const { it, el } = o;
      if (it.kind === "ticker") {
        const L = it.L, p = it.v < 0 ? -((((-it.x0 - it.v * ms / 1000) % L) + L) % L) : -L + ((((it.v * ms / 1000) % L) + L) % L);
        el.style.transform = `translateX(${p.toFixed(2)}px)`;
      } else if (it.kind === "rotate") {
        const a = (((it.a0 + it.w * ms / 1000) % 360) + 360) % 360;
        el.style.transform = `rotate(${a.toFixed(2)}deg)`;
      } else {
        const n = o.frames.length, u = it.loop ? (ms % it.T) / it.step : Math.min(ms / it.step, n - 1), i = Math.floor(u) % n, f = u - Math.floor(u);
        const a = o.frames[i], b = o.frames[(i + 1) % n];
        const style = lerpStyle(a.s, b.s, f);
        if (style !== o.last?.s) { if (style) el.setAttribute("style", style); else el.removeAttribute("style"); }
        if (a.c !== o.last?.c) { if (a.c) el.setAttribute("class", a.c); else el.removeAttribute("class"); }
        if (a.x !== o.last?.x && el.children.length === 0) el.textContent = a.x;
        o.last = { s: style, c: a.c, x: a.x };
      }
    }
  };

  let raf = 0, stopped = false;
  const t0 = performance.now();
  const tick = (now) => { if (stopped) return; frame(now - t0); raf = requestAnimationFrame(tick); };
  if (reduced) frame(0); else raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}
