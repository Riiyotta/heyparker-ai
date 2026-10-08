Source: https://heyparker.ai/

# CLONE_SPEC — Parker

> **Mirror-only package.** No clone has been built from this spec. `public/` is an offline copy of the live site;
> the measured values live in `design-repo/` and are the source of truth. This file is an index into them, not a separate spec.

## Where each measurement lives

| Area | File |
|---|---|
| Colour, typography, spacing, radius, motion tokens | `design-repo/tokens/` (start at `tokens/llm/token-catalog.json`) |
| Layout widths and breakpoints | `design-repo/tokens/30-layout/layout.json`, `design-repo/tokens/00-foundation/breakpoint.json` |
| Section contracts (content budgets, responsive, motion) | `design-repo/sections/*.json` |
| Assets and what may be reused | `asset-manifest.json`, `design-repo/assets/asset-roles.json` |
| Motion and reduced-motion behaviour | `design-repo/motion/motion-contract.json` |

## Routes

### Home — `template.home` (1 route)

Routes: `/`

Sections, in order:

1. `shell.navbar` — see `design-repo/sections/shell.navbar.json`
2. `hero.hero-section` — see `design-repo/sections/hero.hero-section.json`
3. `explainer.how-it-works-section` — see `design-repo/sections/explainer.how-it-works-section.json`
4. `explainer.notification-section` — see `design-repo/sections/explainer.notification-section.json`
5. `content.maze-section` — see `design-repo/sections/content.maze-section.json`
6. `content.ribbon` — see `design-repo/sections/content.ribbon.json`
7. `commerce.pricing-section` — see `design-repo/sections/commerce.pricing-section.json`
8. `proof.testimonials-section` — see `design-repo/sections/proof.testimonials-section.json`
9. `cta.cta-section` — see `design-repo/sections/cta.cta-section.json`
10. `cta.cta-button` — see `design-repo/sections/cta.cta-button.json`
11. `support.framer-ktez73-container` — see `design-repo/sections/support.framer-ktez73-container.json`

### Support pages — `template.support` (3 routes)

Routes: `/support/terms-of-service`, `/support/privacy-policy`, `/support/data-deletion-request`

Sections, in order:

1. `shell.navbar` — see `design-repo/sections/shell.navbar.json`
2. `hero.container` — see `design-repo/sections/hero.container.json`
3. `support.framer-ktez73-container` — see `design-repo/sections/support.framer-ktez73-container.json`
