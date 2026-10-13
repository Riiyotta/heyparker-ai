# https://heyparker.ai

Source: https://heyparker.ai · website-builder crawl, 2026-10-13T05:39:24Z
Status: **measured-from-mirror** · production approved: **false**
4 routes · 2 templates · 15 unique sections

> Generated from `ia.json` by `build.mjs`. Edit the JSON, not this file.

## Shape of the site

The largest 2 templates (Support pages, Home) account for 4 of 4 routes (100%). The remaining 0 routes span 0 templates.

| template | routes | share |
|---|---:|---:|
| Support pages | 3 | 75% |
| Home | 1 | 25% |

## Page chrome

**4 routes carry chrome = `full`** — Home, Support pages.

## Sections by reuse

How widely a section is shared determines whether it belongs in a shared
component library or stays local to its page.

| section | category | templates | routes | implementation | scope |
|---|---|---:|---:|---|---|
| `shell.footer` | SHELL | 2 | 4 | `src/sections/ShellFooter.jsx` | Appears on all 4 routes. |
| `shell.navbar` | SHELL | 2 | 4 | `src/sections/ShellNavbar.jsx` | Appears on all 4 routes. |
| `legal.body` | LEGAL | 1 | 3 | `src/sections/LegalBody.jsx` | Appears on 3 routes. |
| `legal.header` | LEGAL | 1 | 3 | `src/sections/LegalHeader.jsx` | Appears on 3 routes. |
| `commerce.pricing-section` | COMMERCE | 1 | 1 | `src/sections/CommercePricingSection.jsx` | Appears on 1 route. |
| `content.brain-section` | CONTENT | 1 | 1 | `src/sections/ContentBrainSection.jsx` | Appears on 1 route. |
| `content.maze-section` | CONTENT | 1 | 1 | `src/sections/ContentMazeSection.jsx` | Appears on 1 route. |
| `content.problem-section` | CONTENT | 1 | 1 | `src/sections/ContentProblemSection.jsx` | Appears on 1 route. |
| `content.ribbon` | CONTENT | 1 | 1 | `src/sections/ContentRibbon.jsx` | Appears on 1 route. |
| `cta.cta-button` | CTA | 1 | 1 | `src/sections/CtaCtaButton.jsx` | Appears on 1 route. |
| `cta.cta-section` | CTA | 1 | 1 | `src/sections/CtaCtaSection.jsx` | Appears on 1 route. |
| `explainer.how-it-works-section` | EXPLAINER | 1 | 1 | `src/sections/ExplainerHowItWorksSection.jsx` | Appears on 1 route. |
| `explainer.notification-section` | EXPLAINER | 1 | 1 | `src/sections/ExplainerNotificationSection.jsx` | Appears on 1 route. |
| `hero.hero-section` | HERO | 1 | 1 | `src/sections/HeroHeroSection.jsx` | Appears on 1 route. |
| `proof.testimonials-section` | PROOF | 1 | 1 | `src/sections/ProofTestimonialsSection.jsx` | Appears on 1 route. |

**2 shared sections** appear in more than one template and belong in a component library.

**13 single-use sections** appear in exactly one template. Building these
as "reusable" components up front would be speculative — keep them page-local
until a second caller actually appears.

## Templates

### Home — `template.home`

1 route · `/` · chrome: **full**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.navbar` | shared ×2 |
| 2 | HERO | `hero.hero-section` | page-local |
| 3 | CONTENT | `content.problem-section` | page-local |
| 4 | EXPLAINER | `explainer.how-it-works-section` | page-local |
| 5 | EXPLAINER | `explainer.notification-section` | page-local |
| 6 | CONTENT | `content.maze-section` | page-local |
| 7 | CONTENT | `content.brain-section` | page-local |
| 8 | CONTENT | `content.ribbon` | page-local |
| 9 | COMMERCE | `commerce.pricing-section` | page-local |
| 10 | PROOF | `proof.testimonials-section` | page-local |
| 11 | CTA | `cta.cta-section` | page-local |
| 12 | CTA | `cta.cta-button` | page-local |
| 13 | SHELL | `shell.footer` | shared ×2 |

### Support pages — `template.support`

3 routes · `/support/terms-of-service`, `/support/privacy-policy`, `/support/data-deletion-request` · chrome: **full**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.navbar` | shared ×2 |
| 2 | LEGAL | `legal.header` | page-local |
| 3 | LEGAL | `legal.body` | page-local |
| 4 | SHELL | `shell.footer` | shared ×2 |

## Section reference

### SHELL

_Site chrome: navigation, header, footer, announcement bars and other elements carried across pages._

**`shell.footer`** — "Footer" — a <footer> block named by its HTML landmark tag; first heading: "Join our newsletter.". Typically 810px tall at 1440px wide.

· Appears on all 4 routes. · appears on 4 routes · implemented by `src/sections/ShellFooter.jsx`

**`shell.navbar`** — "Navbar" — a <div> block named by a data attribute. Typically 86px tall at 1440px wide.

· Appears on all 4 routes. · appears on 4 routes · implemented by `src/sections/ShellNavbar.jsx`

### HERO

_Page-opening block: the main headline (h1) and first call to action._

**`hero.hero-section`** — "Hero Section" — a <div> block named by a data attribute; first heading: "The way you make ads is about to change forever_". Typically 900px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/HeroHeroSection.jsx`

### CONTENT

_The substantive body of a page: articles, listings, resources and general sections._

**`content.brain-section`** — "Brain Section" — a <div> block named by a data attribute; first heading: "What makes". Typically 4500px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ContentBrainSection.jsx`

**`content.maze-section`** — "Maze Section" — a <div> block named by a data attribute; first heading: "Creative st_". Typically 900px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ContentMazeSection.jsx`

**`content.problem-section`** — "Problem Section" — a <div> block named by a data attribute. Typically 2700px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ContentProblemSection.jsx`

**`content.ribbon`** — "Ribbon" — a <div> block named by a data attribute. Typically 80px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ContentRibbon.jsx`

### EXPLAINER

_Scroll-driven or stepwise sections that explain how the product works._

**`explainer.how-it-works-section`** — "How it Works Section" — a <div> block named by a data attribute; first heading: "Parker tell_". Typically 5295px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ExplainerHowItWorksSection.jsx`

**`explainer.notification-section`** — "Notification Section" — a <div> block named by a data attribute; first heading: "Parker works in the background and comes to you with ideas_". Typically 3600px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ExplainerNotificationSection.jsx`

### COMMERCE

_Pricing, plans and purchase decisions._

**`commerce.pricing-section`** — "Pricing Section" — a <div> block named by a data attribute; first heading: "Plans built for". Typically 1976px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/CommercePricingSection.jsx`

### PROOF

_Social proof: customer logos, testimonials, reviews and case studies._

**`proof.testimonials-section`** — "Testimonials Section" — a <div> block named by a data attribute; first heading: "Don't take our". Typically 1296px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/ProofTestimonialsSection.jsx`

### CTA

_Conversion prompts: sign-up, demo, newsletter and get-started bands._

**`cta.cta-button`** — "CTA Button" — a <div> block named by a data attribute. Typically 252px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/CtaCtaButton.jsx`

**`cta.cta-section`** — "CTA Section" — a <div> block named by a data attribute; first heading: "Ready to make". Typically 990px tall at 1440px wide.

· Appears on 1 route. · appears on 1 routes · implemented by `src/sections/CtaCtaSection.jsx`

### LEGAL

_Legal and policy documents (terms, privacy, DPA, cookies, sub-processors): a document header (title, effective date) and the clause body._

**`legal.body`** — "Body" — a <div> block named by its place in a long-form document (header or body). Typically 14139px tall at 1440px wide.

· Appears on 3 routes. · appears on 3 routes · implemented by `src/sections/LegalBody.jsx`

**`legal.header`** — "Header" — a <div> block named by its place in a long-form document (header or body); first heading: "Data Deletion Request". Typically 99px tall at 1440px wide.

· Appears on 3 routes. · appears on 3 routes · implemented by `src/sections/LegalHeader.jsx`
