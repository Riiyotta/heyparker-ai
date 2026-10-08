# https://heyparker.ai/

Source: https://heyparker.ai/ · website-builder crawl, 2026-10-07T19:26:48Z
Status: **measured-from-mirror** · production approved: **false**
4 routes · 2 templates · 12 unique sections

> Generated from `ia.json` by `build.mjs`. Edit the JSON, not this file.

## Shape of the site

The largest 2 templates (Support pages, Home) account for 4 of 4 routes (100%). The remaining 0 routes span 0 templates.

| template | routes | share |
|---|---:|---:|
| Support pages | 3 | 75% |
| Home | 1 | 25% |

## Page chrome

**4 routes carry chrome = `partial`** — Home, Support pages.

## Sections by reuse

How widely a section is shared determines whether it belongs in a shared
component library or stays local to its page.

| section | category | templates | routes | scope |
|---|---|---:|---:|---|
| `shell.navbar` | SHELL | 2 | 4 | Appears on all 4 routes. |
| `support.framer-ktez73-container` | SUPPORT | 2 | 4 | Appears on all 4 routes. |
| `hero.container` | HERO | 1 | 3 | Appears on 3 routes. |
| `commerce.pricing-section` | COMMERCE | 1 | 1 | Appears on 1 route. |
| `content.maze-section` | CONTENT | 1 | 1 | Appears on 1 route. |
| `content.ribbon` | CONTENT | 1 | 1 | Appears on 1 route. |
| `cta.cta-button` | CTA | 1 | 1 | Appears on 1 route. |
| `cta.cta-section` | CTA | 1 | 1 | Appears on 1 route. |
| `explainer.how-it-works-section` | EXPLAINER | 1 | 1 | Appears on 1 route. |
| `explainer.notification-section` | EXPLAINER | 1 | 1 | Appears on 1 route. |
| `hero.hero-section` | HERO | 1 | 1 | Appears on 1 route. |
| `proof.testimonials-section` | PROOF | 1 | 1 | Appears on 1 route. |

**2 shared sections** appear in more than one template and belong in a component library.

**10 single-use sections** appear in exactly one template. Building these
as "reusable" components up front would be speculative — keep them page-local
until a second caller actually appears.

## Templates

### Home — `template.home`

1 route · `/` · chrome: **partial**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.navbar` | shared ×2 |
| 2 | HERO | `hero.hero-section` | page-local |
| 3 | EXPLAINER | `explainer.how-it-works-section` | page-local |
| 4 | EXPLAINER | `explainer.notification-section` | page-local |
| 5 | CONTENT | `content.maze-section` | page-local |
| 6 | CONTENT | `content.ribbon` | page-local |
| 7 | COMMERCE | `commerce.pricing-section` | page-local |
| 8 | PROOF | `proof.testimonials-section` | page-local |
| 9 | CTA | `cta.cta-section` | page-local |
| 10 | CTA | `cta.cta-button` | page-local |
| 11 | SUPPORT | `support.framer-ktez73-container` | shared ×2 |

### Support pages — `template.support`

3 routes · `/support/terms-of-service`, `/support/privacy-policy`, `/support/data-deletion-request` · chrome: **partial**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.navbar` | shared ×2 |
| 2 | HERO | `hero.container` | page-local |
| 3 | SUPPORT | `support.framer-ktez73-container` | shared ×2 |

## Section reference

### SHELL

_Site chrome: navigation, header, footer, announcement bars and other elements carried across pages._

**`shell.navbar`** — "Navbar" — a <div> block named by a data attribute. Typically 86px tall at 1440px wide.

· Appears on all 4 routes. · appears on 4 routes

### HERO

_Page-opening block: the main headline (h1) and first call to action._

**`hero.container`** — "Container" — a <div> block named by a data attribute; first heading: "Data Deletion Request". Typically 14298px tall at 1440px wide.

· Appears on 3 routes. · appears on 3 routes

**`hero.hero-section`** — "Hero Section" — a <div> block named by a data attribute; first heading: "The way you make ads is about to change forever_". Typically 4959px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

### EXPLAINER

_Scroll-driven or stepwise sections that explain how the product works._

**`explainer.how-it-works-section`** — "How it Works Section" — a <div> block named by a data attribute; first heading: "Parker tel_". Typically 5295px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

**`explainer.notification-section`** — "Notification Section" — a <div> block named by a data attribute; first heading: "Parker works in the background and comes to you with ideas_". Typically 3600px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

### CONTENT

_The substantive body of a page: articles, listings, resources and general sections._

**`content.maze-section`** — "Maze Section" — a <div> block named by a data attribute; first heading: "Creative s_". Typically 7200px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

**`content.ribbon`** — "Ribbon" — a <div> block named by a data attribute. Typically 80px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

### COMMERCE

_Pricing, plans and purchase decisions._

**`commerce.pricing-section`** — "Pricing Section" — a <div> block named by a data attribute; first heading: "Plans built for". Typically 1976px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

### PROOF

_Social proof: customer logos, testimonials, reviews and case studies._

**`proof.testimonials-section`** — "Testimonials Section" — a <div> block named by a data attribute; first heading: "Don't take our". Typically 1296px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

### CTA

_Conversion prompts: sign-up, demo, newsletter and get-started bands._

**`cta.cta-button`** — "CTA Button" — a <div> block named by a data attribute. Typically 252px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

**`cta.cta-section`** — "CTA Section" — a <div> block named by a data attribute; first heading: "Ready to make". Typically 990px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes

### SUPPORT

_Questions and contact: FAQs, help, forms._

**`support.framer-ktez73-container`** — "framer-ktez73-container" — a <div> block named by its CSS class; first heading: "Join our newsletter.". Typically 810px tall at 1440px wide.

· Appears on all 4 routes. · appears on 4 routes
