#!/usr/bin/env python3
"""Score the live-vs-clone viewport screenshot pairs written by capture.mjs and write qa/parity/parity.json.

score(frame)  = share of pixels whose every channel is within TOL/255, on a DOWN-wide downscale, times min/max of the two page heights
                is NOT applied per frame (height is reported separately and folded into the route score).
route score   = mean frame score * min(h_live, h_clone) / max(h_live, h_clone)
section score = mean score of the frames whose viewport centre lies inside that ORIGINAL section's vertical band
Gate: every route and every section >= GATE at both viewports (the review asks for route- and section-level parity).
"""
import json, os, sys, glob
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "parity.json")
TOL = 24          # per-channel tolerance (0-255)
DOWN = 360        # compare at this width (absorbs sub-pixel antialiasing)
GATE = 0.90


def load(p):
    im = Image.open(p).convert("RGB")
    w, h = im.size
    return np.asarray(im.resize((DOWN, max(1, round(h * DOWN / w))), Image.BILINEAR), dtype=np.int16)


def frame_score(a, b):
    if a.shape != b.shape:
        h = min(a.shape[0], b.shape[0]); a, b = a[:h], b[:h]
    return float((np.abs(a - b).max(axis=2) <= TOL).mean())


def main():
    meta = json.load(open(os.path.join(SHOTS, "capture-meta.json")))
    rows = []
    for key, run in meta["runs"].items():
        vp, _, route = key.partition("/")
        route = "/" + route
        slug = "home" if route == "/" else route.strip("/").replace("/", "_")
        if "error" in run:
            rows.append({"viewport": vp, "route": route, "error": run["error"], "score": 0.0}); continue
        live_d = os.path.join(SHOTS, vp, slug, "live"); clone_d = os.path.join(SHOTS, vp, slug, "clone")
        frames = []
        vh = run["viewport"]["height"]
        for i, y in enumerate(run["steps"]):
            f = f"{i:03d}.png"
            if not (os.path.exists(os.path.join(live_d, f)) and os.path.exists(os.path.join(clone_d, f))):
                frames.append({"i": i, "y": y, "score": 0.0, "missing": True}); continue
            frames.append({"i": i, "y": y, "score": round(frame_score(load(os.path.join(live_d, f)), load(os.path.join(clone_d, f))), 4)})
        hl, hc = run["live"]["height"], run["clone"]["height"]
        hr = min(hl, hc) / max(hl, hc)
        mean = float(np.mean([f["score"] for f in frames])) if frames else 0.0
        secs = []
        for s in run["live"]["sections"]:
            inside = [f["score"] for f in frames if s["top"] <= f["y"] + vh / 2 < s["top"] + s["height"]]
            if not inside:  # section shorter than a frame step: use the frame that contains its top
                inside = [f["score"] for f in frames if f["y"] <= s["top"] < f["y"] + vh][:1]
            if inside:
                secs.append({"name": s["name"], "top": s["top"], "height": s["height"], "frames": len(inside), "score": round(float(np.mean(inside)), 4)})
        rows.append({"viewport": vp, "route": route, "liveHeight": hl, "cloneHeight": hc, "heightRatio": round(hr, 4),
                     "frames": len(frames), "meanFrameScore": round(mean, 4), "score": round(mean * hr, 4),
                     "belowGateSections": [s["name"] + f" @{s['top']}" for s in secs if s["score"] < GATE], "sections": secs, "frameScores": frames})
    scored = [r["score"] for r in rows]
    out = {"kind": "react-clone", "comparison": "live-original-vs-clone", "live": meta["live"], "capturedAt": meta["capturedAt"], "settleMs": meta["settleMs"],
           "method": f"Both sites loaded at the same viewport and scrolled to the same offsets (one frame per viewport height, original's page height). Frames compared at {DOWN}px wide; a pixel matches when every channel is within {TOL}/255. Route score = mean frame score x min/max page height. Section score = mean of the frames whose viewport centre falls inside the original section.",
           "gate": GATE, "average": round(float(np.mean(scored)), 4) if scored else 0, "routesBelowGate": [f"{r['viewport']} {r['route']}" for r in rows if r["score"] < GATE], "rows": rows}
    json.dump(out, open(OUT, "w"), indent=2); open(OUT, "a").write("\n")
    for r in rows:
        print(f"{r['viewport']:8} {r['route']:34} score {r['score']:.3f}  frames {r.get('frames')}  H {r.get('liveHeight')}/{r.get('cloneHeight')}  below-gate sections {len(r.get('belowGateSections', []))}")
    print("average", out["average"], "| routes below gate:", out["routesBelowGate"])


if __name__ == "__main__":
    main()
