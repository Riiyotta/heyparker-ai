// Turns the TIME recordings (record-time.mjs, record-ticker.mjs) into replay data: src/motion/data/time-<profile>-<route>.json
//   ticker   : translateX moving at a constant px/s inside [-L, 0] (L = one full loop of items + gaps, measured from the DOM)
//   rotate   : rotate(deg) at a constant deg/s (the ribbon symbols)
//   periodic : everything else (the rotating hero words, the blinking eyes): one period of 100 ms states, replayed in a loop
//
//   node qa/motion/build-time.mjs --profile desktop [--route /]
import fs from "node:fs";
const argv = process.argv.slice(2); const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const profile = opt("profile", "desktop"), route = opt("route", "/");
const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/\//g, "_");
const raw = JSON.parse(fs.readFileSync(`qa/motion/raw/time-${profile}-${slug}.json`, "utf8"));
const tick = fs.existsSync(`qa/motion/raw/ticker-${profile}.json`) ? JSON.parse(fs.readFileSync(`qa/motion/raw/ticker-${profile}.json`, "utf8")) : { tickers: {} };
const STEP = 100;
const items = [], notes = [];

const slope = (pts) => { const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0); const m = (n * sxy - sx * sy) / (n * sxx - sx * sx); return { m, b: (sy - m * sx) / n }; };

// ---- tickers ----
const tickerPaths = new Set();
for (const [p, t] of Object.entries(tick.tickers)) {
  const s = t.samples.filter((x) => x[1] != null).map((x) => [x[0] / 1000, x[1]]);
  // first monotone segment (before the first wrap) gives the signed speed
  // median of the per-interval speeds, ignoring the loop resets (robust to sampling jitter)
  const sp = []; for (let i = 1; i < s.length; i++) { const dx = s[i][1] - s[i - 1][1], dt = s[i][0] - s[i - 1][0]; if (Math.abs(dx) < 150 && dt > 0.05) sp.push(dx / dt); }
  sp.sort((x, y) => x - y); const m = sp[sp.length >> 1];
  const style = t.style0.replace(/translateX\((-?[\d.]+)px\)/, "translateX({x}px)");
  items.push({ p, kind: "ticker", L: t.L, v: Math.round(m),   // the original runs these at whole-number px/s; the measurement lands within 0.5% of it
     x0: m < 0 ? 0 : -t.L, style });
  tickerPaths.add(p); notes.push(`ticker ${p.slice(-30)}: ${Math.round(m)} px/s (measured ${m.toFixed(1)}), loop ${t.L}px = ${(t.L / Math.abs(Math.round(m))).toFixed(1)} s`);
}

// ---- the rest of the time-driven roots ----
for (const [p, r] of Object.entries(raw.roots)) {
  if (r.missing || tickerPaths.has(p)) continue;
  const S = r.samples; const styles = S.map((s) => s[1] || ""); const classes = S.map((s) => s[2] || "");
  // rotate(deg) throughout
  if (styles.every((x) => /rotate\(-?[\d.]+deg\)/.test(x))) {
    const a = styles.map((x) => +/rotate\((-?[\d.]+)deg\)/.exec(x)[1]); const un = []; let off = 0;
    a.forEach((v, i) => { if (i && v + off - un[i - 1] < -180) off += 360; if (i && v + off - un[i - 1] > 180) off -= 360; un.push(v + off); });
    const { m, b } = slope(S.map((s, i) => [s[0] / 1000, un[i]]));
    items.push({ p, kind: "rotate", w: Math.round(m * 100) / 100, a0: Math.round(((b % 360) + 360) % 360 * 100) / 100, style: styles[0].replace(/rotate\(-?[\d.]+deg\)/, "rotate({a}deg)") });
    notes.push(`rotate ${p.slice(-30)}: ${m.toFixed(1)} deg/s`); continue;
  }
  // periodic: resample to a 100 ms grid (hold last), find the smallest loop that repeats
  const dur = S[S.length - 1][0]; const N = Math.floor(dur / STEP);
  const grid = []; let j = 0; for (let i = 0; i < N; i++) { while (j + 1 < S.length && S[j + 1][0] <= i * STEP) j++; grid.push([S[j][1] || "", S[j][2] || "", S[j][3] || ""]); }
  const num = (s) => s.replace(/-?\d+\.?\d*/g, (x) => Math.round(+x * 4) / 4);   // tolerate sampling jitter inside transitions
  // an element whose text changes (the rotating words) has its period in the TEXT sequence: its style is a roll animation whose
  // exact timing varies a little between loops and would blur the test
  const textual = new Set(grid.map((g) => g[2])).size > 1;
  const key = grid.map((g) => (textual ? g[2] : num(g.join("¦"))));
  let best = null;
  for (let T = 10; T <= Math.min(160, Math.floor(N / 2)); T++) { let bad = 0, tot = 0; for (let i = 0; i + T < N; i++) { tot++; if (key[i] !== key[i + T]) bad++; } const f = bad / tot; if (!best || f < best.f - 0.004) best = { T, f }; }
  // transitions shift by a sample or two between loops, so a roll animation can fail the strict test: score the periods found on the
  // other elements too, then take the SHORTEST period that is within 5 points of the best (a 20 s loop also repeats every 10 s)
  if (!best || best.f >= 0.2) {
    const sc = []; for (const cand of [30, 60, 100, 200]) { let bad = 0, tot = 0; for (let i = 0; i + cand < N; i++) { tot++; if (key[i] !== key[i + cand]) bad++; } sc.push({ T: cand, f: bad / tot }); }
    if (best) sc.push(best); const mf = Math.min(...sc.map((x) => x.f)); best = sc.filter((x) => x.f <= mf + 0.05).sort((x, y) => x.T - y.T)[0];
  }
  let T = best && best.f < 0.4 ? best.T : null;
  if (T) { const snap = Math.round(T * STEP / 500) * 500 / STEP; if (Math.abs(snap - T) <= 1) T = snap; }   // the original loops on whole half-seconds; the search can land 100 ms off
  const frames = (T ? grid.slice(0, T) : grid).map((g, i, arr) => { const prev = i ? arr[i - 1] : null; return [g[0] !== (prev && prev[0]) ? g[0] : null, g[1] !== (prev && prev[1]) ? g[1] : null, g[2] !== (prev && prev[2]) ? g[2] : null]; });
  frames[0] = (T ? grid.slice(0, T) : grid)[0];
  items.push({ p, kind: "periodic", step: STEP, loop: !!T, T: T ? T * STEP : null, frames });
  notes.push(`periodic ${p.slice(-30)}: ${T ? `period ${(T * STEP / 1000).toFixed(1)} s (mismatch ${(best.f * 100).toFixed(1)}%)` : "no clean period: played once"}, ${frames.length} frames`);
}
const out = { v: 1, profile, route, root: "#main", items };
fs.mkdirSync("src/motion/data", { recursive: true });
const file = `src/motion/data/time-${profile}-${slug}.json`; fs.writeFileSync(file, JSON.stringify(out));
console.log(notes.join("\n")); console.log(`-> ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB, ${items.length} elements)`);
