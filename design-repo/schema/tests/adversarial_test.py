#!/usr/bin/env python3
"""Adversarial suite: proves every rule REJECTS a bad PageSpec for the RIGHT reason, and that controls pass.

Controls: the bundled example + one synthesized minimal PageSpec per template (generic loop, so a new
template needs no new control code). Mutations are built from this repo's own contracts; each one must
produce an error (or, for warn-severity rules, a warning) naming the specific rule it targets. A mutation
that cannot be built for this repo is reported as SKIPPED with the reason -- never silently dropped.
Usage: python3 adversarial_test.py"""
import copy, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.path.dirname(HERE)
REPO = os.path.dirname(SCHEMA)
spec_ = importlib.util.spec_from_file_location("semantic_validate", os.path.join(SCHEMA, "semantic_validate.py"))
sv = importlib.util.module_from_spec(spec_); spec_.loader.exec_module(sv)

SECS = sv.contracts()
TEMPLATES = sv.load("templates/templates.json")["templates"]
GRAPH = {r["id"]: r for r in sv.load("compatibility/graph.json")["rules"]}
VERSION = sv.load("schema/pagespec.schema.json")["properties"]["pageSpecVersion"]["const"]
NONE = {"pattern": "none", "reducedMotionFallback": "disable-animation"}


def minimal_node(sid, motion=None):
    f = SECS[sid]["content"]["fields"]
    content = {}
    if f.get("heading", {}).get("required"): content["heading"] = "Sample"
    if f.get("subheading", {}).get("required"): content["subheading"] = "Sample"
    if f.get("body", {}).get("required"): content["body"] = ["Sample"]
    if f.get("ctas", {}).get("required"): content["ctas"] = [{"label": "Go"}]
    if f.get("items", {}).get("required"): content["items"] = [{"title": "Sample"}]
    return {"type": sid, "content": content, "motion": dict(motion or NONE)}


def control_for(t):
    return {"pageSpecVersion": VERSION, "template": t["id"], "route": (t.get("routes") or ["/sample"])[0],
            "nodes": [minimal_node(n["section"]) for n in t["nodes"]]}


def main():
    example = sv.load("schema/example.pagespec.json")
    tmpl = {t["id"]: t for t in TEMPLATES}[example["template"]]
    tseq = [n["section"] for n in tmpl["nodes"]]
    types = [n["type"] for n in example["nodes"]]
    cases, skipped = [], []   # case: (label, spec, expect, needle) with expect in {"pass", "error", "warn"}
    cases.append(("control: bundled example", example, "pass", None))
    for t in TEMPLATES:
        cases.append((f"control: minimal {t['id']}", control_for(t), "pass", None))

    def mut(label, fn, needle, expect="error", why_not=None):
        if why_not:
            skipped.append(f"{label}: {why_not}"); return
        s = copy.deepcopy(example); fn(s); cases.append((label, s, expect, needle))

    first_idx = lambda pred: next((i for i, n in enumerate(example["nodes"]) if pred(n)), None)

    # ---- schema layer
    mut("wrong template enum", lambda s: s.__setitem__("template", "template.does-not-exist"), "schema: template")
    mut("missing required motion", lambda s: s["nodes"][0].pop("motion"), "'motion' is a required property")
    mut("invented section type", lambda s: s["nodes"][0].__setitem__("type", "hero.invented-type"), "schema: nodes/0/type")
    mut("missing reducedMotionFallback", lambda s: s["nodes"][0]["motion"].pop("reducedMotionFallback"), "reducedMotionFallback")
    mut("invented motion field", lambda s: s["nodes"][0]["motion"].__setitem__("inventedAnimation", True), "inventedAnimation")
    mut("per-instance style override on a node", lambda s: s["nodes"][0].__setitem__("style", {"color": "#ff0000"}), "'style' was unexpected")
    mut("raw theme override at page level", lambda s: s.__setitem__("theme", {"color.text.primary": "#ff0000"}), "'theme' was unexpected")
    mut("wrong pageSpecVersion", lambda s: s.__setitem__("pageSpecVersion", "9.9.9"), "schema: pageSpecVersion")
    mut("unknown content field", lambda s: s["nodes"][0]["content"].__setitem__("inventedField", "x"), "'inventedField' was unexpected")
    cta = first_idx(lambda n: "ctas" in SECS[n["type"]]["content"]["fields"])
    mut("link to a live external URL", lambda s: s["nodes"][cta]["content"].__setitem__("ctas", [{"label": "Go", "href": "https://evil.example/x"}]),
        "does not match", why_not=None if cta is not None else "no section with ctas")
    img = first_idx(lambda n: "images" in SECS[n["type"]]["content"]["fields"])
    mut("invented assetRole", lambda s: s["nodes"][img]["content"].__setitem__("images", [{"assetRole": "invented-role"}]),
        "invented-role", why_not=None if img is not None else "no section with images")
    if img is not None:
        role = (SECS[example["nodes"][img]["type"]]["content"]["fields"]["images"].get("assetRoles") or ["content-image"])[0]
        mut("alt text over its word budget", lambda s: s["nodes"][img]["content"].__setitem__("images", [{"assetRole": role, "alt": " ".join(["w"] * 17)}]), "alt has 17 words")

    # ---- structural layer (template cross-reference)
    once = [i for i, tn in enumerate(tmpl["nodes"]) if tn["required"] and tseq.count(tn["section"]) == 1]
    mut("removed mandatory section", lambda s: s["nodes"].pop(types.index(tseq[once[0]])), "missing",
        why_not=None if once and len(types) > 1 else "no required section that occurs once")
    if len(types) >= 2 and types[0] != types[1]:
        mut("first two sections swapped", lambda s: s["nodes"].__setitem__(slice(0, 2), [s["nodes"][1], s["nodes"][0]]), "out of order")
    else:
        skipped.append("first two sections swapped: fewer than two distinct leading sections")
    foreign = next((sid for sid in sorted(SECS) if sid not in tseq), None)
    mut("section from outside the template", lambda s: s["nodes"].insert(1, minimal_node(foreign)), "not part of template",
        why_not=None if foreign else "every section belongs to this template")
    other = next((t for t in TEMPLATES if t["id"] != tmpl["id"] and [n["section"] for n in t["nodes"]] != tseq), None)
    mut("declared template contradicts the nodes", lambda s: s.__setitem__("template", other["id"]), "template:",
        why_not=None if other else "only one template in this repo")

    # ---- graph layer: each rule must fire by its own id
    one = first_idx(lambda n: SECS[n["type"]]["constraints"].get("onePerPage"))
    mut("SECTION_PER_PAGE_LIMITS: one-per-page section duplicated", lambda s: s["nodes"].insert(one + 1, copy.deepcopy(s["nodes"][one])),
        "SECTION_PER_PAGE_LIMITS", why_not=None if one is not None else "no one-per-page section")
    fb = GRAPH["SHELL_MUST_BE_FIRST"]["sections"]; fi = first_idx(lambda n: n["type"] in fb)
    mut("SHELL_MUST_BE_FIRST: first section moved to the end", lambda s: s["nodes"].append(s["nodes"].pop(fi)), "SHELL_MUST_BE_FIRST",
        why_not=None if fi is not None and len(types) > 1 else "no mustBeFirst section in the example")
    lb = GRAPH["SHELL_MUST_BE_LAST"]["sections"]; li = next((i for i in range(len(types) - 1, -1, -1) if types[i] in lb), None)
    mut("SHELL_MUST_BE_LAST: last section moved to the front", lambda s: s["nodes"].insert(0, s["nodes"].pop(li)), "SHELL_MUST_BE_LAST",
        why_not=None if li is not None and len(types) > 1 else "no mustBeLast section in the example")
    nc = GRAPH["NO_CONSECUTIVE_SAME_SECTION"]["sections"]; ni = first_idx(lambda n: n["type"] in nc)
    mut("NO_CONSECUTIVE_SAME_SECTION (warn)", lambda s: s["nodes"].insert(ni + 1, copy.deepcopy(s["nodes"][ni])), "NO_CONSECUTIVE_SAME_SECTION", "warn",
        why_not=None if ni is not None else "no section is restricted from repeating back-to-back")
    allowed = {tuple(p) for p in GRAPH["NO_ADJACENT_SAME_CATEGORY"].get("exceptions", [])}
    pair = next(((a, b) for a in sorted(SECS) for b in sorted(SECS) if a != b and SECS[a]["category"] == SECS[b]["category"] and (a, b) not in allowed), None)
    mut("NO_ADJACENT_SAME_CATEGORY (warn)", lambda s: s["nodes"].extend([minimal_node(pair[0]), minimal_node(pair[1])]), "NO_ADJACENT_SAME_CATEGORY", "warn",
        why_not=None if pair else "no two sections share a category")
    budget = GRAPH["MOTION_BUDGET"]["max"]
    animated = next((sid for sid in sorted(SECS) if [p for p in SECS[sid]["motion"]["allowedPatterns"] if p != "none"]), None)
    if animated:
        pat = [p for p in SECS[animated]["motion"]["allowedPatterns"] if p != "none"][0]
        mut("MOTION_BUDGET (warn)", lambda s: s["nodes"].extend([minimal_node(animated, {"pattern": pat, "reducedMotionFallback": "disable-animation"}) for _ in range(budget + 1)]), "MOTION_BUDGET", "warn")
    else:
        skipped.append("MOTION_BUDGET: no section allows an animated pattern")
    heroes = sorted(sid for sid, c in SECS.items() if c["category"] == "HERO")
    hi = first_idx(lambda n: SECS[n["type"]]["category"] == "HERO")
    extra = next((h for h in heroes if hi is None or h != types[hi]), None)
    why = None if (hi is not None and extra) else "fewer than two HERO section types"
    if not why and example["template"] in GRAPH["ONE_HERO_PER_PAGE"]["exceptions"]: why = "the example's template is a named exception"
    mut("ONE_HERO_PER_PAGE: a second HERO section", lambda s: s["nodes"].insert(hi + 1, minimal_node(extra)), "ONE_HERO_PER_PAGE", why_not=why)

    # ---- runtime budgets
    wn = next(((i, k) for i, n in enumerate(example["nodes"]) for k in ("heading", "subheading") if k in n["content"]), None)
    if wn:
        i, k = wn; mw = SECS[types[i]]["content"]["fields"][k]["maxWords"]
        mut(f"maxWords overflow on a {k}", lambda s: s["nodes"][i]["content"].__setitem__(k, " ".join(["word"] * (mw + 1))), f"{k} has {mw + 1} words")
    else:
        skipped.append("maxWords overflow: example has no heading")
    itn = first_idx(lambda n: n["content"].get("items"))
    if itn is not None:
        tw = SECS[types[itn]]["content"]["fields"]["items"]["titleMaxWords"]
        mut("maxWords overflow on an item title", lambda s: s["nodes"][itn]["content"]["items"][0].__setitem__("title", " ".join(["word"] * (tw + 1))), "title has")
    noanim = first_idx(lambda n: SECS[n["type"]]["motion"]["allowedPatterns"] == ["none"])
    mut("motion pattern not allowed for its section", lambda s: s["nodes"][noanim]["motion"].__setitem__("pattern", "scroll-linked"), "not allowed",
        why_not=None if noanim is not None else "every section allows animation")

    ok = fail = 0
    for label, spec, expect, needle in cases:
        errors, warnings = sv.check(spec)
        if expect == "pass": good = not errors
        elif expect == "error": good = any(needle in e for e in errors)
        else: good = any(needle in w for w in warnings)
        if good: ok += 1
        else:
            fail += 1
            print(f"FAIL: {label}: expected {expect}" + (f" containing '{needle}'" if needle else "") + f"; errors={errors[:3]} warnings={warnings[:3]}")
    for s_ in skipped: print("SKIPPED:", s_)
    n_ctrl = sum(1 for c in cases if c[2] == "pass")
    print(f"adversarial: {ok} passed, {fail} failed ({n_ctrl} controls, {len(cases) - n_ctrl} mutations, {len(skipped)} skipped as not applicable)")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
