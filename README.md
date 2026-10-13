# FinHub - Free Finance Calculators

Accurate, instant and free personal-finance calculators - 32 of them, covering
SIP, EMI, mortgages, retirement, FIRE, FD/PPF/RD, GST & India income tax, CAGR,
XIRR/SWP/STP, trading tools and more. A mobile-first, SEO-optimized static
site: every calculator is its own URL with educational content, FAQ and
structured data.

Built with zero front-end dependencies - plain ESM JavaScript, hand-rolled SVG
charts, and a build-time static-site generator.

## What's inside

| Path | Purpose |
| --- | --- |
| `assets/js/engine.js` | Pure calculation engine + single registry of all 17 calculators (fields, formulas, chart models). No duplicated math anywhere. |
| `assets/js/content.js` | SEO copy, formulas, worked examples, FAQs and site/monetization config shared by the build and pages. |
| `assets/js/app.js` | Client hydration: builds forms from the registry, live results, currency/theme, history, year-by-year tables + CSV export, share/copy/print. |
| `assets/js/charts.js` | Dependency-free SVG area/donut/bar renderers. |
| `assets/css/styles.css` | Design system: light/dark themes, responsive layout, print styles, accessibility. |
| `build.js` | Static-site generator -> `dist/` (homepage, 32 SEO pages, sitemap, robots). Unwritten pages get auto-generated generic SEO content. |
| `tests/engine.test.js` + `tests/engine-p3.test.js` | 37 unit tests covering the engine, every calculator default and the newer calculators. |
| `vercel.json` | Vercel config (build command + output folder). |

## Commands

```bash
# Run the calculation engine unit tests (37 tests)
npm test

# Generate the site into dist/
npm run build

# Preview the built site locally
npm run serve          # serves dist/ on http://localhost:4173
```

## Regions & currencies

A currency selector on every page covers India, US, UK, Canada, Australia, UAE
and Singapore (`REGIONS` in `assets/js/engine.js`). Money is formatted with the
correct locale grouping (₹1,00,000 en-IN vs $100,000 en-US); compact display
uses L/Cr for INR and k/M/B/T elsewhere. India-specific tax tools are clearly
labelled as estimates for FY 2024-25, and assumptions are stated on-page so
rules can be updated in one file when they change.

## Deploy

Push this folder to a GitHub repo and import it into Vercel (free tier is
fine). `vercel.json` already sets the build command and output directory. For a
custom domain, add a `SITE_URL` env var so sitemap/canonical URLs point at the
real host. See `LAUNCH.md` for the full non-technical walkthrough.

## Monetization (off by default)

The site ships free and clean. Monetization hooks are scaffolded and disabled:

- **Affiliate/partner cards**: rendered on loan/EMI, mortgage and FD pages when
  enabled, with a disclosure line and `rel="sponsored"` links.
- **FinHub Pro gate**: the retirement, savings-goal and net-worth calculators
  are flagged `premium` in the registry; when enabled they blur behind an
  upgrade upsell.

Flip the flags in `SITE.premium` / `SITE.affiliate` in `assets/js/content.js`,
or build with:

```bash
# Preview the premium gate and partner cards without editing source
PREMIUM_ENABLED=1 AFFILIATE_ENABLED=1 npm run build
```

## Notes

- Figures use INR (en-IN) grouping by default with a USD switch; all formulas
  are documented on each page and reproducible at the stated inputs.
- `smart_confluence_indicator.pine` at the repo root is a separate, finished
  project and is intentionally untouched.
