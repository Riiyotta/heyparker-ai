#!/usr/bin/env python3
"""Validate the composition IR in this folder.

  1. envelope  : <slug>.ir.json against n0-design-repo-composition-ir.schema.json (generic base)
  2. profile   : <slug>.ir.json against <slug>.n0-ir.profile.schema.json (base + consts pinned to registry.manifest.json)
  3. pageSpecs : every pages[].pageSpec against ../design-repo/schema/pagespec.schema.json (strict, repo-native)
                 and the repo's semantic_validate.check() (word counts, observed lengths)
  4. contracts : every designRepo.contracts path exists inside ../design-repo/

Run:  python3 ir/validate_ir.py        (exit 1 on any error)
"""
import glob
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)
try:
    from jsonschema import Draft7Validator, RefResolver
except ImportError:
    sys.exit("jsonschema is required (pip3 install jsonschema)")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.join(ROOT, "design-repo")


def load(p):
    with open(p, encoding="utf8") as f:
        return json.load(f)


def errs(validator, doc):
    return [f"{'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message[:200]}" for e in validator.iter_errors(doc)]


base = load(os.path.join(HERE, "n0-design-repo-composition-ir.schema.json"))
irs = sorted(glob.glob(os.path.join(HERE, "*.ir.json")))
profiles = sorted(glob.glob(os.path.join(HERE, "*.n0-ir.profile.schema.json")))
problems = []
if not irs:
    sys.exit("no *.ir.json found in ir/")
if not profiles:
    sys.exit("no *.n0-ir.profile.schema.json found in ir/")

Draft7Validator.check_schema(base)
base_uri = "file://" + HERE + "/"
store = {base["$id"]: base, base_uri + "n0-design-repo-composition-ir.schema.json": base}
pagespec_schema = load(os.path.join(REPO, "schema", "pagespec.schema.json"))
Draft7Validator.check_schema(pagespec_schema)
pagespec_v = Draft7Validator(pagespec_schema)

sys.path.insert(0, os.path.join(REPO, "schema"))
try:
    import semantic_validate  # the repo's own word-count / observed-length checks (JSON Schema cannot express them)
except Exception:  # noqa: BLE001
    semantic_validate = None

checked = 0
semantic_pages = 0
for ir_path in irs:
    ir = load(ir_path)
    name = os.path.basename(ir_path)
    problems += [f"{name} [envelope] {m}" for m in errs(Draft7Validator(base), ir)]
    for pp in profiles:
        prof = load(pp)
        v = Draft7Validator(prof, resolver=RefResolver(base_uri + os.path.basename(pp), prof, store=store))
        problems += [f"{name} [{os.path.basename(pp)}] {m}" for m in errs(v, ir)]
    for page in ir.get("pages", []):
        problems += [f"{name} [pageSpec {page.get('pageId')}] {m}" for m in errs(pagespec_v, page["pageSpec"])]
        if semantic_validate is not None:
            sem_errors, _warnings = semantic_validate.check(page["pageSpec"])
            problems += [f"{name} [semantic {page.get('pageId')}] {m}" for m in sem_errors]
            semantic_pages += 1
    for key, rel in (ir.get("designRepo", {}).get("contracts") or {}).items():
        if not os.path.exists(os.path.join(REPO, rel)):
            problems.append(f"{name} [contracts] {key}: {rel} does not exist in design-repo/")
    checked += 1

if problems:
    print("\n".join(problems[:40]))
    print(f"IR FAIL: {len(problems)} problem(s)")
    sys.exit(1)
print(f"IR OK: {checked} IR document(s), {sum(len(load(p).get('pages', [])) for p in irs)} page(s): envelope, profile, every pageSpec against the repo's pagespec schema"
      + (f" and semantic checks ({semantic_pages} pages)" if semantic_validate is not None else "") + ", and contract paths all pass.")
