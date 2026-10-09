# Changelog

## Unreleased — fix: literal "undefined" in two section purposes

- `explainer.how-it-works-section` and `explainer.notification-section` had purposes starting with the literal text
  `undefined` (the extractor had no purpose phrase for the EXPLAINER category). Replaced with real purpose sentences.

## 0.1.0 — 2026-10-07T19:26:48Z
- Initial extraction from the source site (see extraction/measured-values.json): 12 sections, 2 templates, 4 routes.
- Section categories: SHELL 1, HERO 2, EXPLAINER 2, CONTENT 2, COMMERCE 1, PROOF 1, CTA 2, SUPPORT 1 (keyword heuristics; review before production use).
- Asset roles observed: video 3, content-image 1029, font 78, illustration 23, icon 14, logo 1, hero-image 2, founder-contact-email 1, live-embed 4.
- Reduced-motion fallbacks: measured-script 12.
- PROOF sections: example/IR copy is redacted to placeholders (real customer names and quotes are never copied into generator input).
