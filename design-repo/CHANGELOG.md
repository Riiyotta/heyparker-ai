# Changelog

## Unreleased — not yet reconciled with the React clone

The design-repo was generated from the offline mirror. A React clone now exists (`src/`, desktop + mobile variants), but tokens, section
dimensions and contracts have **not** been re-measured against it, and `verify_all` / adversarial / drift were last run against the
mirror-derived contracts only. Reconcile before treating the contracts as describing the clone.

## 0.1.0 — 2026-10-13T05:39:24Z
- Initial extraction from the source site (see extraction/measured-values.json): 15 sections, 2 templates, 4 routes.
- Section categories: SHELL 2, HERO 1, CONTENT 4, EXPLAINER 2, COMMERCE 1, PROOF 1, CTA 2, LEGAL 2 (keyword heuristics; review before production use).
- Asset roles observed: video 3, content-image 1030, font 78, illustration 23, icon 14, logo 1, hero-image 1, founder-contact-email 1, live-embed 4.
- Reduced-motion fallbacks: measured-script 15.
- PROOF sections: example/IR copy is redacted to placeholders (real customer names and quotes are never copied into generator input).
