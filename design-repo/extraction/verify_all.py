#!/usr/bin/env python3
"""Admission check for this design repo. Exit 0 = admitted.

  1  required files exist and parse
  2  manifest fields; entryPoints relative, inside design-repo/ (no ../), present
  3  allowlistVersion matches the allowlist (machine-checked version field)
  4  counts recomputed from the files on disk (manifest AND README)
  5  allowlist parity: sections/components/primitives files <-> allowlist, nodeProperties <-> schema
  6  schema parity: template/section/assetRole enums and content definitions match the contracts
  7  templates: every node has a contract; routes assigned exactly once; coverage matches the ledger
  8  constraints + graph recomputed from templates (a rule in prose and in code must agree)
  9  citations: every path:line-line resolves, is in range, and the cited line holds the cited tag
     (degrades to a warning when the sibling src/ snapshot tree is absent)
 10  tokens: every {reference} resolves; theme resolves every semantic token to the recomputed value;
     catalog ids exist; policy categories match catalog keys
 11  assets: closed role vocabulary; PINNED roles hold their exact policy; files exist (warn if no public/)
 12  motion closed to the contract's fields; section patterns inside the contract
 13  no absolute machine paths in any JSON/MD file
 14  schema is valid draft-07; example validates with zero errors; adversarial suite passes
 15  zip hygiene, only if someone creates ../design-repo.zip by hand (the builder does not produce one)

Drift-proofing lives in extraction/prove_drift.py (injects each defect into a scratch copy).
"""
import importlib.util, json, os, re, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PKG = os.path.dirname(REPO)
errs, warns = [], []
# Pinned generation policies. Kept HERE, independent of assets/asset-roles.json, so that changing a
# role in the registry to a different-but-still-valid policy is caught (membership alone is not enough).
PINNED = {"logo": "must-reuse-exact", "customer-logo": "must-not-fabricate", "avatar": "must-not-fabricate",
          "font": "must-reuse-exact", "live-embed": "must-not-reuse-live-endpoint",
          "founder-contact-email": "must-not-reuse-live-endpoint"}
REQUIRED = ["registry.manifest.json", "README.md", "CHANGELOG.md",
            "tokens/llm/token-catalog.json", "tokens/llm/token-policy.json", "tokens/llm/component-allowlist.json",
            "templates/templates.json", "compatibility/graph.json", "assets/asset-roles.json", "motion/motion-contract.json",
            "schema/pagespec.schema.json", "schema/example.pagespec.json", "schema/semantic_validate.py",
            "schema/tests/adversarial_test.py", "extraction/measured-values.json", "extraction/prove_drift.py"]
ENTRY_KEYS = ["tokenCatalog", "tokenPolicy", "componentAllowlist", "compatibilityGraph", "assetContract", "motionContract",
              "templates", "pagespecSchema", "examplePageSpec", "semanticValidate", "adversarialSuite", "admission",
              "driftProof", "measuredValues", "defaultTheme"]


def J(rel):
    with open(os.path.join(REPO, rel), encoding="utf-8") as f:
        return json.load(f)


def files_in(d, ext=".json"):
    p = os.path.join(REPO, d)
    return sorted(f for f in os.listdir(p) if f.endswith(ext)) if os.path.isdir(p) else []


def tokens_in(tier):
    out = {}
    for f in files_in(os.path.join("tokens", tier)):
        out.update(J(os.path.join("tokens", tier, f)).get("tokens", {}))
    return out


def main():
    # 1
    for rel in REQUIRED:
        p = os.path.join(REPO, rel)
        if not os.path.exists(p): errs.append(f"missing: {rel}")
        elif rel.endswith(".json"):
            try: J(rel)
            except Exception as e: errs.append(f"bad json {rel}: {e}")
    for d in ("tokens/00-foundation", "tokens/10-semantic", "tokens/20-component", "tokens/30-layout", "sections", "primitives", "components"):
        if not os.path.isdir(os.path.join(REPO, d)): errs.append(f"missing folder: {d}/")
    if errs: return finish()
    man = J("registry.manifest.json")
    allow = J("tokens/llm/component-allowlist.json")
    schema = J("schema/pagespec.schema.json")
    templates = J("templates/templates.json")["templates"]
    graph = J("compatibility/graph.json")
    assets = J("assets/asset-roles.json")
    ledger = J("extraction/measured-values.json")
    secs = {}
    for f in files_in("sections"):
        c = J(f"sections/{f}")
        if c.get("id") + ".json" != f: errs.append(f"sections/{f}: id '{c.get('id')}' does not match its file name")
        secs[c["id"]] = c

    # 2
    for k in ("repositoryId", "status", "productionApproved", "defaultTheme", "schemaValidatedThemes", "allowlistVersion", "versionFieldNote", "counts", "entryPoints"):
        if k not in man: errs.append(f"manifest: missing field {k}")
    eps = man.get("entryPoints", {})
    for k in ENTRY_KEYS:
        if k not in eps: errs.append(f"entryPoints.{k} is not wired in")
    for k, v in eps.items():
        if not isinstance(v, str) or os.path.isabs(v) or v.startswith("..") or "/../" in v or re.match(r"^[A-Za-z]:", v):
            errs.append(f"entryPoints.{k} must be a relative path inside design-repo/, got {v!r}")
        elif not os.path.exists(os.path.join(REPO, v)):
            errs.append(f"entryPoints.{k} points at a missing file: {v}")

    # 3
    if man.get("allowlistVersion") != allow.get("version"):
        errs.append(f"allowlistVersion drift: manifest {man.get('allowlistVersion')!r} vs allowlist {allow.get('version')!r}")

    # 4
    F, S, L = tokens_in("00-foundation"), tokens_in("10-semantic"), tokens_in("30-layout")
    C = {}  # component tokens share prop names across files, so namespace them: button.background
    for f in files_in("tokens/20-component"):
        d = J(f"tokens/20-component/{f}")
        C.update({f"{d['component']}.{k}": v for k, v in d.get("tokens", {}).items()})
    comp_tokens = len(C)
    actual = {"sections": len(secs), "templates": len(templates), "routes": sum(t["routeCount"] for t in templates),
              "primitives": len(files_in("primitives")), "components": len(files_in("components")), "assets": len(assets.get("assets", [])),
              "themes": len(files_in("tokens/themes")), "rules": len(graph.get("rules", [])),
              "tokens": {"foundation": len(F), "semantic": len(S), "component": comp_tokens, "layout": len(L)}}
    mc = man.get("counts", {})
    for k, v in actual.items():
        if mc.get(k) != v: errs.append(f"manifest counts.{k} = {mc.get(k)} but the files give {v}")
    readme = open(os.path.join(REPO, "README.md"), encoding="utf-8").read()
    for label, v in [("Sections", actual["sections"]), ("Templates", actual["templates"]), ("Routes", actual["routes"]),
                     ("Primitives", actual["primitives"]), ("Components", actual["components"]), ("Assets", actual["assets"]),
                     ("Foundation tokens", len(F)), ("Semantic tokens", len(S)), ("Rules", actual["rules"])]:
        m = re.search(rf"^- {label}: (\d+)$", readme, re.M)
        if not m or int(m.group(1)) != v: errs.append(f"README count '{label}' is {m.group(1) if m else 'missing'} but the files give {v}")

    # 5
    for key, found in [("sections", sorted(secs)), ("primitives", [f[:-5] for f in files_in("primitives")]), ("components", [f[:-5] for f in files_in("components")])]:
        a = set(allow.get(key, []))
        for x in sorted(a - set(found)): errs.append(f"allowlist parity: '{x}' in allowlist.{key} has no contract file")
        for x in sorted(set(found) - a): errs.append(f"allowlist parity: {key}/{x}.json has no allowlist entry")
    node_props = set(schema["definitions"]["node"]["properties"])
    if set(allow.get("nodeProperties", [])) != node_props:
        errs.append(f"allowlist.nodeProperties {sorted(allow.get('nodeProperties', []))} != schema node properties {sorted(node_props)}")
    for sid, c in secs.items():
        if sorted(allow.get("contentFields", {}).get(sid, [])) != sorted(c["content"]["fields"]):
            errs.append(f"allowlist.contentFields['{sid}'] differs from sections/{sid}.json")

    # 6
    if sorted(schema["properties"]["template"]["enum"]) != sorted(t["id"] for t in templates): errs.append("schema template enum differs from templates.json")
    if sorted(schema["definitions"]["node"]["properties"]["type"]["enum"]) != sorted(secs): errs.append("schema node type enum differs from sections/")
    if sorted(schema["definitions"]["assetRole"]["enum"]) != sorted(assets["roles"]): errs.append("schema assetRole enum differs from assets/asset-roles.json roles")
    for sid, c in secs.items():
        d = schema["definitions"].get(f"content.{sid}")
        if not d: errs.append(f"schema has no content definition for {sid}"); continue
        if d.get("additionalProperties") is not False: errs.append(f"schema content.{sid} is not closed (additionalProperties must be false)")
        if sorted(d["properties"]) != sorted(c["content"]["fields"]): errs.append(f"schema content.{sid} fields differ from the section contract")

    # 7
    seen = {}
    ledger_routes = [r["route"] for r in ledger["routes"]]
    for t in templates:
        for n in t["nodes"]:
            if n["section"] not in secs: errs.append(f"template {t['id']} node '{n['section']}' has no section contract")
            for k in ("section", "required", "repeatable"):
                if k not in n: errs.append(f"template {t['id']} node is missing '{k}' (nodes must be structured objects)")
    for r in ledger["routes"]:
        if r["route"] in seen: errs.append(f"route {r['route']} assigned twice")
        seen[r["route"]] = r["template"]
        if r["template"] not in {t["id"] for t in templates}: errs.append(f"route {r['route']} maps to unknown template {r['template']}")
    if sum(t["routeCount"] for t in templates) != len(ledger_routes): errs.append("sum of template routeCount differs from the measured route list")
    for t in templates:
        n = sum(1 for r in ledger["routes"] if r["template"] == t["id"])
        if n != t["routeCount"]: errs.append(f"template {t['id']}: routeCount {t['routeCount']} but {n} measured routes map to it")
        for r in t.get("routes", []):
            if seen.get(r) != t["id"]: errs.append(f"template {t['id']} lists route {r} that the ledger maps elsewhere")
        listed = t.get("routes", [])
        if t.get("routesTruncated"): errs.append(f"template {t['id']}: routesTruncated is set; every route must be listed so the 1:1 route-to-template map is checkable from design-repo/ alone")
        want = sorted(r["route"] for r in ledger["routes"] if r["template"] == t["id"])
        if sorted(listed) != want: errs.append(f"template {t['id']}: routes list ({len(listed)}) is not exactly the ledger's routes for it ({len(want)})")
        seq = [n["section"] for n in t["nodes"]]
        for r in ledger["routes"]:
            if r["template"] == t["id"]:
                ids = [s["id"] for s in r["sections"]]
                collapsed = [x for i, x in enumerate(ids) if i == 0 or ids[i - 1] != x]
                if collapsed != seq: errs.append(f"route {r['route']}: measured section sequence differs from template {t['id']}"); break

    # 8
    for sid, c in secs.items():
        tm = [t for t in templates if any(n["section"] == sid for n in t["nodes"])]
        mx = max((sum((n.get("maxCount", 1) if n["repeatable"] else 1) for n in t["nodes"] if n["section"] == sid) for t in tm), default=0)
        cons = c["constraints"]
        if (cons.get("onePerPage") and mx != 1) or (not cons.get("onePerPage") and cons.get("maxPerPage") != mx):
            errs.append(f"sections/{sid}.json constraints disagree with templates (observed max per page {mx})")
        first = c["category"] == "SHELL" and tm and all(t["nodes"][0]["section"] == sid for t in tm)
        last = c["category"] == "SHELL" and tm and all(t["nodes"][-1]["section"] == sid for t in tm)
        if bool(cons.get("mustBeFirst")) != bool(first): errs.append(f"sections/{sid}.json mustBeFirst disagrees with templates")
        if bool(cons.get("mustBeLast")) != bool(last): errs.append(f"sections/{sid}.json mustBeLast disagrees with templates")
    rules = {r["id"]: r for r in graph["rules"]}
    sv = load_validator()
    # Every template ships one real-copy PageSpec example that the real semantic validator accepts.
    exdir = os.path.join(REPO, "schema", "examples")
    for t in templates:
        ep = os.path.join(exdir, t["id"] + ".pagespec.json")
        if not os.path.isfile(ep): errs.append(f"schema/examples/{t['id']}.pagespec.json is missing: every template needs a real-copy example"); continue
        espec = json.load(open(ep, encoding="utf-8"))
        if espec.get("template") != t["id"]: errs.append(f"schema/examples/{t['id']}.pagespec.json declares template {espec.get('template')!r}")
        if espec.get("route") not in t.get("routes", []): errs.append(f"schema/examples/{t['id']}.pagespec.json route {espec.get('route')!r} is not a route of {t['id']}")
        ee, _ = sv.check(espec)
        for e in ee: errs.append(f"schema/examples/{t['id']}.pagespec.json: {e}")
    for r in graph["rules"]:
        if r.get("severity") not in ("error", "warn"): errs.append(f"graph rule {r['id']} has no valid severity")
        if r.get("kind") not in sv.RULE_KINDS: errs.append(f"graph rule {r['id']} kind '{r.get('kind')}' is not implemented by semantic_validate.py")
    lim = rules.get("SECTION_PER_PAGE_LIMITS", {}).get("limits", {})
    for sid, c in secs.items():
        want = 1 if c["constraints"].get("onePerPage") else c["constraints"].get("maxPerPage")
        if lim.get(sid) != want: errs.append(f"graph SECTION_PER_PAGE_LIMITS['{sid}'] = {lim.get(sid)} but the contract says {want}")
    for rid, key in (("SHELL_MUST_BE_FIRST", "mustBeFirst"), ("SHELL_MUST_BE_LAST", "mustBeLast"), ("NO_CONSECUTIVE_SAME_SECTION", "noConsecutive")):
        if sorted(rules.get(rid, {}).get("sections", [])) != sorted(s for s, c in secs.items() if c["constraints"].get(key)):
            errs.append(f"graph {rid} disagrees with the section contracts' {key}")
    hero_ex = sorted(t["id"] for t in templates if sum(1 for n in t["nodes"] if secs.get(n["section"], {}).get("category") == "HERO") > 1)
    if sorted(rules.get("ONE_HERO_PER_PAGE", {}).get("exceptions", [])) != hero_ex:
        errs.append(f"graph ONE_HERO_PER_PAGE exceptions {rules.get('ONE_HERO_PER_PAGE', {}).get('exceptions')} but templates give {hero_ex}")

    # 9
    src = os.path.join(PKG, "src")
    ledger_at = {}  # "file:start-end" -> ledger entry (the ONE element that range belongs to)
    for r in ledger["routes"]:
        for s_ in r["sections"]:
            if s_.get("lines"):
                ledger_at[f"{r['file']}:{s_['lines'][0]}-{s_['lines'][1]}"] = dict(s_, file=r["file"])
    for sid, c in secs.items():  # a contract may only cite ranges the ledger attributes to THIS section
        for cite in c["evidence"].get("measuredFrom", []):
            e = ledger_at.get(cite)
            if not e: errs.append(f"citation {cite} in sections/{sid}.json is not a measured section range")
            elif e["id"] != sid: errs.append(f"citation {cite} in sections/{sid}.json points at '{e['id']}', not '{sid}'")
    if not os.path.isdir(src):
        warns.append(f"no sibling src/ snapshot tree — {len(ledger_at)} citations not resolved against files (expected when design-repo/ is shipped alone)")
    else:
        cache = {}
        for cite, e in ledger_at.items():
            m = re.match(r"^(.+):(\d+)-(\d+)$", cite)
            p, a, b = os.path.join(PKG, m.group(1)), int(m.group(2)), int(m.group(3))
            if p not in cache:
                cache[p] = open(p, encoding="utf-8", errors="ignore").read().split("\n") if os.path.isfile(p) else None
            lines = cache[p]
            if lines is None: errs.append(f"citation {cite}: file does not exist"); continue
            if not (1 <= a <= b <= len(lines)): errs.append(f"citation {cite}: range exceeds the file ({len(lines)} lines)"); continue
            line = lines[a - 1]
            if f"<{e['tag']}" not in line: errs.append(f"citation {cite}: line {a} does not contain the cited <{e['tag']}> element")
            elif e.get("anchor") and e["anchor"] not in line: errs.append(f"citation {cite}: line {a} does not contain the cited element's {e['anchor']!r}")

    # 10
    known = set(F) | set(S) | set(L) | set(C)
    def refs(v):
        if isinstance(v, dict): return [x for vv in v.values() for x in refs(vv)]
        return re.findall(r"^\{(.+)\}$", v) if isinstance(v, str) else []
    for tier, toks in (("10-semantic", S), ("20-component", C), ("30-layout", L)):
        for tid, t in toks.items():
            for ref in refs(t.get("$value")):
                if ref not in known: errs.append(f"tokens/{tier}: {tid} references unknown token {{{ref}}}")
    allvals = {k: v.get("$value") for d in (F, S, L) for k, v in d.items()}
    def resolve(v, depth=0):
        if isinstance(v, dict): return {k: resolve(x, depth) for k, x in v.items()}
        m = re.match(r"^\{(.+)\}$", v) if isinstance(v, str) else None
        return resolve(allvals.get(m.group(1), v), depth + 1) if m and depth < 5 else v
    # the served (default) theme is named in the manifest: it must resolve every semantic token to the recomputed value
    tfile = (man.get("theme") or {}).get("file") or f"tokens/themes/{man.get('defaultTheme', 'light')}.json"
    tid = (man.get("theme") or {}).get("id") or man.get("defaultTheme", "light")
    if not os.path.isfile(os.path.join(REPO, tfile)): errs.append(f"default theme file {tfile} is missing"); theme = {}
    else: theme = J(tfile)["resolves"]
    if man.get("defaultTheme") != tid: errs.append(f"manifest defaultTheme {man.get('defaultTheme')!r} differs from theme.id {tid!r}")
    for sid, t in S.items():
        if sid not in theme: errs.append(f"theme {tid} does not resolve semantic token {sid}")
        elif resolve(t["$value"]) != theme[sid]: errs.append(f"theme {tid}: {sid} resolves to {theme[sid]!r} but the tokens give {resolve(t['$value'])!r}")
    for sid in theme:
        if sid not in S: errs.append(f"theme {tid} resolves unknown token {sid}")
    # alternate (partial) themes: measured colour roles only; every key must be a real semantic token
    for alt in man.get("alternateThemes", []):
        if not os.path.isfile(os.path.join(REPO, alt["file"])): errs.append(f"alternate theme file {alt['file']} is missing"); continue
        for sid in J(alt["file"]).get("resolves", {}):
            if sid not in S: errs.append(f"alternate theme {alt['id']} resolves unknown token {sid}")
    cat = J("tokens/llm/token-catalog.json")["categories"]
    comp_ids = set(C)
    for k, ids in cat.items():
        for i in ids:
            if i not in S and i not in L and i not in comp_ids: errs.append(f"token-catalog.{k}: '{i}' is not a real token")
    pol = J("tokens/llm/token-policy.json")
    if sorted(pol.get("rawValueRestrictions", {})) != sorted(cat): errs.append(f"token-policy rawValueRestrictions keys {sorted(pol.get('rawValueRestrictions', {}))} do not match catalog categories {sorted(cat)}")

    # 11
    roles = assets["roles"]; policies = set(assets["generationPolicies"])
    for r, v in roles.items():
        if v["generationPolicy"] not in policies: errs.append(f"asset role {r}: policy '{v['generationPolicy']}' is not in generationPolicies")
    for r, want in PINNED.items():
        if r not in roles: errs.append(f"pinned asset role '{r}' is missing from the registry")
        elif roles[r]["generationPolicy"] != want or not roles[r].get("pinned"): errs.append(f"pinned asset role '{r}' must be '{want}' (pinned), found '{roles[r]['generationPolicy']}'")
    pub = os.path.join(PKG, "public")
    # Some asset entries are not a file under public/ at all (e.g. a mailto: contact address) — real
    # evidence worth a pinned contract, but nothing to resolve on disk.
    is_virtual = lambda a: ":" in a["path"].split("/")[0] and not re.match(r"^[A-Za-z]:\\", a["path"])
    for a in assets["assets"]:
        if a["role"] not in roles: errs.append(f"asset {a['path']}: role '{a['role']}' is not in the closed role set")
    if os.path.isdir(pub):
        for a in assets["assets"]:
            if is_virtual(a): continue
            p = os.path.join(pub, a["path"])
            if not os.path.isfile(p): errs.append(f"asset missing on disk: public/{a['path']}")
    else:
        warns.append("no sibling public/ mirror — asset files not checked")
    for sid, c in secs.items():
        for r in c.get("assetRoles", []):
            if r not in roles: errs.append(f"sections/{sid}.json uses unknown asset role '{r}'")
    # 'logo' is the site's OWN brand mark (must-reuse-exact). Third-party marks are 'customer-logo' (must-not-fabricate).
    # Generic rule (no per-site list): a PROOF section, or a file under a brand-logos/customer/partner/client path,
    # can never be filed under the own-brand 'logo' role.
    THIRD = re.compile(r"brand-logos?/|customer|partner|client", re.I)
    for sid, c in secs.items():
        if "logo" in c.get("assetRoles", []) and c.get("category") == "PROOF":
            errs.append(f"sections/{sid}.json is PROOF but allows asset role 'logo' (own brand mark); third-party marks must use 'customer-logo'")
    for a in assets["assets"]:
        if a["role"] != "logo": continue
        sec = secs.get(a.get("evidence", {}).get("section"), {})
        if sec.get("category") == "PROOF" or THIRD.search(a["path"]):
            errs.append(f"asset {a['path']}: role 'logo' (own brand mark) on a third-party mark; use 'customer-logo'")

    # 12
    mot = schema["definitions"]["motion"]; mc_ = J("motion/motion-contract.json")
    if mot.get("additionalProperties") is not False: errs.append("schema motion object is not closed")
    if sorted(mot["properties"]) != sorted(mc_["closedFields"]): errs.append("schema motion fields differ from motion-contract closedFields")
    if sorted(mot["properties"]["pattern"]["enum"]) != sorted(mc_["patterns"]): errs.append("schema motion patterns differ from motion-contract patterns")
    for sid, c in secs.items():
        for p in c["motion"]["allowedPatterns"]:
            if p not in mc_["patterns"]: errs.append(f"sections/{sid}.json motion pattern '{p}' is not in the motion contract")

    # 13  machine paths: every JSON string VALUE that starts with one (site routes like "/home/about" are not paths)
    leak = re.compile(r"^(/Users/|/home/[^/]+/|/private/|/var/folders/|/tmp/|[A-Za-z]:\\\\)")
    md_leak = re.compile(r"(?:^|[\s`(\"'])(/Users/|/home/[^/\s]+/|/private/|/var/folders/|/tmp/|[A-Za-z]:\\\\)", re.M)
    ROUTE_KEYS = {"route", "routes", "sampleRoute", "routePattern"}
    def walk(v, key=None):
        if isinstance(v, dict):
            for k, x in v.items(): yield from walk(x, k)
        elif isinstance(v, list):
            for x in v: yield from walk(x, key)
        elif isinstance(v, str) and key not in ROUTE_KEYS:
            m = leak.match(v)
            if m: yield m.group(1)
    for root, _, fs in os.walk(REPO):
        for f in fs:
            p = os.path.join(root, f); rel = os.path.relpath(p, REPO)
            if f.endswith(".json"):
                hit = next(walk(json.load(open(p, encoding="utf-8"))), None)
                if hit: errs.append(f"absolute path in {rel}: {hit}")
            elif f.endswith(".md"):
                m = md_leak.search(open(p, encoding="utf-8", errors="ignore").read())
                if m: errs.append(f"absolute path in {rel}: {m.group(1)}")
            elif f.endswith(".py") and re.search(r"^(REPO|ROOT|HERE)\s*=\s*['\"]/", open(p, encoding="utf-8").read(), re.M):
                errs.append(f"hard-coded root path in {rel}")

    # 14
    from jsonschema import Draft7Validator
    try: Draft7Validator.check_schema(schema)
    except Exception as e: errs.append(f"pagespec.schema.json is not valid draft-07: {e}")
    e1, w1 = sv.check(J("schema/example.pagespec.json"))
    for e in e1: errs.append(f"example.pagespec.json: {e}")
    if os.environ.get("VERIFY_SKIP_ADVERSARIAL") != "1":  # prove_drift.py sets this: its injections target the checks above
        r = subprocess.run([sys.executable, os.path.join(REPO, "schema/tests/adversarial_test.py")], capture_output=True, text=True)
        last = (r.stdout.strip().splitlines() or ["(no output)"])[-1]
        if r.returncode: errs.append("adversarial suite failed:\n      " + (r.stdout + r.stderr).strip().replace("\n", "\n      "))
        else: print("  " + last)

    # 15
    z = os.path.join(PKG, "design-repo.zip")
    if os.path.isfile(z):
        names = zipfile.ZipFile(z).namelist()
        junk = [n for n in names if "__MACOSX" in n or n.endswith(".DS_Store")]
        if junk: errs.append(f"design-repo.zip contains {len(junk)} __MACOSX/.DS_Store entries")
        zt = os.path.getmtime(z)
        newer = [os.path.relpath(os.path.join(rt, f), REPO) for rt, _, fs in os.walk(REPO) for f in fs if os.path.getmtime(os.path.join(rt, f)) > zt + 1 and "__pycache__" not in rt]
        if newer: errs.append(f"design-repo.zip is stale: {len(newer)} file(s) changed after it was built (e.g. {newer[0]})")
    return finish()


def load_validator():
    spec = importlib.util.spec_from_file_location("semantic_validate", os.path.join(REPO, "schema/semantic_validate.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


def finish():
    for w in warns: print("WARN:", w)
    if errs:
        print("REPO NOT ADMITTED:"); [print("  -", e) for e in errs]; sys.exit(1)
    print("REPO OK — structure, entryPoints, versions, counts, parity, templates, graph, citations, tokens, pinned assets, motion, paths, schema and adversarial suite all pass.")
    sys.exit(0)


if __name__ == "__main__":
    main()
