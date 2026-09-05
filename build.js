/*
  FinHub static site generator
  ----------------------------
  Reads the calculator registry (engine.js) + content (content.js) and emits
  pre-rendered, SEO-ready HTML pages into dist/ that hydrate on the client:
    dist/index.html            - homepage (grouped calculator cards + search)
    dist/<slug>/index.html     - one SEO page per calculator
    dist/sitemap.xml, robots.txt, dist/assets/*
  Run: node build.js   (npm run build)
*/
import { mkdirSync, writeFileSync, cpSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CALC_LIST, CATEGORIES, REGIONS, CURRENCIES } from "./assets/js/engine.js";
import { CONTENT, HOME, SITE } from "./assets/js/content.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dir, "dist");
/* Canonical base: explicit SITE_URL env wins, then Vercel's own URL at build
   time, then the SITE.url fallback (content.js). Keeps sitemap/canonical/og
   pointing at the real deployed host. */
const ROOT = (process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : SITE.url)).replace(/\/$/, "");
const BUILD_DATE = new Date().toISOString().split("T")[0];

/* Monetization knobs: default OFF (content.js). Env flags force them on at
   build time so you can preview the gates without editing source. */
const PREMIUM = Object.assign({ enabled: false, slugs: [], perks: [], upsellTitle: "", upsellBody: "", priceLabel: "", cta: "" }, SITE.premium || {});
PREMIUM.enabled = process.env.PREMIUM_ENABLED === "1" || !!PREMIUM.enabled;
const AFFILIATE = Object.assign({ enabled: false, disclaimer: "", partners: {} }, SITE.affiliate || {});
AFFILIATE.enabled = process.env.AFFILIATE_ENABLED === "1" || !!AFFILIATE.enabled;
const isPremiumCalc = (c) => PREMIUM.enabled && (c.premium || (PREMIUM.slugs || []).includes(c.slug));
const isPremiumSlug = (slug) => PREMIUM.enabled && (PREMIUM.slugs || []).includes(slug);

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}
function monogram(name) {
  const words = name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0].toUpperCase()).join("") || "?";
}

function ld(objs) {
  return objs.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
}

/* ---- shared header/footer ---- */
function favicon() {
  return "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%236366f1'/><text x='32' y='44' font-family='Arial' font-size='34' font-weight='800' fill='white' text-anchor='middle'>F</text></svg>`
  );
}

function siteHeader(active = "") {
  const links = [
    ["/", "All calculators"],
    ["/#investment", "Investing"],
    ["/#loan", "Loans"],
    ["/#retirement", "Retirement"],
    ["/#tax", "Tax & savings"]
  ];
  return `
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/" aria-label="FinHub home"><span class="logo__mark">F</span>FinHub</a>
      <nav class="nav-links" aria-label="Primary">${links.map(([href, t]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <span class="nav-spacer"></span>
      <button type="button" class="icon-btn" data-theme-toggle aria-label="Switch theme" title="Toggle dark / light mode">&#9680;</button>
    </div>
  </header>`;
}

function siteFooter() {
  const popular = ["sip", "emi-loan", "cagr", "compound-interest", "retirement", "fd"];
  const cats = Object.entries(CATEGORIES);
  const popularC = CALC_LIST.filter((c) => popular.includes(c.slug));
  return `
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-cols">
        <div>
          <a class="logo" href="/"><span class="logo__mark">F</span>FinHub</a>
          <p style="color:var(--muted);font-size:.9rem;max-width:26rem;margin:10px 0 0">Accurate, free and transparent finance calculators for investing, loans, retirement, savings and trading - built on published formulas with charts you can understand.</p>
        </div>
        <div>
          <h4>Popular calculators</h4>
          <ul>${popularC.map((c) => `<li><a href="/${c.slug}/">${esc(c.name)}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>Browse by topic</h4>
          <ul>${cats.map(([k, label]) => `<li><a href="/#${esc(k)}">${esc(label)}</a></li>`).join("")}</ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>FinHub provides educational estimates for personal finance planning. Nothing here is financial, investment or tax advice. Figures are projections at the assumptions you choose and may not reflect actual returns or tax rules.</p>
        <p>&copy; ${new Date().getFullYear()} FinHub Tools. All rights reserved.</p>
      </div>
    </div>
  </footer>`;
}

function pageShell({ title, desc, canonical, body, ldObjs = [], active = "" }) {
  const head = `
<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#6366f1">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${favicon()}">
${ld(ldObjs)}
<link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${siteHeader(active)}
<main id="main">
${body}
</main>
${siteFooter()}
<script type="module" src="/assets/js/app.js"></script>
</body>
</html>`;
  return head;
}

/* ============================ HOME ============================ */
function homeCards() {
  const pop = CALC_LIST.filter((c) => c.popular);
  const rest = CALC_LIST.filter((c) => !c.popular);
  const catOrder = Object.keys(CATEGORIES);

  function cardHTML(c) {
    const cc = CONTENT[c.slug];
    const tagline = cc ? cc.metaDesc.slice(0, 120) : "";
    const tags = `${c.slug.replace(/-/g, " ")} ${c.name} ${(CATEGORIES[c.category] || "").toLowerCase()}`;
    const key = esc(c.slug.replace(/[^a-z0-9]/g, "_"));
    return `
    <a class="calc-card" data-calc-card data-name="${esc(c.name)}" data-desc="${esc(tagline)}" data-tags="${esc(tags)}" href="/${c.slug}/">
      <div class="calc-card__top">
        <span class="calc-card__icon" aria-hidden="true">${monogram(c.name)}</span>
        <span class="calc-card__tag">${esc(CATEGORIES[c.category] || "")}</span>
      </div>
      <h3 class="calc-card__name">${esc(c.name)}</h3>
      <p class="calc-card__desc">${esc(tagline)}${tagline.length >= 120 ? "\u2026" : ""}</p>
      <div class="calc-card__footer">
        <span class="calc-card__cta">Open calculator</span>
        ${isPremiumCalc(c) ? '<span class="badge-pro">Pro</span>' : ""}
        ${c.popular ? '<span class="badge-pop">Popular</span>' : ""}
      </div>
    </a>`;
  }

  function groupHTML(title, note, list, id) {
    if (!list.length) return "";
    return `
    <section class="group" data-calc-group${id ? ` id="${esc(id)}"` : ""}>
      <h2>${esc(title)}</h2>
      ${note ? `<p class="group__note">${esc(note)}</p>` : ""}
      <div class="grid-cards">${list.map(cardHTML).join("")}</div>
    </section>`;
  }

  let out = "";
  out += `<div class="container hero">`;
  out += `<span class="eyebrow">${esc(HOME.popularNote)}</span>`;
  out += `<h1>${esc(HOME.heroTitle)}</h1>`;
  out += `<p>${esc(HOME.heroSub)}</p>`;
  out += `</div>`;
  out += `<div class="container"><div class="search"><input data-home-search type="search" placeholder="Search calculators - SIP, EMI, CAGR, retirement, GST\u2026" aria-label="Search calculators"></div>`;
  out += `<p class="group__note" data-search-empty hidden>No calculators match your search. Try "SIP", "loan" or "tax".</p></div>`;
  out += `<div class="container">`;
  out += groupHTML("Popular right now", "The calculators most people reach for first.", pop, "popular");
  catOrder.forEach((cat) => {
    const inCat = rest.filter((c) => c.category === cat);
    if (inCat.length) out += groupHTML(CATEGORIES[cat], null, inCat, cat);
  });
  out += `</div>`;
  return out;
}

function homeLD() {
  const itemList = CALC_LIST.map((c, i) => ({
    "@type": "ListItem", position: i + 1, name: c.name, url: `${ROOT}/${c.slug}/`
  }));
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: ROOT + "/", description: HOME.metaDesc },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Finance calculators", itemListElement: itemList }
  ];
}

/* Auto-generated SEO content for calculators without hand-written CONTENT
   entries (kept generic + factual; hand-written copy always wins). */
function genericContent(c) {
  const catLabel = (CATEGORIES[c.category] || "Finance").toLowerCase().replace(/s$/, "").replace(/&/g, "and");
  const base = `${c.name} - free, instant and transparent.`;
  const metaDesc = `Free ${c.name.toLowerCase()} for ${catLabel}. Enter your inputs to see the main result instantly, with supporting numbers and a chart. Educational estimate - not advice.`.slice(0, 158);
  const siblings = CALC_LIST.filter((x) => x.category === c.category && x.slug !== c.slug).slice(0, 3).map((x) => x.slug);
  const fieldNames = (c.fields || []).map((f) => f.label).join(", ");
  const title = c.name.length + 3 <= 68 ? `${c.name} - Free & Instant` : c.name;
  return {
    seoTitle: title,
    metaDesc,
    intro: [
      `The ${c.name.toLowerCase()} uses standard published formulas and your own assumptions - nothing is hidden, nothing is hard-coded to flatter a number. Change any input and every result updates instantly.`,
      `Fields such as ${fieldNames ? fieldNames + " - " : ""}drive the calculation. Adjust them to your situation, then read the headline result, the supporting numbers and the chart.`
    ],
    formula: "Every calculator on FinHub states the exact formula used in the note beneath its results.",
    steps: [
      "Enter your inputs (or keep the sensible defaults).",
      "Read the headline result at the top of the results panel.",
      "Use the chart and related calculators to explore what-if scenarios."
    ],
    example: `Try the defaults first: they are realistic starting points. Change one input at a time to see its effect, then use Share or Copy to save your scenario.`,
    faqs: [
      { q: `Is the ${c.name.toLowerCase()} free?`, a: "Yes - every calculator on FinHub is free, with no sign-up. Results update instantly as you change your inputs." },
      { q: "How accurate is this?", a: "It applies standard formulas to the assumptions you enter and rounds only for display. It is an estimate for planning, not a guarantee or professional advice." },
      { q: "What do my inputs mean?", a: `Each field is labelled; hover or read the label text for the unit. ${fieldNames ? "This calculator uses: " + fieldNames + "." : "Use the default values as a starting point."}` }
    ],
    related: siblings
  };
}

function buildHome() {
  const canonical = `${ROOT}/`;
  const goals = [
    ["sip", "I want to know what my monthly SIP can grow to"],
    ["retirement", "I want to know how much to save to retire"],
    ["emi-loan", "I want to know my EMI for a loan"],
    ["swp", "I want steady income from my investments"],
    ["fire", "I want to know when I could be financially independent"],
    ["net-worth", "I want my total assets minus my debts"]
  ];
  const body = `
  ${homeCards()}
  <section class="recent" data-recent-section hidden aria-label="Recently viewed calculators">
    <div class="container">
      <h2>Recently viewed</h2>
      <ul class="recent-chips" data-recent></ul>
    </div>
  </section>
  <div class="container">
    <section class="helper" aria-labelledby="helper-title">
      <div>
        <h2 id="helper-title">Not sure which calculator you need?</h2>
        <p>Pick the goal that sounds most like yours - we will open the right tool.</p>
      </div>
      <form class="helper-form" data-helper-form>
        <select data-helper-goal aria-label="Pick your goal">
          <option value="">Choose a goal\u2026</option>
          ${goals.map(([slug, label]) => `<option value="${slug}">${esc(label)}</option>`).join("")}
        </select>
        <button type="submit" class="btn btn--primary">Open calculator</button>
      </form>
    </section>
    <div class="ad-slot">Advertisement - your brand could be here</div>
    <section class="newsletter" aria-label="Newsletter signup">
      <h3>One money tip, every Sunday</h3>
      <p>Join subscribers who get a short, actionable finance insight each week. No spam, unsubscribe anytime.</p>
      <form onsubmit="event.preventDefault();this.querySelector('input').value='Thanks - check your inbox!';">
        <input type="email" required placeholder="you@example.com" aria-label="Email address">
        <button type="submit">Subscribe</button>
      </form>
    </section>
  </div>`;
  const html = pageShell({
    title: HOME.seoTitle, desc: HOME.metaDesc, canonical, ldObjs: homeLD(), active: "/", body
  });
  write(join(DIST, "index.html"), html);
}

/* ========================= CALC PAGE ========================= */
function buildCalcPage(c) {
  const cc = CONTENT[c.slug] || genericContent(c);
  const catLabel = CATEGORIES[c.category] || "Finance";
  const canonical = `${ROOT}/${c.slug}/`;
  const rel = (slug) => {
    const other = CALC_LIST.find((x) => x.slug === slug);
    return other ? `<a href="/${other.slug}/">${esc(other.name)}</a>` : "";
  };
  const relatedHTML = (cc && cc.related ? cc.related : []).filter((s) => CALC_LIST.some((x) => x.slug === s))
    .map((s) => `<li>${rel(s)}</li>`).join("");

  const jsonLD = [];
  if (cc) {
    jsonLD.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: cc.seoTitle,
      description: cc.metaDesc,
      url: canonical,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      author: { "@type": "Organization", name: SITE.org }
    });
    jsonLD.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: (cc.faqs || []).map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a }
      }))
    });
  }
  jsonLD.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: ROOT + "/" },
      { "@type": "ListItem", position: 2, name: c.name, item: canonical }
    ]
  });

  const faqHTML = (cc && cc.faqs || []).map((f) => `
    <details class="faq-item">
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join("");

  const premiumHTML = isPremiumCalc(c) ? `
    <section class="premium-upsell" aria-label="FinHub Pro upgrade" data-premium-upsell>
      <span class="badge-pro badge-pro--lg">${esc(PREMIUM.name || "FinHub Pro")}</span>
      <h2>${esc(PREMIUM.upsellTitle || "Unlock advanced planning")}</h2>
      <p>${esc(PREMIUM.upsellBody || "")}</p>
      <ul class="premium-upsell__perks">${(PREMIUM.perks || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      <p class="premium-upsell__price">${esc(PREMIUM.priceLabel || "")}</p>
      <button type="button" class="btn btn--primary" data-pro-cta>${esc(PREMIUM.cta || "Get FinHub Pro")}</button>
    </section>` : "";

  const affiliateHTML = () => {
    if (!AFFILIATE.enabled) return "";
    const list = (AFFILIATE.partners && AFFILIATE.partners[c.slug]) || [];
    if (!list.length) return "";
    const cards = list.map((p) => `
      <div class="partner-card">
        <div class="partner-card__text">
          <strong>${esc(p.name || "")}</strong>
          ${p.note ? `<p>${esc(p.note)}</p>` : ""}
        </div>
        <a class="btn btn--ghost" rel="sponsored noopener" href="${esc(p.url || "#")}" target="_blank">${esc(p.cta || "Visit")}</a>
      </div>`).join("");
    return `
    <section class="edu__section" aria-label="Compare offers">
      <h3>Compare offers</h3>
      <div class="partner-cards">${cards}</div>
      ${AFFILIATE.disclaimer ? `<p class="partner-disclosure">${esc(AFFILIATE.disclaimer)}</p>` : ""}
    </section>`;
  };

  const body = `
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(c.name)}</span>
    </nav>
    <section class="page-hero">
      <span class="eyebrow">${esc(catLabel)}</span>
      <h1>${esc(c.name)}</h1>
      <p>${cc ? esc(cc.metaDesc) : ""}</p>
    </section>

    <div class="calc-grid">
      <section class="card calc-form-card" aria-labelledby="form-title">
        <h2 id="form-title">Your inputs</h2>
        <div data-app-form aria-live="polite"></div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-reset>Reset defaults</button>
          <button type="button" class="btn btn--ghost" data-history-toggle aria-expanded="false">History</button>
        </div>
        <div class="card history-panel" data-history hidden aria-label="Saved calculations">
          <div data-app-history></div>
        </div>
      </section>

      <section class="card results-card" aria-labelledby="results-title">
        <h2 id="results-title" class="sr-only">Results</h2>
        <div class="toolbar">
          <label class="sr-only" for="currency-select">Display currency</label>
          <select id="currency-select" class="currency-sel" data-currency aria-label="Display currency">
            ${REGIONS.map((r) => `<option value="${r.currency}">${(CURRENCIES[r.currency] || {}).symbol || r.currency} ${r.currency} \u00B7 ${esc(r.name)}</option>`).join("")}
          </select>
          <span class="spacer"></span>
          <button type="button" class="tool-btn" data-share title="Share a link with these numbers">Share</button>
          <button type="button" class="tool-btn" data-copy title="Copy a text summary">Copy</button>
          <button type="button" class="tool-btn" data-csv title="Download the results table as CSV">CSV</button>
          <button type="button" class="tool-btn" data-print title="Print this result">Print</button>
        </div>
        ${premiumHTML}
        <div data-app-head></div>
        <div data-app-stats></div>
        <div data-app-charts></div>
        <div data-app-table></div>
        <p class="note" data-app-note aria-live="polite"></p>
        <div class="ad-slot">Advertisement</div>
      </section>
    </div>

    <div class="edu">
      <h2>How the ${esc(c.name)} works</h2>
      ${(cc ? cc.intro : []).map((p) => `<p>${esc(p)}</p>`).join("")}

      <section class="edu__section">
        <h3>The formula behind it</h3>
        <div class="formula-box">${esc(cc ? cc.formula : "")}</div>
      </section>

      <section class="edu__section">
        <h3>How to use it - step by step</h3>
        <ol>${(cc ? cc.steps : []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      </section>

      <section class="edu__section">
        <h3>Worked example</h3>
        <div class="example-box"><strong>Example:</strong> ${esc(cc ? cc.example : "")}</div>
      </section>

      <section class="edu__section">
        <h3>Related calculators</h3>
        <ul class="related-list">${relatedHTML}</ul>
      </section>

      <section class="edu__section">
        <h3>Frequently asked questions</h3>
        <div class="faq-list">${faqHTML}</div>
      </section>

      ${affiliateHTML()}

      <div class="disclosure">
        <span class="disclosure__mark" aria-hidden="true">i</span>
        <p>FinHub is an educational tool, not a financial adviser. Results are estimates based on the assumptions you enter and standard formulas; they do not guarantee outcomes, returns or tax treatment, and should not replace professional advice before you invest or borrow. All figures update instantly as you change your inputs.</p>
      </div>
    </div>
  </div>
  <script>window.FINHUB_PAGE = ${JSON.stringify({ type: "calc", slug: c.slug, premium: isPremiumCalc(c) })};</script>`;

  const html = pageShell({
    title: cc ? cc.seoTitle : c.name,
    desc: cc ? cc.metaDesc : "",
    canonical,
    ldObjs: jsonLD,
    body
  });
  write(join(DIST, c.slug, "index.html"), html);
}

/* ========================= sitemap / robots ========================= */
function buildSeoFiles() {
  const urls = [`${ROOT}/`].concat(CALC_LIST.map((c) => `${ROOT}/${c.slug}/`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n")}
</urlset>
`;
  write(join(DIST, "sitemap.xml"), xml);
  write(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${ROOT}/sitemap.xml\n`);
}

/* ========================= main ========================= */
console.log("Copying static assets\u2026");
cpSync(join(__dir, "assets"), join(DIST, "assets"), { recursive: true });

console.log("Building homepage\u2026");
buildHome();

console.log("Building calculator pages\u2026");
for (const c of CALC_LIST) {
  if (!CONTENT[c.slug]) { console.warn("  missing content for", c.slug); }
  buildCalcPage(c);
}

console.log("Writing sitemap + robots\u2026");
buildSeoFiles();

console.log("Done. Output in dist/ -", CALC_LIST.length, "calculator pages + homepage.");
