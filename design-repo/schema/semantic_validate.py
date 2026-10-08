#!/usr/bin/env python3
"""Semantic validator for a PageSpec against this design repo.

Enforces, in order:
  1. JSON Schema draft-07 (schema/pagespec.schema.json) -- structural closure
  2. template cross-reference: the node sequence must follow the DECLARED template's own
     node list (order, required nodes present, repeatable/maxCount respected, no foreign sections)
  3. every rule in compatibility/graph.json, respecting severity (error fails, warn is reported)
  4. per-field maxWords budgets from sections/<id>.json, on this instance
  5. motion: pattern allowed for that section, reducedMotionFallback present
  6. images: assetRole allowed for that section

Usage:  python3 semantic_validate.py <pagespec.json>
Import: check(spec) -> (errors, warnings)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
RULE_KINDS = {"maxCategoryPerPage", "perPageLimits", "mustBeFirst", "mustBeLast", "noConsecutive",
              "noAdjacentSameCategory", "maxAnimatedSections"}


_CACHE = {}


def load(rel):
    # contracts are read once per process: the adversarial suite calls check() hundreds of times
    if rel not in _CACHE:
        with open(os.path.join(REPO, rel), encoding="utf-8") as f:
            _CACHE[rel] = json.load(f)
    return _CACHE[rel]


def words(s):
    return len(str(s).split())


def contracts():
    if "__sections__" in _CACHE:
        return _CACHE["__sections__"]
    out = {}
    d = os.path.join(REPO, "sections")
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            c = json.load(open(os.path.join(d, f), encoding="utf-8"))
            out[c["id"]] = c
    _CACHE["__sections__"] = out
    return out


def validator():
    if "__validator__" not in _CACHE:
        from jsonschema import Draft7Validator
        _CACHE["__validator__"] = Draft7Validator(load("schema/pagespec.schema.json"))
    return _CACHE["__validator__"]


def check(spec):
    errors, warnings = [], []
    # ---- 1. schema
    try:
        v = validator()
    except ImportError:
        return ["jsonschema is required (pip install jsonschema)"], []
    for e in sorted(v.iter_errors(spec), key=lambda e: [str(p) for p in e.absolute_path]):
        loc = "/".join(str(p) for p in e.absolute_path) or "(root)"
        errors.append(f"schema: {loc}: {e.message}")
    if not isinstance(spec, dict) or not isinstance(spec.get("nodes"), list):
        return errors or ["schema: nodes must be a list"], warnings
    nodes = [n for n in spec["nodes"] if isinstance(n, dict)]
    types = [n.get("type") for n in nodes]
    secs = contracts()
    templates = {t["id"]: t for t in load("templates/templates.json")["templates"]}

    # ---- 2. declared template cross-reference
    tid = spec.get("template")
    t = templates.get(tid)
    if t:
        i = 0
        tsecs = [tn["section"] for tn in t["nodes"]]
        for k, tn in enumerate(t["nodes"]):
            cnt = 0
            while i < len(types) and types[i] == tn["section"]:
                cnt += 1; i += 1
            if cnt == 0 and tn.get("required"):
                if tn["section"] in types:
                    errors.append(f"template: section '{tn['section']}' is out of order for {tid} (expected as node {k + 1})")
                else:
                    errors.append(f"template: required section '{tn['section']}' missing (node {k + 1} of {tid})")
            if cnt > 1 and not tn.get("repeatable"):
                errors.append(f"template: section '{tn['section']}' repeated {cnt}x but is not repeatable in {tid}")
            if tn.get("repeatable") and cnt > tn.get("maxCount", cnt):
                errors.append(f"template: section '{tn['section']}' repeated {cnt}x, max {tn['maxCount']} in {tid}")
        for extra in types[i:]:
            if extra in tsecs:
                errors.append(f"template: section '{extra}' is out of order for {tid}")
            else:
                errors.append(f"template: section '{extra}' is not part of template {tid}")
            break

    # ---- 3. compatibility graph (severity-aware)
    cat = {sid: c["category"] for sid, c in secs.items()}
    for rule in load("compatibility/graph.json")["rules"]:
        kind, rid = rule.get("kind"), rule.get("id")
        sink = errors if rule.get("severity") == "error" else warnings
        tag = f"{rid} ({rule.get('severity')})"
        if kind not in RULE_KINDS:
            errors.append(f"graph: rule {rid} has kind '{kind}' that this validator does not implement")
            continue
        if kind == "maxCategoryPerPage":
            n = sum(1 for s in types if cat.get(s) == rule["category"])
            if n > rule["max"] and tid not in rule.get("exceptions", []):
                sink.append(f"{tag}: {n} {rule['category']} sections on one page (max {rule['max']})")
        elif kind == "perPageLimits":
            for s, lim in rule["limits"].items():
                n = types.count(s)
                if n > lim:
                    sink.append(f"{tag}: '{s}' appears {n}x (limit {lim})")
        elif kind == "mustBeFirst":
            for s in rule["sections"]:
                if s in types and types[0] != s:
                    sink.append(f"{tag}: '{s}' must be the first node")
        elif kind == "mustBeLast":
            for s in rule["sections"]:
                if s in types and types[-1] != s:
                    sink.append(f"{tag}: '{s}' must be the last node")
        elif kind == "noConsecutive":
            for a, b in zip(types, types[1:]):
                if a == b and a in rule["sections"]:
                    sink.append(f"{tag}: '{a}' appears twice in a row")
        elif kind == "noAdjacentSameCategory":
            allowed = {tuple(p) for p in rule.get("exceptions", [])}
            for a, b in zip(types, types[1:]):
                if a != b and a in cat and cat.get(a) == cat.get(b) and (a, b) not in allowed:
                    sink.append(f"{tag}: '{a}' and '{b}' are both {cat[a]} and adjacent")
        elif kind == "maxAnimatedSections":
            n = sum(1 for nd in nodes if isinstance(nd.get("motion"), dict) and nd["motion"].get("pattern") not in (None, "none"))
            if n > rule["max"]:
                sink.append(f"{tag}: {n} animated sections (max {rule['max']})")

    # ---- 4-6. per-node content budgets, motion, asset roles
    for k, nd in enumerate(nodes):
        c = secs.get(nd.get("type"))
        if not c:
            continue
        f = c["content"]["fields"]
        content = nd.get("content") if isinstance(nd.get("content"), dict) else {}
        where = f"node {k + 1} ({nd.get('type')})"
        for key in ("heading", "subheading"):
            if key in content and key in f and words(content[key]) > f[key]["maxWords"]:
                errors.append(f"maxWords: {where}.{key} has {words(content[key])} words (max {f[key]['maxWords']})")
        if "body" in content and "body" in f and isinstance(content["body"], list):
            for j, p in enumerate(content["body"]):
                if words(p) > f["body"]["maxWords"]:
                    errors.append(f"maxWords: {where}.body[{j}] has {words(p)} words (max {f['body']['maxWords']})")
        if "ctas" in content and "ctas" in f and isinstance(content["ctas"], list):
            for j, cta in enumerate(content["ctas"]):
                if isinstance(cta, dict) and words(cta.get("label", "")) > f["ctas"]["maxWords"]:
                    errors.append(f"maxWords: {where}.ctas[{j}].label has {words(cta['label'])} words (max {f['ctas']['maxWords']})")
        if "items" in content and "items" in f and isinstance(content["items"], list):
            for j, it in enumerate(content["items"]):
                if not isinstance(it, dict): continue
                if words(it.get("title", "")) > f["items"]["titleMaxWords"]:
                    errors.append(f"maxWords: {where}.items[{j}].title has {words(it['title'])} words (max {f['items']['titleMaxWords']})")
                if "body" in it and words(it["body"]) > f["items"].get("bodyMaxWords", 0):
                    errors.append(f"maxWords: {where}.items[{j}].body has {words(it['body'])} words (max {f['items'].get('bodyMaxWords', 0)})")
        m = nd.get("motion")
        if not isinstance(m, dict) or not m.get("reducedMotionFallback"):
            errors.append(f"motion: {where} has no reducedMotionFallback")
        elif m.get("pattern") not in c["motion"]["allowedPatterns"]:
            errors.append(f"motion: {where} pattern '{m.get('pattern')}' not allowed (allowed: {', '.join(c['motion']['allowedPatterns'])})")
        for j, img in enumerate(content.get("images", []) if isinstance(content.get("images"), list) else []):
            roles = f.get("images", {}).get("assetRoles", [])
            if isinstance(img, dict) and "alt" in img and words(img["alt"]) > 16:
                errors.append(f"maxWords: {where}.images[{j}].alt has {words(img['alt'])} words (max 16)")
            if isinstance(img, dict) and roles and img.get("assetRole") not in roles:
                errors.append(f"assetRole: {where}.images[{j}] role '{img.get('assetRole')}' not used by this section (allowed: {', '.join(roles)})")
    return errors, warnings


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: semantic_validate.py <pagespec.json>")
    errors, warnings = check(json.load(open(sys.argv[1], encoding="utf-8")))
    for w in warnings:
        print("WARN:", w)
    if errors:
        print("INVALID:"); [print("  -", e) for e in errors]; sys.exit(1)
    print("VALID"); sys.exit(0)


if __name__ == "__main__":
    main()
