import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { routes } from "./routes.js";
import { variants } from "./variants.js";

const norm = (p) => p.replace(/\/+$/, "") || "/";
const route = routes.find((r) => r.path === norm(decodeURIComponent(location.pathname))) || null;
const setAttrs = (el, attrs) => { for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); };
if (route) { setAttrs(document.documentElement, route.html); setAttrs(document.body, route.body); document.title = route.title; }

// The original renders only the active breakpoint's markup, so each breakpoint is its own page (src/pages/*Mobile.jsx,
// registered in src/variants.js; qa/clone/export-variant.mjs). Desktop is the page the route itself loads.
const MOBILE = window.matchMedia("(max-width: 809.98px)");
const pick = async () => {
  const v = route && MOBILE.matches && variants[`mobile:${route.path}`];
  return (await (v ? v() : route ? route.load() : Promise.resolve(null)))?.default;
};
// ?motion=off renders the frozen, un-animated DOM (used by qa/motion/record-baseline.mjs to diff against the original)
const motionOn = !/[?&]motion=off\b/.test(location.search);

let root = null, stopMotion = null;
const mount = async () => {
  const Page = await pick();
  if (stopMotion) { (await stopMotion).forEach((stop) => stop()); stopMotion = null; }
  root ??= createRoot(document.getElementById("root"));
  root.render(<App Page={Page} />);
  // the original's runtime behaviour, replayed from measurements (src/motion/): scroll-driven state (image sequences, nav collapse,
  // scene switches) and time-driven state (tickers, spinning symbols, rotating words, blinking eyes)
  if (route && motionOn) stopMotion = new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() =>
    Promise.all([import("./motion/replay.js"), import("./motion/time.js")]).then(([r, t]) => Promise.all([r.startReplay(route.path), t.startTime(route.path)])).then(res))));
};
mount();
MOBILE.addEventListener("change", mount);   // crossing the breakpoint swaps the variant, like the original does
