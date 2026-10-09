# heyparker-ai — Design Repo

Machine-validated design system extracted from a live site, structured per the design-repo BUILD-GUIDE.
Status: **design-review-pending** (`productionApproved: false`). The source is a real, live site: see `assets/asset-roles.json`
for what a generator may and may not reproduce.

## Counts

- Sections: 12
- Templates: 2
- Routes: 4
- Primitives: 11
- Components: 97
- Assets: 1151
- Foundation tokens: 110
- Semantic tokens: 20
- Rules: 7

## Layout

- `tokens/00-foundation → 10-semantic → 20-component → 30-layout → themes`, and `tokens/llm/` (catalog, policy, allowlist)
- `primitives/`, `components/`, `sections/` (one contract per section type), `templates/templates.json` (structured nodes)
- `compatibility/graph.json` (rules with severity), `assets/asset-roles.json`, `motion/motion-contract.json`
- `schema/` (draft-07 PageSpec schema, example, semantic validator, adversarial tests), `extraction/` (citations, admission)

## What is measured vs inferred

Values (colours, sizes, spacing, radii, widths, word counts, line ranges) are measured. Semantic role **names**
(`text.primary`, `surface.alt`…), section **categories**, asset **roles** and section **purposes** are heuristics and are labelled
`basis` / `inferred`. Review them before production use.

## Live-site constraint (`sourceIsLiveSite: true`)

The source is a real, live site. Generated output must **never** reproduce real third-party logos (`customer-logo`, must-not-fabricate),
real people's photos (`avatar`), live contact addresses/embeds (`must-not-reuse-live-endpoint`) or proprietary copy; `logo` is the
site's own mark only. Use explicit placeholders for the rest, and do not publish this repository or its zip without a licence review.

## Examples

`schema/example.pagespec.json` plus one real-copy PageSpec per template in `schema/examples/` (all validated by `verify_all.py`).

## Admit this repo

Requires Python 3 with **`jsonschema`** (`pip3 install jsonschema`). Both scripts validate
against Draft-07 and exit `1` on `ModuleNotFoundError` without it — a missing dependency
reads as a failing suite, not a skipped one.

```
python3 extraction/verify_all.py      # files, entryPoints, counts, parity, citations, pinned policies, schema, adversarial suite
python3 extraction/prove_drift.py     # proves each check fails on injected drift
```
