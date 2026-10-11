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
import { CALC_LIST, CATEGORIES, REGIONS, CURRENCIES, TOOLS, getTool, nextSteps, fmtMoney, fmtCompactMoney, projectPlan, requiredMonthly, inflate, solveStepUp, retirementPlan } from "./assets/js/engine.js";
import { CONTENT, TOOL_CONTENT, PROBLEMS, HOME, SITE, PAGES } from "./assets/js/content.js";
import { BRAND } from "./assets/js/brand.js";

const BRAND_MARK = BRAND.logoMark || monogram(BRAND.name);
const ACCENT = (BRAND.theme && BRAND.theme.accent) || "#6366f1";
const ACCENT2 = (BRAND.theme && BRAND.theme.accent2) || "#16a34a";

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dir, "dist");
/* Canonical base. Priority:
   1. SITE_URL env (explicit override, e.g. a custom domain)
   2. VERCEL_PROJECT_PRODUCTION_URL (Vercel's STABLE production domain)
   3. VERCEL_URL (per-deployment URL - previews only, changes every build)
   4. SITE.url from content.js (local/other hosts)
   Using the stable production domain keeps sitemap/canonical/og consistent
   across deployments instead of pointing at an ephemeral preview host. */
const ROOT = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : SITE.url)
).replace(/\/$/, "");
const BUILD_DATE = new Date().toISOString().split("T")[0];

/* Monetization knobs: default OFF (content.js). Env flags force them on at
   build time so you can preview the gates without editing source. */
const PREMIUM = Object.assign({ enabled: false, slugs: [], perks: [], upsellTitle: "", upsellBody: "", priceLabel: "", cta: "" }, SITE.premium || {});
PREMIUM.enabled = process.env.PREMIUM_ENABLED === "1" || !!PREMIUM.enabled;
const AFFILIATE = Object.assign({ enabled: false, disclaimer: "", partners: {} }, SITE.affiliate || {});
AFFILIATE.enabled = process.env.AFFILIATE_ENABLED === "1" || !!AFFILIATE.enabled;
const ADS = Object.assign({ enabled: false, slotLabel: "Advertisement", slots: [] }, SITE.ads || {});
ADS.enabled = process.env.ADS_ENABLED === "1" || !!ADS.enabled;
const adSlot = (slot) => (ADS.enabled && (!ADS.slots.length || ADS.slots.includes(slot))
  ? `\n        <div class="ad-slot" role="complementary" aria-label="${esc(ADS.slotLabel)}">${esc(ADS.slotLabel)}</div>`
  : "");
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
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${ACCENT}'/><text x='32' y='44' font-family='Arial' font-size='34' font-weight='800' fill='white' text-anchor='middle'>${esc(BRAND_MARK)}</text></svg>`
  );
}

function siteHeader(active = "") {
  const links = [
    ["/", "Home"],
    ["/#calculators", "Calculators"],
    ["/dashboard/", "Plan"],
    ["/my-plans/", "My plans"]
  ];
  return `
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/" aria-label="${esc(BRAND.name)} home"><span class="logo__mark">${esc(BRAND_MARK)}</span>${esc(BRAND.name)}</a>
      <nav class="nav-links" aria-label="Primary">${links.map(([href, t]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <span class="nav-spacer"></span>
      <button type="button" class="icon-btn" data-theme-toggle aria-label="Switch theme" title="Toggle dark / light mode">&#9680;</button>
    </div>
  </header>`;
}

/* "Where to go next" journey block, shared by calculator + tool pages. */
function journeysHTML(slug) {
  const steps = nextSteps(slug);
  if (!steps.length) return "";
  return `
      <section class="edu__section" aria-labelledby="next-title">
        <h3 id="next-title">Where to go next</h3>
        <ul class="journey-list">
          ${steps.map((s) => `<li><a href="/${s.slug}/"><strong>${esc(s.name)}</strong><span>${esc(s.why)}</span></a></li>`).join("")}
        </ul>
      </section>`;
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
          <a class="logo" href="/"><span class="logo__mark">${esc(BRAND_MARK)}</span>${esc(BRAND.name)}</a>
          <p style="color:var(--muted);font-size:.9rem;max-width:26rem;margin:10px 0 0">${esc(BRAND.footerBlurb)}</p>
        </div>
        <div>
          <h4>Plan &amp; decide</h4>
          <ul>${TOOLS.map((t) => `<li><a href="/${t.slug}/">${esc(t.label || t.name)}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>Answers</h4>
          <ul>${ANSWER_PAGES.map((a) => `<li><a href="/${a.slug}/">${esc(a.h1)}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>Popular calculators</h4>
          <ul>${popularC.map((c) => `<li><a href="/${c.slug}/">${esc(c.name)}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>Browse by topic</h4>
          <ul>${cats.map(([k, label]) => `<li><a href="/#${esc(k)}">${esc(label)}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about/">About</a></li>
            <li><a href="/how-it-works/">How it works</a></li>
            <li><a href="/privacy/">Privacy</a></li>
            <li><a href="/terms/">Terms</a></li>
            <li><a href="/sell/">For advisers</a></li>
          </ul>
        </div>
      </div>
      <p class="footer-adviser"><a href="/sell/">Are you an adviser or creator? Get this whole platform branded for your clients &rarr;</a></p>
      <div class="footer-bottom">
        <p>${esc(BRAND.name)} ${esc(BRAND.footerDisclaimer)}</p>
        <p>&copy; ${new Date().getFullYear()} ${esc(BRAND.org)}. All rights reserved.</p>
      </div>
    </div>
  </footer>`;
}

function pageShell({ title, desc, canonical, body, ldObjs = [], active = "", noindex = false }) {
  const head = `
<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ""}
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${esc(ACCENT)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${favicon()}">
${SITE.verification && SITE.verification.google ? `<meta name="google-site-verification" content="${esc(SITE.verification.google)}">` : ""}
${SITE.verification && SITE.verification.bing ? `<meta name="msvalidate.01" content="${esc(SITE.verification.bing)}">` : ""}
${ld(ldObjs)}
<link rel="stylesheet" href="/assets/css/styles.css">
${(ACCENT !== "#6366f1" || ACCENT2 !== "#16a34a") ? `<style>:root{--accent:${esc(ACCENT)};--accent-2:${esc(ACCENT2)}}</style>` : ""}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<p class="print-brand"><span class="print-brand__mark">${esc(BRAND_MARK)}</span> ${esc(BRAND.name)}</p>
${siteHeader(active)}
<main id="main">
${body}
</main>
${siteFooter()}
<script>window.FINHUB_LEADS = ${JSON.stringify({ endpoint: (SITE.leads && SITE.leads.newsletterEndpoint) || "", email: (BRAND.sales && BRAND.sales.contactEmail) || "", whatsapp: (BRAND.sales && BRAND.sales.contactWhatsapp) || "" })};</script>
${SITE.analytics && SITE.analytics.plausibleDomain ? `<script defer data-domain="${esc(SITE.analytics.plausibleDomain)}" src="https://plausible.io/js/script.js"></script>` : ""}
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

  let out = `<div class="container" id="calculators"><h2>Explore all ${CALC_LIST.length} calculators</h2><p class="group__note">Investing, loans, retirement, savings, tax and trading - every one free, with the formula shown.</p></div>`;
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

function heroHTML() {
  return `
  <div class="container hero hero--home">
    <span class="eyebrow">${esc(HOME.popularNote)}</span>
    <h1>${esc(HOME.heroTitle)}</h1>
    <p>${esc(HOME.heroSub)}</p>
  </div>`;
}

function intentsSection() {
  return `
  <section class="container intents" aria-labelledby="intents-title">
    <h2 id="intents-title">What do you want to figure out?</h2>
    <p class="group__note">Pick one and we will open the right calculator - you can always change your mind.</p>
    <div class="intent-grid">
      ${PROBLEMS.map((p) => `<a class="intent-card" href="/${esc(p.to)}/">
        <span class="intent-card__title">${esc(p.title)}</span>
        <span class="intent-card__desc">${esc(p.desc)}</span>
        <span class="intent-card__cta">Show me &rarr;</span>
      </a>`).join("")}
    </div>
  </section>`;
}

/* "Ask FinHub": free-text question -> ranked calculator/planner links.
   The ranking is done client-side by engine.askIntent(). */
function askSection() {
  const examples = [
    "How much SIP to reach 1 crore?",
    "When can I retire?",
    "Home loan EMI for 40 lakh",
    "How big should my emergency fund be?",
    "What will 50000 a month become in 20 years?",
    "How much tax will I pay?"
  ];
  return `
  <section class="container ask" aria-labelledby="ask-title">
    <h2 id="ask-title">Not sure what you need? Ask in your own words</h2>
    <p class="group__note">Type a question and we will open the calculator or planner that answers it. No sign-up, nothing is stored.</p>
    <form class="ask-form" data-ask-form novalidate>
      <label class="sr-only" for="ask-input">Ask a money question</label>
      <input id="ask-input" class="ask-form__input" type="text" data-ask-input autocomplete="off"
        placeholder="e.g. how much SIP to reach 1 crore, when can I retire, home loan EMI" />
      <button type="submit" class="btn btn--primary">Find the right tool</button>
    </form>
    <div class="ask-chips" data-ask-chips aria-label="Example questions">
      ${examples.map((q) => `<button type="button" class="ask-chip" data-ask-example="${esc(q)}">${esc(q)}</button>`).join("")}
    </div>
    <div class="ask-results" data-ask-results role="status" aria-live="polite" hidden></div>
  </section>`;
}

/* "Start with your numbers" - the advisor moment. Seven plain numbers turn
   into the handful of things people actually want to know. Computed live in
   the browser by engine.financialSnapshot(); nothing is sent anywhere. */
function snapshotSection() {
  const fields = [
    ["age", "Your age", 30],
    ["income", "Monthly income", 80000],
    ["expenses", "Monthly expenses", 55000],
    ["cash", "Cash / emergency savings", 120000],
    ["investments", "Current investments", 400000],
    ["debt", "Total debt", 300000],
    ["debtPayment", "Monthly loan payments", 12000]
  ];
  return `
  <section class="container snapshot" id="where-you-stand" aria-labelledby="snapshot-title">
    <h2 id="snapshot-title">Or start with your numbers</h2>
    <p class="group__note">Seven quick numbers and we will show you what stands out. Nothing leaves your device and there is no sign-up.</p>
    <form class="snapshot-form" data-snapshot-form novalidate>
      <div class="snapshot-grid">
        ${fields.map(([name, label, def]) => `
        <label class="snapshot-field">
          <span class="snapshot-field__label">${esc(label)}</span>
          <input type="number" min="0" step="any" inputmode="numeric" name="${name}" data-snapshot-input="${name}" value="${def}" aria-label="${esc(label)}">
        </label>`).join("")}
      </div>
      <div class="snapshot-actions">
        <button type="submit" class="btn btn--primary">Show me what stands out</button>
        <button type="button" class="btn btn--ghost" data-snapshot-clear>Clear</button>
        <span class="snapshot-status" data-snapshot-status role="status"></span>
      </div>
    </form>
    <div class="snapshot-results" data-snapshot-results hidden></div>
  </section>`;
}

function toolsSection() {
  return `
  <section class="container tools-strip" aria-labelledby="tools-title">
    <h2 id="tools-title">More ways to plan &amp; decide</h2>
    <p class="group__note">Each planner starts from your numbers and ends with an action you can take.</p>
    <div class="grid-cards">
      ${TOOLS.filter((t) => t.slug !== "my-plans").map((t) => `<a class="calc-card calc-card--tool" href="/${esc(t.slug)}/">
        <div class="calc-card__top">
          <span class="calc-card__icon" aria-hidden="true">${monogram(t.name)}</span>
          <span class="calc-card__tag">Planner</span>
        </div>
        <h3 class="calc-card__name">${esc(t.label || t.name)}</h3>
        <p class="calc-card__desc">${esc(t.blurb || t.tagline)}</p>
        <div class="calc-card__footer"><span class="calc-card__cta">Open planner</span></div>
      </a>`).join("")}
    </div>
  </section>`;
}

function answersSection() {
  return `
  <section class="container tools-strip" aria-labelledby="answers-title">
    <h2 id="answers-title">Quick answers</h2>
    <p class="group__note">Questions like yours, answered with real numbers - no sign-up, no fluff.</p>
    <div class="grid-cards">
      ${ANSWER_PAGES.slice(0, 6).map((a) => `<a class="calc-card calc-card--tool" href="/${esc(a.slug)}/">
        <div class="calc-card__top">
          <span class="calc-card__icon" aria-hidden="true">?</span>
          <span class="calc-card__tag">Answer</span>
        </div>
        <h3 class="calc-card__name">${esc(a.h1)}</h3>
        <p class="calc-card__desc">${esc(a.metaDesc.slice(0, 120))}${a.metaDesc.length > 120 ? "\u2026" : ""}</p>
        <div class="calc-card__footer"><span class="calc-card__cta">Read the answer</span></div>
      </a>`).join("")}
    </div>
  </section>`;
}

function homeLD() {
  const itemList = CALC_LIST.map((c, i) => ({
    "@type": "ListItem", position: i + 1, name: c.name, url: `${ROOT}/${c.slug}/`
  }));
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: ROOT + "/", description: HOME.metaDesc },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Finance calculators", itemListElement: itemList },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Decision tools", itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: `${ROOT}/${t.slug}/` })) }
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
  const body = `
  ${heroHTML()}
  ${intentsSection()}
  ${askSection()}
  ${snapshotSection()}
  ${answersSection()}
${adSlot("home-mid")}
  ${toolsSection()}
  ${homeCards()}
  <section class="recent" data-recent-section hidden aria-label="Recently viewed calculators">
    <div class="container">
      <h2>Recently viewed</h2>
      <ul class="recent-chips" data-recent></ul>
    </div>
  </section>
  <div class="container">
    <section class="newsletter" aria-label="Newsletter signup">
      <h3>One money tip, every Sunday</h3>
      <p>Join subscribers who get a short, actionable finance insight each week. No spam, unsubscribe anytime.</p>
      <form class="lead-form" data-lead-form data-lead-kind="newsletter" novalidate>
        <input type="email" required placeholder="you@example.com" aria-label="Email address" data-lead-email>
        <button type="submit">Subscribe</button>
        <span class="lead-form__status" data-lead-status role="status" aria-live="polite"></span>
      </form>
    </section>
  </div>
  <script>window.FINHUB_PAGE = ${JSON.stringify({ type: "home" })};</script>`;
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
${adSlot("calculator-result")}
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
${journeysHTML(c.slug)}

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

/* =================== ANSWER / HIGH-INTENT PAGES ===================
   Server-rendered answers to the questions people actually search for.
   Tables are computed at build time so the page is useful (and indexable)
   without JavaScript, then hand the visitor to the matching tool. */
function answerTable({ caption, columns, rows, note }) {
  return `
    <div class="answer-table-wrap">
      <table class="answer-table">
        <caption>${esc(caption)}</caption>
        <thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      ${note ? `<p class="answer-table__note">${esc(note)}</p>` : ""}
    </div>`;
}

function answerLink(slug) {
  const c = CALC_LIST.find((x) => x.slug === slug);
  const t = TOOLS.find((x) => x.slug === slug);
  const a = ANSWER_PAGES.find((x) => x.slug === slug);
  const m = c || t || a;
  const name = m ? (m.name || m.h1) : "";
  return m ? `<a href="/${m.slug}/">${esc(name)}</a>` : "";
}

const HORIZONS = [5, 10, 15, 20, 25, 30];

const ANSWER_PAGES = [
  {
    slug: "how-much-sip-for-1-crore",
    h1: "How much SIP do you need for \u20B91 crore?",
    seoTitle: "How Much SIP for \u20B91 Crore? Monthly SIP Table for 10-14% Returns",
    metaDesc: "See the monthly SIP needed to reach \u20B91 crore in 10 to 30 years at 10%, 12% and 14% returns, plus how to read the numbers and plan the goal properly.",
    intro: [
      "Reaching \u20B91 crore with a monthly SIP depends on two things you control - how long you invest and the return you actually earn - and one you do not: how markets behave. The table below solves the standard SIP future-value formula for the monthly amount needed at different horizons and return assumptions.",
      "Treat \u20B91 crore as a nominal target. Because prices rise, a crore in 25 years buys far less than a crore today; if the goal is a real one, plan against its inflated value with the goal planner."
    ],
    build() {
      const returns = [10, 12, 14];
      const cols = ["Expected return", ...HORIZONS.map((y) => `${y} years`)];
      const rows = returns.map((r) => [`${r}%`, ...HORIZONS.map((y) => fmtMoney(requiredMonthly(1e7, y * 12, r)))]);
      const investRows = [10, 12, 14].map((r) => {
        const p = projectPlan({ monthly: requiredMonthly(1e7, 20 * 12, r), years: 20, returnPct: r });
        return [`${r}%`, fmtMoney(p.invested), fmtMoney(Math.round(p.final))];
      });
      return {
        sections: [
          { h2: "Monthly SIP needed to reach \u20B91 crore", paras: ["Amounts are rounded to the nearest rupee and assume the SIP is invested at the start of each month (annuity-due)."], table: { caption: "Required monthly SIP for a \u20B91 crore corpus", columns: cols, rows } },
          { h2: "What that looks like at a 20-year horizon", paras: ["A longer horizon does more of the work than a higher return - that is why starting early matters more than chasing the best fund."], table: { caption: "20-year plan at the required monthly amount", columns: ["Assumed return", "Total you invest", "Projected corpus"], rows: investRows } }
        ]
      };
    },
    faqs: [
      { q: "Is \u20B91 crore enough after inflation?", a: "Often not. At 6% inflation, \u20B91 crore in 20 years is worth roughly \u20B931 lakh in today's money. Plan against the inflated goal with the goal planner." },
      { q: "What return should I assume?", a: "Use a conservative long-run figure - many planners use 10-12% for equity-heavy portfolios and lower for short or debt goals. Higher assumptions make the required SIP look smaller, which is precisely the risk." },
      { q: "Can I start smaller and increase later?", a: "Yes. A step-up SIP raises your contribution each year and can reach the same target from a lower starting amount. Model it in the goal planner or the what-if lab." }
    ],
    cta: { href: "/goal-planner/", label: "Plan your crore goal", text: "Turn the number into an inflation-aware plan with a required monthly amount and costed strategies." },
    related: ["sip", "goal-planner", "what-if-lab"]
  },
  {
    slug: "how-much-will-5000-sip-become",
    h1: "How much will a \u20B95,000 monthly SIP become?",
    seoTitle: "\u20B95,000 SIP Returns: What It Grows To in 5-30 Years",
    metaDesc: "See what a \u20B95,000 monthly SIP grows to over 5, 10, 15, 20, 25 and 30 years at 8%, 10% and 12% returns, and how much of it is growth.",
    intro: [
      "A \u20B95,000 monthly SIP is a common, realistic starting point. What it becomes is driven almost entirely by time: the same contribution left invested for 30 years can end with several times the corpus of one stopped at 15.",
      "The tables below show the projected corpus at different returns and horizons, then separate your own money from the growth it earns."
    ],
    build() {
      const returns = [8, 10, 12];
      const cols = ["Expected return", ...HORIZONS.map((y) => `${y} years`)];
      const rows = returns.map((r) => [`${r}%`, ...HORIZONS.map((y) => fmtCompactMoney(projectPlan({ monthly: 5000, years: y, returnPct: r }).final))]);
      const splitRows = HORIZONS.map((y) => {
        const p = projectPlan({ monthly: 5000, years: y, returnPct: 12 });
        return [`${y} years`, fmtCompactMoney(p.invested), fmtCompactMoney(p.gains), fmtCompactMoney(p.final)];
      });
      return {
        sections: [
          { h2: "Projected value of a \u20B95,000 monthly SIP", paras: ["Figures assume contributions at the start of each month and a steady annual return - real markets do not move in a straight line."], table: { caption: "Corpus at different returns and horizons", columns: cols, rows, note: "L = lakh (\u20B91,00,000), Cr = crore (\u20B91,00,00,000)." } },
          { h2: "Your money vs the growth on it, at 12%", paras: ["Early contributions have the most time to compound, so growth eventually dwarfs the amount you put in."], table: { caption: "Invested amount compared with investment growth at 12%", columns: ["Horizon", "You invest", "Growth", "Corpus"], rows: splitRows } }
        ]
      };
    },
    faqs: [
      { q: "Does the \u20B95,000 SIP figure include inflation?", a: "No - it is a nominal projection. Divide by the inflation factor, or use the goal planner, to see spending power in today's money." },
      { q: "What if I increase the SIP each year?", a: "A step-up raises the amount annually and lifts the corpus noticeably over long periods. The SIP comparison tool shows the effect side by side." },
      { q: "Are the returns guaranteed?", a: "No. Market-linked investments can fall as well as rise. The figures are planning estimates at your assumed return, not promises." }
    ],
    cta: { href: "/sip/", label: "Open the SIP calculator", text: "Change the monthly amount, step-up, duration and return to model your own plan." },
    related: ["sip", "sip-compare", "inflation"]
  },
  {
    slug: "sip-vs-lumpsum",
    h1: "SIP vs lump sum: which invests better?",
    seoTitle: "SIP vs Lumpsum - Which Is Better? Same Amount Compared",
    metaDesc: "Compare investing the same \u20B96 lakh as a lump sum today versus a \u20B910,000 monthly SIP over 5 years at 8%, 10% and 12% returns, and understand the trade-off.",
    intro: [
      "SIP and lump sum are not really rivals - they answer different questions. A lump sum puts all your money to work immediately, so it compounds for longer. A SIP spreads your entries over time, lowering the risk of investing everything at a market peak.",
      "To compare them fairly, invest the same total amount both ways. Below, \u20B96,00,000 is invested either as a lump sum today or as a \u20B910,000 monthly SIP for five years, at three return assumptions."
    ],
    build() {
      const returns = [8, 10, 12];
      const rows = returns.map((r) => {
        const lump = projectPlan({ initial: 600000, years: 5, returnPct: r }).final;
        const sip = projectPlan({ monthly: 10000, years: 5, returnPct: r }).final;
        return [`${r}%`, fmtCompactMoney(lump), fmtCompactMoney(sip), fmtCompactMoney(lump - sip)];
      });
      return {
        sections: [
          { h2: "Same \u20B96,00,000, invested two ways", paras: ["The lump sum is ahead in every case because the whole amount compounds from day one. The gap is the price of spreading out your entry."], table: { caption: "Lump sum vs 5-year SIP at the same total outlay", columns: ["Expected return", "Lump sum today", "SIP over 5 years", "Difference"], rows } },
          { h2: "So which should you choose?", paras: ["If you already have a sum to invest and a long horizon, history favours investing it sooner - the market rises more often than it falls. If investing everything today would keep you awake at night, or the money arrives monthly as income, a SIP is the practical answer. Many people use both: a lump sum now, then a SIP from monthly cash flow."] }
        ]
      };
    },
    faqs: [
      { q: "Is a SIP safer than a lump sum?", a: "A SIP reduces timing risk by averaging your entry price, but it is not risk-free - it still invests in the market and can lose value. It simply avoids betting everything on a single day." },
      { q: "Why is the lump sum higher here?", a: "The lump sum is invested for the full period, while the SIP money only enters over time. In rising markets that extra time in the market wins; in a sharp early fall the SIP can do better." },
      { q: "Can I compare my own amounts?", a: "Yes - the SIP comparison tool puts any mix of lump sums, monthly amounts and step-ups on the same chart and table." }
    ],
    cta: { href: "/sip-compare/", label: "Compare your own plans", text: "Put a lump sum, a SIP and a step-up plan side by side on one chart and table." },
    related: ["sip", "lump-sum", "cagr"]
  },
  {
    slug: "how-much-will-10000-sip-become",
    h1: "How much will a \u20B910,000 monthly SIP become?",
    seoTitle: "\u20B910,000 SIP Returns: What It Grows To in 5-30 Years",
    metaDesc: "See what a \u20B910,000 monthly SIP grows to over 5, 10, 15, 20, 25 and 30 years at 8%, 10% and 12% returns, and how a 10% annual step-up changes it.",
    intro: [
      "\u20B910,000 a month is a serious commitment - roughly \u20B91.2 lakh a year. The reward is that the corpus compounds hard over long horizons, and most of the final value ends up being growth rather than your own contributions.",
      "The tables below project a flat \u20B910,000 SIP at three returns and six horizons, split your money from the growth, and show what a 10% annual step-up would add."
    ],
    build() {
      const returns = [8, 10, 12];
      const cols = ["Expected return", ...HORIZONS.map((y) => `${y} years`)];
      const rows = returns.map((r) => [`${r}%`, ...HORIZONS.map((y) => fmtCompactMoney(projectPlan({ monthly: 10000, years: y, returnPct: r }).final))]);
      const splitRows = HORIZONS.map((y) => {
        const p = projectPlan({ monthly: 10000, years: y, returnPct: 12 });
        return [`${y} years`, fmtCompactMoney(p.invested), fmtCompactMoney(p.gains), fmtCompactMoney(p.final)];
      });
      const stepRows = HORIZONS.map((y) => {
        const flat = projectPlan({ monthly: 10000, years: y, returnPct: 12 }).final;
        const step = projectPlan({ monthly: 10000, years: y, returnPct: 12, stepUpPct: 10 }).final;
        return [`${y} years`, fmtCompactMoney(flat), fmtCompactMoney(step), fmtCompactMoney(step - flat)];
      });
      return {
        sections: [
          { h2: "Projected value of a \u20B910,000 monthly SIP", paras: ["Figures assume contributions at the start of each month at a steady annual return - real markets do not move in a straight line."], table: { caption: "Corpus at different returns and horizons", columns: cols, rows, note: "L = lakh (\u20B91,00,000), Cr = crore (\u20B91,00,00,000)." } },
          { h2: "Your money vs the growth on it, at 12%", paras: ["Time does the heavy lifting. By year 30 the growth is several times the amount you actually paid in."], table: { caption: "Invested amount compared with investment growth at 12%", columns: ["Horizon", "You invest", "Growth", "Corpus"], rows: splitRows } },
          { h2: "What a 10% annual step-up adds", paras: ["A step-up raises the contribution 10% each year. It costs more later, but the extra money is only exposed for part of the journey - so the final corpus rises."], table: { caption: "Flat \u20B910,000 SIP vs a 10% annual step-up, at 12%", columns: ["Horizon", "Flat SIP", "10% step-up", "Difference"], rows: stepRows } }
        ]
      };
    },
    faqs: [
      { q: "Is \u20B910,000 a month enough?", a: "It depends on the goal. \u20B910,000 a month at 12% reaches about \u20B91 crore in 20 years - but that corpus buys much less after inflation. Plan against the inflated goal, not the nominal one." },
      { q: "Should I choose a higher SIP or a step-up?", a: "For the same money, front-loading (a higher flat SIP) usually wins because the extra rupees compound longer. A step-up is easier to sustain while your income grows." },
      { q: "What if markets fall?", a: "SIPs buy more units when prices fall, which helps over time, but a market-linked corpus can still be below projection in the short run. The figures are estimates, not guarantees." }
    ],
    cta: { href: "/goal-planner/", label: "Turn \u20B910,000 into a plan", text: "Enter your actual goal and see the required monthly amount, shortfall and costed strategies." },
    related: ["sip", "sip-compare", "how-much-will-5000-sip-become"]
  },
  {
    slug: "how-to-reach-1-crore",
    h1: "How to reach \u20B91 crore: three routes",
    seoTitle: "How to Reach \u20B91 Crore - Higher SIP, Step-up or Lump Sum",
    metaDesc: "Three costed routes to a \u20B91 crore target: a larger monthly SIP, a step-up SIP and a lump sum today, at 12% assumed return over 10 to 30 years.",
    intro: [
      "A \u20B91 crore target is not a single plan - it is a choice between paying more each month, raising your contribution over time, or putting money in today. Each route has a different cash-flow shape.",
      "The table compares the three at a 12% assumed return. Use it to pick the shape that fits your income, then model the details in the goal planner."
    ],
    build() {
      const target = 1e7;
      const rows = HORIZONS.map((y) => {
        const n = y * 12;
        return [`${y} years`, fmtMoney(requiredMonthly(target, n, 12)), `${solveStepUp(5000, y, 12, target) ?? ">40"}%`, fmtCompactMoney(target / Math.pow(1.12, y))];
      });
      return {
        sections: [
          { h2: "Three costed routes to \u20B91 crore", paras: ["Column 2 is the flat monthly SIP at 12%. Column 3 is the annual step-up needed if you start from \u20B95,000 a month. Column 4 is the lump sum you would need to invest today."], table: { caption: "Reaching \u20B91 crore at 12% - three ways", columns: ["Horizon", "Flat monthly SIP", "Step-up from \u20B95,000", "Lump sum today"], rows, note: "Nominal values. Higher assumed returns shrink every number here, which is exactly why conservative assumptions matter." } },
          { h2: "Which route is best?", paras: ["If you can afford it, the larger flat SIP usually produces the best result for the same total money, because every extra rupee compounds longer. A step-up suits people whose income will rise. A lump sum makes sense only if you already hold the cash and a long horizon - history favours investing it sooner, but only if you can tolerate the drawdowns. Most real plans combine a lump sum now with a SIP from income."] }
        ]
      };
    },
    faqs: [
      { q: "What if I cannot start at the required SIP?", a: "Start lower and step up. The goal planner prices the required step-up, and the what-if lab shows the gap if you do neither." },
      { q: "Is 12% realistic?", a: "It is a common long-run equity assumption, not a promise. Try 10% in the what-if lab to see how much harder the target becomes." },
      { q: "Is \u20B91 crore enough to retire?", a: "Usually not on its own. At 6% inflation a crore in 20 years is worth roughly \u20B931 lakh today. Use the retirement planner for a real corpus target." }
    ],
    cta: { href: "/goal-planner/", label: "Build the \u20B91 crore plan", text: "Set your start date, current savings and contribution, and get the required monthly amount." },
    related: ["sip", "retirement-planner", "goal-planner"]
  },
  {
    slug: "how-to-reach-50-lakh",
    h1: "How to reach \u20B950 lakh: three routes",
    seoTitle: "How to Reach \u20B950 Lakh - SIP, Step-up or Lump Sum Compared",
    metaDesc: "Three costed routes to a \u20B950 lakh target: a flat monthly SIP, a step-up SIP and a lump sum today, at 12% assumed return over 5 to 30 years.",
    intro: [
      "\u20B950 lakh is a common mid-life target - a house down payment, a child's education fund or a financial cushion. It is close enough to be reachable, which makes the method you choose matter.",
      "The table below costs the same target three ways at a 12% assumed return. Pick the route whose cash-flow shape suits you."
    ],
    build() {
      const target = 5e6;
      const rows = HORIZONS.map((y) => {
        const n = y * 12;
        return [`${y} years`, fmtMoney(requiredMonthly(target, n, 12)), `${solveStepUp(3000, y, 12, target) ?? ">40"}%`, fmtCompactMoney(target / Math.pow(1.12, y))];
      });
      return {
        sections: [
          { h2: "Three costed routes to \u20B950 lakh", paras: ["Column 2 is the flat monthly SIP at 12%. Column 3 is the annual step-up needed starting from \u20B93,000 a month. Column 4 is the lump sum needed today."], table: { caption: "Reaching \u20B950 lakh at 12% - three ways", columns: ["Horizon", "Flat monthly SIP", "Step-up from \u20B93,000", "Lump sum today"], rows, note: "Nominal values at the stated assumption. Try a lower return to stress-test the plan." } },
          { h2: "Getting there faster", paras: ["Time is the most powerful lever. Stretching a \u20B950 lakh goal from 10 to 15 years can cut the required monthly amount by more than a third. If you cannot add time, add either a higher starting SIP or an annual step-up - the goal planner and what-if lab price both."] }
        ]
      };
    },
    faqs: [
      { q: "How much do I need to save monthly for \u20B950 lakh?", a: "At 12% for 15 years, roughly \u20B91.1 lakh a year or about \u20B99,300 a month. At 10 years the required amount is much higher - time is the biggest lever." },
      { q: "Should the \u20B950 lakh goal be inflated?", a: "If you will spend the money in future rupees, yes. The goal planner inflates the target so you plan against its real future cost." },
      { q: "Can I use debt to reach a goal faster?", a: "Borrowing to invest is high-risk and generally not recommended for a goal like this. Prefer time, a higher SIP or a step-up." }
    ],
    cta: { href: "/goal-planner/", label: "Plan your \u20B950 lakh goal", text: "Set the target and date, then see the required monthly investment and step-up." },
    related: ["sip", "goal-planner", "sip-compare"]
  },
  {
    slug: "sip-step-up-calculator",
    h1: "SIP step-up calculator: how much does raising your SIP each year add?",
    seoTitle: "SIP Step-up Calculator - Flat vs 5%, 10% and 15% Annual Increase",
    metaDesc: "See how a 5%, 10% or 15% annual SIP step-up changes a \u20B910,000 monthly SIP over 10 to 30 years at 12%, and the step-up needed to hit \u20B91 crore.",
    intro: [
      "A step-up SIP raises your monthly contribution by a fixed percentage every year. It matches the way incomes usually grow, and over long horizons the small annual raises compound into a much larger corpus.",
      "\u20B910,000 a month outgrows many people's budgets within a few years; a step-up lets you start at a comfortable level and grow into the target. The tables show the effect at 5%, 10% and 15%."
    ],
    build() {
      const steps = [0, 5, 10, 15];
      const cols = ["Annual step-up", ...HORIZONS.map((y) => `${y} years`)];
      const rows = steps.map((st) => [`${st}%`, ...HORIZONS.map((y) => fmtCompactMoney(projectPlan({ monthly: 10000, years: y, returnPct: 12, stepUpPct: st }).final))]);
      const investRows = steps.map((st) => {
        const p = projectPlan({ monthly: 10000, years: 20, returnPct: 12, stepUpPct: st });
        return [`${st}%`, fmtCompactMoney(p.invested), fmtCompactMoney(p.final)];
      });
      const targetRows = [[1e7, "1 crore"], [2e7, "2 crores"]].map(([t, label]) => {
        const s20 = solveStepUp(10000, 20, 12, t);
        const s25 = solveStepUp(10000, 25, 12, t);
        return [`\u20B9${label}`, s20 == null ? ">40%" : `${s20}%`, s25 == null ? ">40%" : `${s25}%`];
      });
      return {
        sections: [
          { h2: "What a step-up does to a \u20B910,000 SIP", paras: ["At 12% assumed return. A step-up spends more money overall, so compare the corpus against the total invested, not in isolation."], table: { caption: "Corpus by annual step-up and horizon at 12%", columns: cols, rows, note: "L = lakh, Cr = crore." } },
          { h2: "What the step-up costs you", paras: ["More corpus means more money in. The step-up is only a good deal when the extra contributions still earn a return - which is why starting earlier helps."], table: { caption: "Total invested vs final corpus over 20 years at 12%", columns: ["Annual step-up", "You invest", "Final corpus"], rows: investRows } },
          { h2: "The step-up needed to reach \u20B91-2 crore", paras: ["Starting from \u20B910,000 a month at 12%. A dash means even a 40% annual step-up would not be enough in that time."], table: { caption: "Required annual step-up from a \u20B910,000 SIP at 12%", columns: ["Target", "In 20 years", "In 25 years"], rows: targetRows } }
        ]
      };
    },
    faqs: [
      { q: "Is a step-up better than a higher starting SIP?", a: "For the same total money, a higher flat SIP usually wins because the extra rupees are invested sooner. A step-up wins when you cannot afford the higher amount today but expect your income to grow." },
      { q: "How often should I step up?", a: "Annually is easiest to automate and matches most salary cycles. Even 5% a year makes a visible difference over 15-20 years." },
      { q: "Can I step up and also invest a lump sum?", a: "Yes. The SIP strategy lab and what-if lab let you combine a lump sum, a monthly SIP and a step-up in one comparison." }
    ],
    cta: { href: "/what-if-lab/", label: "Test the step-up yourself", text: "Change the step-up, amount and horizon and watch the corpus respond instantly." },
    related: ["sip", "sip-compare", "what-if-lab"]
  },
  {
    slug: "inflation-adjusted-goal",
    h1: "What will your goal cost after inflation?",
    seoTitle: "Inflation-Adjusted Goal Calculator - What \u20B925-50 Lakh Becomes",
    metaDesc: "See how inflation raises the future cost of a goal: what \u20B910, \u20B925 and \u20B950 lakh become in 10, 20 and 30 years at 5-7% inflation, and the SIP needed.",
    intro: [
      "A goal stated in today's money is not the amount you will need when you spend it. Prices rise, so the same lifestyle costs more in future rupees. Ignoring that is the most common planning error.",
      "This page converts goals into their future cost at different inflation rates, then shows the monthly SIP needed to reach the inflated amount at 12%."
    ],
    build() {
      const goals = [1e6, 2.5e6, 5e6];
      const goLabels = ["\u20B910 lakh", "\u20B925 lakh", "\u20B950 lakh"];
      const cols = ["Goal (today's money)", ...HORIZONS.slice(0, 5).map((y) => `${y} years`)];
      const rows = goals.map((g, i) => [goLabels[i], ...HORIZONS.slice(0, 5).map((y) => fmtCompactMoney(inflate(g, 6, y)))]);
      const sipRows = goals.map((g, i) => {
        const future = inflate(g, 6, 20);
        return [goLabels[i], fmtCompactMoney(future), fmtMoney(requiredMonthly(future, 20 * 12, 12))];
      });
      const purchasingRows = HORIZONS.slice(0, 5).map((y) => [`${y} years`, fmtCompactMoney(inflate(1e7, 6, y)), fmtCompactMoney(1e7 / Math.pow(1.06, y))]);
      return {
        sections: [
          { h2: "What your goal will actually cost", paras: ["At 6% inflation, prices roughly double every 12 years. The table inflates today's goal to the amount you would need at the point of spending."], table: { caption: "Future cost of a goal at 6% inflation", columns: cols, rows, note: "Nominal future rupees at 6% annual inflation." } },
          { h2: "The SIP needed for the inflated goal", paras: ["A \u20B950 lakh goal in 20 years actually needs about \u20B91.6 crore. Here is the flat monthly SIP at 12% to reach each inflated amount."], table: { caption: "Monthly SIP needed over 20 years at 12% for the inflated goal", columns: ["Goal (today)", "Future cost at 6%", "Required monthly SIP"], rows: sipRows } },
          { h2: "What \u20B91 crore is worth later", paras: ["Inflation also erodes a fixed corpus. This table shows the future value of \u20B91 crore of today's purchasing power, and what a nominal \u20B91 crore would be worth in today's money."], table: { caption: "Inflation and \u20B91 crore at 6%", columns: ["After", "Future cost of today's \u20B91 cr", "\u20B91 cr then, in today's money"], rows: purchasingRows } }
        ]
      };
    },
    faqs: [
      { q: "What inflation rate should I use?", a: "India's long-run CPI inflation has often run around 5-7%. Using 6% is a reasonable planning default; the goal planner lets you change it." },
      { q: "Should I plan in today's money or future money?", a: "Either, consistently. Planning in today's money uses a real return (return minus inflation), which is simpler. Planning in future money inflates the goal - which is what this page does." },
      { q: "Does inflation affect a home loan goal?", a: "Yes - the down payment for a house will cost more in the future too, so inflate the target the same way before you work out the SIP." }
    ],
    cta: { href: "/goal-planner/", label: "Plan an inflation-aware goal", text: "Enter the goal in today's money and let the planner inflate it and price the SIP." },
    related: ["inflation", "goal-planner", "real-return"]
  },
  {
    slug: "emergency-fund-how-much",
    h1: "How much emergency fund do you need?",
    seoTitle: "Emergency Fund Calculator - How Many Months and How Much to Save",
    metaDesc: "Work out your emergency fund target from essential monthly expenses and months of cover, and see how long it takes to build at different monthly savings.",
    intro: [
      "An emergency fund is measured in months of essential expenses, not a round number. The right size depends on how stable your income is and how many people depend on it.",
      "The tables below turn three, six, nine and twelve months of cover into a rupee target at different expense levels, then show how long common monthly savings amounts take to build it."
    ],
    build() {
      const expenses = [30000, 50000, 75000, 100000];
      const labels = ["\u20B930,000", "\u20B950,000", "\u20B975,000", "\u20B91,00,000"];
      const covers = [3, 6, 9, 12];
      const rows = expenses.map((e, i) => [labels[i], ...covers.map((m) => fmtCompactMoney(e * m))]);
      const buildRows = [5000, 10000, 15000, 25000].map((save) => {
        const target = 50000 * 6;
        return [fmtMoney(save), fmtCompactMoney(target), `${Math.ceil(target / save)} months`];
      });
      return {
        sections: [
          { h2: "Emergency fund target by expenses and months", paras: ["Use essential expenses only - rent, food, utilities, insurance, EMIs and school fees. Discretionary spending can pause in an emergency."], table: { caption: "Target emergency fund at different monthly essentials", columns: ["Essential monthly expenses", "3 months", "6 months", "9 months", "12 months"], rows, note: "Six months is the common default; nine to twelve suits variable income or a single-income household." } },
          { h2: "How long it takes to build", paras: ["For a household with \u20B950,000 of essential monthly expenses - a \u20B93,00,000 six-month target - at different monthly savings levels."], table: { caption: "Months to reach a \u20B93,00,000 fund", columns: ["Monthly saving", "Target", "Time to fill"], rows: buildRows } },
          { h2: "Where to keep it", paras: ["Keep it somewhere safe and quick to access: a savings account, a sweep-in deposit or a liquid fund. Return is secondary - the job is availability. Do not invest an emergency fund in volatile assets you might have to sell at a low point."] }
        ]
      };
    },
    faqs: [
      { q: "Should I count my credit card as an emergency fund?", a: "No. A card is borrowing, not a fund, and it can be withdrawn exactly when your income is under strain. Build cash first." },
      { q: "Do I need 12 months of expenses?", a: "Six months suits stable salaried income. Twelve months is prudent for freelancers, business owners, single-income households or anyone with dependants." },
      { q: "Should I invest my emergency fund for higher returns?", a: "Only the portion you would not need in a downturn. The core fund should be liquid and stable; higher returns mean higher risk, which defeats the purpose." }
    ],
    cta: { href: "/emergency-fund-planner/", label: "Set your own target", text: "Enter your essentials, choose the months of cover and see the gap and timeline." },
    related: ["emergency-fund", "savings-planner", "fd"]
  },
  {
    slug: "savings-rate-calculator",
    h1: "What does your savings rate do over time?",
    seoTitle: "Savings Rate Calculator - How 10-40% Saved Becomes a Corpus",
    metaDesc: "See what saving 10%, 20%, 30% or 40% of a \u20B91 lakh income builds over 10 to 30 years at 12%, and why the savings rate matters more than the return.",
    intro: [
      "Your savings rate - the share of take-home income you keep - is the single biggest lever ordinary investors control. A higher return helps; saving more helps immediately and with certainty.",
      "The table shows what different savings rates build over time if the saved amount is invested at 12%. Change the income in the savings planner to match your own."
    ],
    build() {
      const rates = [10, 20, 30, 40];
      const income = 100000;
      const cols = ["Savings rate", "Monthly amount", ...HORIZONS.slice(0, 5).map((y) => `${y} years`)];
      const rows = rates.map((r) => [`${r}%`, fmtMoney(income * r / 100), ...HORIZONS.slice(0, 5).map((y) => fmtCompactMoney(projectPlan({ monthly: income * r / 100, years: y, returnPct: 12 }).final))]);
      return {
        sections: [
          { h2: "Corpus built by 10% to 40% savings rates", paras: ["Assumes \u20B91 lakh monthly take-home invested at 12% a year. Your own numbers will differ - the shape is what matters."], table: { caption: "Corpus by savings rate and horizon at 12%", columns: cols, rows, note: "L = lakh, Cr = crore. Monthly amount is 10-40% of a \u20B91 lakh income." } },
          { h2: "Why the savings rate beats the return", paras: ["A higher return is uncertain and not in your control. The savings rate is a decision you make every month. Moving from 20% to 30% saves \u20B910,000 more a month - a guaranteed extra contribution, before any market return at all. That certainty is why planners focus on it."] }
        ]
      };
    },
    faqs: [
      { q: "What is a good savings rate?", a: "Above 20% is a solid start; 30% or more puts long-term goals within reach sooner. What matters is consistency over years, not a perfect single month." },
      { q: "Does investing count as saving?", a: "Yes. Here, saving means money you keep and invest rather than spend. Money left idle in a current account is not building anything." },
      { q: "How do I raise my savings rate?", a: "Attack the biggest fixed costs first - housing, transport, subscriptions - then automate the investment so you never see the money. The savings planner finds the surplus." }
    ],
    cta: { href: "/savings-planner/", label: "Find your own surplus", text: "Enter income and expenses to see your savings rate, investment rate and what a little more would build." },
    related: ["savings-planner", "sip", "dashboard"]
  },
  {
    slug: "retirement-corpus-calculator",
    h1: "How big a retirement corpus do you need?",
    seoTitle: "Retirement Corpus Calculator - Target by Expenses and Retirement Age",
    metaDesc: "See the retirement corpus needed for different monthly expenses and retirement ages, and the monthly SIP to build it, at 6% inflation and 7-12% returns.",
    intro: [
      "The retirement corpus is the pot that must pay an inflation-growing income for the rest of your life while still earning a return. It is usually far larger than people expect.",
      "The tables below estimate the corpus for different monthly expenses and retirement ages, then show the monthly SIP needed to build it before you stop working."
    ],
    build() {
      const expenses = [40000, 60000, 100000];
      const labels = ["\u20B940,000", "\u20B960,000", "\u20B91,00,000"];
      const horizons = [20, 25, 30];
      const cols = ["Monthly expense (today)", ...horizons.map((h) => `Retire in ${h} yrs`)];
      const rows = expenses.map((e, i) => [labels[i], ...horizons.map((h) => {
        const rp = retirementPlan({ ageNow: 30, ageRet: 30 + h, lifeExp: 30 + h + 25, monthlyExpense: e, inflationPct: 6, returnPct: 12, wdReturnPct: 7, corpusNow: 0, monthlySave: 0 });
        return fmtCompactMoney(rp.corpusNeeded);
      })]);
      const sipRows = horizons.map((h) => {
        const rp = retirementPlan({ ageNow: 30, ageRet: 30 + h, lifeExp: 30 + h + 25, monthlyExpense: 60000, inflationPct: 6, returnPct: 12, wdReturnPct: 7, corpusNow: 0, monthlySave: 0 });
        return [`Retire in ${h} years`, fmtCompactMoney(rp.corpusNeeded), fmtMoney(rp.requiredMonthly)];
      });
      return {
        sections: [
          { h2: "Corpus needed at different expenses and retirement ages", paras: ["Assumes 6% inflation, a 7% post-retirement return and a 25-year retirement. A longer retirement or higher expenses both raise the target sharply."], table: { caption: "Retirement corpus by monthly expense and years to retirement", columns: cols, rows, note: "L = lakh, Cr = crore. Retirement is assumed to last 25 years." } },
          { h2: "The SIP to build it", paras: ["For a household spending \u20B960,000 a month today, at a 12% saving-phase return. Retiring earlier needs a much larger monthly SIP because the pot must last longer and has less time to grow."], table: { caption: "Monthly SIP needed for a \u20B960,000/month retirement", columns: ["Plan", "Corpus needed", "Required monthly SIP"], rows: sipRows } }
        ]
      };
    },
    faqs: [
      { q: "Why is the corpus so large?", a: "It must replace income for 20-30 years while rising with inflation, and the pot keeps earning a return after retirement. Retiring earlier or living longer both increase it." },
      { q: "What post-retirement return should I assume?", a: "Be conservative - 6-7% is common once the portfolio turns defensive. A lower assumed return forces a larger corpus, which is the safer way to plan." },
      { q: "Does the corpus include tax or pension?", a: "No. It covers your own savings and withdrawals. If you expect a pension, enter a lower monthly expense so the target reflects it." }
    ],
    cta: { href: "/retirement-planner/", label: "Build the full retirement plan", text: "Add your age, savings and contributions, then compare retiring early, later or saving more." },
    related: ["retirement", "retirement-planner", "swp"]
  }
];

function buildAnswerPage(ap) {
  const canonical = `${ROOT}/${ap.slug}/`;
  const built = ap.build();
  const relHTML = (ap.related || []).map((s) => { const a = answerLink(s); return a ? `<li>${a}</li>` : ""; }).join("");
  const faqHTML = (ap.faqs || []).map((f) => `
    <details class="faq-item">
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join("");

  const sectionsHTML = built.sections.map((s) => `
      <section class="edu__section">
        <h2>${esc(s.h2)}</h2>
        ${(s.paras || []).map((p) => `<p>${esc(p)}</p>`).join("")}
        ${s.table ? answerTable(s.table) : ""}
      </section>`).join("");

  const jsonLD = [
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: (ap.faqs || []).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: ROOT + "/" },
        { "@type": "ListItem", position: 2, name: ap.h1, item: canonical }
      ]
    }
  ];

  const body = `
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(ap.h1)}</span>
    </nav>
    <section class="page-hero">
      <span class="eyebrow">Answer</span>
      <h1>${esc(ap.h1)}</h1>
      ${ap.intro.map((p) => `<p>${esc(p)}</p>`).join("")}
    </section>

    <div class="edu">
      ${sectionsHTML}

      <section class="edu__section">
        <div class="cta-card">
          <h2>${esc(ap.cta.label)}</h2>
          <p>${esc(ap.cta.text)}</p>
          <a class="btn btn--primary" href="${esc(ap.cta.href)}">${esc(ap.cta.label)}</a>
        </div>
      </section>

      <section class="edu__section">
        <h3>Related calculators</h3>
        <ul class="related-list">${relHTML}</ul>
      </section>

      <section class="edu__section">
        <h3>Frequently asked questions</h3>
        <div class="faq-list">${faqHTML}</div>
      </section>

      <div class="disclosure">
        <span class="disclosure__mark" aria-hidden="true">i</span>
        <p>FinHub is an educational tool, not a financial adviser. The figures above are estimates computed from the assumptions stated and standard formulas; they do not guarantee outcomes and should not replace professional advice.</p>
      </div>
    </div>
  </div>`;

  const html = pageShell({
    title: ap.seoTitle,
    desc: ap.metaDesc,
    canonical,
    ldObjs: jsonLD,
    body
  });
  write(join(DIST, ap.slug, "index.html"), html);
}

/* ========================= TOOL PAGE ========================= */
function buildToolPage(t) {
  const tc = TOOL_CONTENT[t.slug] || {};
  const canonical = `${ROOT}/${t.slug}/`;
  const relHTML = (tc.related || []).map((s) => {
    const o = CALC_LIST.find((x) => x.slug === s);
    if (o) return `<li><a href="/${o.slug}/">${esc(o.name)}</a></li>`;
    const tl = getTool(s);
    if (tl) return `<li><a href="/${tl.slug}/">${esc(tl.name)}</a></li>`;
    return "";
  }).join("");

  const jsonLD = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication",
      name: tc.seoTitle || t.name, description: tc.metaDesc || t.tagline, url: canonical,
      applicationCategory: "FinanceApplication", operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      author: { "@type": "Organization", name: SITE.org }
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: (tc.faqs || []).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: ROOT + "/" },
        { "@type": "ListItem", position: 2, name: t.name, item: canonical }
      ]
    }
  ];

  const faqHTML = (tc.faqs || []).map((f) => `
    <details class="faq-item">
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join("");

  const body = `
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(t.name)}</span>
    </nav>
    <section class="page-hero page-hero--tool">
      <span class="eyebrow">Planner</span>
      <h1>${esc(t.label || t.name)}</h1>
      <p>${esc(t.blurb || t.tagline)}</p>
    </section>

    <div class="calc-grid">
      <section class="card calc-form-card" aria-labelledby="form-title">
        <h2 id="form-title">Your inputs</h2>
        <div data-tool-form aria-live="polite"></div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-reset>Reset defaults</button>
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
        <div data-tool-head></div>
        <div data-tool-stats></div>
        <div data-tool-charts></div>
        <div data-tool-tables></div>
        <div data-tool-assumptions></div>
        <p class="note" data-tool-note aria-live="polite"></p>
${adSlot("calculator-result")}
      </section>
    </div>

    <div class="tool-actions" data-tool-actions></div>

    <div class="edu">
      <h2>${esc(tc.howTitle || `How the ${t.name} works`)}</h2>
      ${(tc.intro || []).map((p) => `<p>${esc(p)}</p>`).join("")}

      <section class="edu__section">
        <h3>How to use it - step by step</h3>
        <ol>${(tc.steps || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      </section>

      <section class="edu__section">
        <h3>Worked example</h3>
        <div class="example-box"><strong>Example:</strong> ${esc(tc.example || "")}</div>
      </section>

      <section class="edu__section">
        <h3>Related calculators &amp; tools</h3>
        <ul class="related-list">${relHTML}</ul>
      </section>
${journeysHTML(t.slug)}

      <section class="edu__section">
        <h3>Frequently asked questions</h3>
        <div class="faq-list">${faqHTML}</div>
      </section>

      <div class="disclosure">
        <span class="disclosure__mark" aria-hidden="true">i</span>
        <p>FinHub is an educational tool, not a financial adviser. The recommendations above are rules-based, computed from the assumptions you enter, and are shown for planning only. They do not guarantee outcomes, returns or tax treatment, and should not replace professional advice before you invest or borrow.</p>
      </div>
    </div>
  </div>
  <script>window.FINHUB_PAGE = ${JSON.stringify({ type: "tool", slug: t.slug })};</script>`;

  const html = pageShell({
    title: tc.seoTitle || t.name,
    desc: tc.metaDesc || t.tagline,
    canonical,
    ldObjs: jsonLD,
    active: `/${t.slug}/`,
    body
  });
  write(join(DIST, t.slug, "index.html"), html);
}

/* ========================= white-label sales page ========================= */
function buildSalesPage() {
  const s = BRAND.sales || {};
  if (!s.enabled) return false;

  const mail = `mailto:${s.contactEmail}?subject=${encodeURIComponent(`White-label enquiry - ${BRAND.name}`)}`;
  const wa = s.contactWhatsapp ? `https://wa.me/${String(s.contactWhatsapp).replace(/[^0-9]/g, "")}` : "";

  const counts = [
    [CALC_LIST.length, "calculators"],
    [TOOLS.length, "interactive planners"],
    [ANSWER_PAGES.length, "question pages"]
  ];

  const value = [
    ["Instant money-math suite", `${CALC_LIST.length} calculators (SIP, EMI, CAGR, FD, PPF, retirement, GST and more), ${TOOLS.length} step-by-step planners and ${ANSWER_PAGES.length} ready-made question pages.`],
    ["Genuinely white-label", "Your name, logo mark, organisation, domain and accent colours come from one config file. Your visitors never see ours."],
    ["Fast and dependency-free", "A static site with hand-written DOM and SVG charts. No framework, no tracking scripts, nothing to maintain but content."],
    ["Built to be found", "Structured data, sitemap, canonical URLs, meta descriptions and internal journeys that pass visitors from one tool to the next."],
    ["Reports clients keep", "Every result exports to CSV and to a clean print / PDF layout you can put your own letterhead next to."],
    ["Compliant by design", "Educational estimates only - no advice, no AI guesses. Assumptions are shown on screen and every result carries a disclaimer."],
    ["Mobile-first and accessible", "Keyboard-friendly, screen-reader labelled, dark and light themes, and readable on a phone in one hand."]
  ];

  const tiers = [
    {
      name: "Starter",
      price: s.priceUSD,
      priceAlt: s.priceINR,
      tag: "Best to launch fast",
      features: [
        "Complete platform rebranded to your brand",
        "Deployed on your own domain",
        "All calculators, planners and answer pages",
        "CSV + print/PDF client reports"
      ]
    },
    {
      name: "Growth",
      price: "Ask",
      priceAlt: "Custom",
      tag: "For lead generation",
      features: [
        "Everything in Starter",
        "Branded lead form + email capture",
        "Analytics and conversion tracking",
        "Priority support and content updates"
      ]
    },
    {
      name: "Agency",
      price: "Ask",
      priceAlt: "Custom",
      tag: "Resell to your own clients",
      features: [
        "Multi-site / multi-brand licence",
        "Rebrand any number of editions",
        "White-label delivery to your clients",
        "Onboarding call and handover pack"
      ]
    }
  ];

  const body = `
  <div class="container sell">
  <section class="hero">
    <p class="eyebrow">White-label offer</p>
    <h1>Own a branded finance calculator platform. Launch it in ${esc(s.setupDays || "a day")}.</h1>
    <p class="sell__lead">${esc(BRAND.name)} is a complete, fast, SEO-ready personal-finance calculator suite. Buy it, put your name on it, and hand your clients tools that actually answer their questions - SIP, EMI, retirement, debt, emergency fund and more.</p>
    <div class="hero-actions">
      <a class="btn btn--primary" href="${mail}" data-sell="email">Email to order</a>
      ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener" data-sell="whatsapp">Chat on WhatsApp</a>` : ""}
      <a class="btn btn--ghost" href="/" data-sell="demo">Try the live demo</a>
    </div>
    <p class="sell__note">The demo is the real thing - every calculator and planner below is what you would own.</p>
  </section>

  <section class="stat-grid" aria-label="What is included">
    ${counts.map(([n, label]) => `<div class="stat"><span class="stat__value">${n}</span><span class="stat__label">${esc(label)}</span></div>`).join("")}
  </section>

  <section>
    <h2>What you get</h2>
    <div class="grid-cards">
      ${value.map(([t, d]) => `<article class="card"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}
    </div>
  </section>

  <section>
    <h2>Who buys this</h2>
    <ul class="sell-list">
      <li>Independent financial advisers and RIAs who want a branded planning hub.</li>
      <li>Mutual-fund distributors, insurance agents and tax consultants.</li>
      <li>Fintech blogs, comparison sites and content publishers.</li>
      <li>Agencies building finance sites for their own clients.</li>
    </ul>
  </section>

  <section>
    <h2>Packages</h2>
    <div class="grid-cards">
      ${tiers.map((t) => `
      <article class="card${t.tag === "Best to launch fast" ? " card--tier" : ""}">
        <p class="eyebrow">${esc(t.tag)}</p>
        <h3>${esc(t.name)}</h3>
        <p class="price">${esc(t.price)}<span>${esc(t.priceAlt ? " / " + t.priceAlt : "")}</span></p>
        <ul class="sell-list">${t.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <a class="btn btn--primary" href="${mail}" data-sell="email">Enquire</a>
      </article>`).join("")}
    </div>
    <p class="sell__note">Prices are for a single branded edition. Pay by UPI / Razorpay (India) or card / Gumroad / Stripe (rest of world). Ask about agencies and multi-site licences.</p>
  </section>

  <section>
    <h2>How it works</h2>
    <ol class="sell-steps">
      <li><strong>Tell me your brand.</strong> Send your name, logo (or initials), preferred colours and domain.</li>
      <li><strong>I rebrand and deploy.</strong> I run the rebrand, build the site and put it on your domain - usually within ${esc(s.setupDays || "a day")}.</li>
      <li><strong>You review and share.</strong> Check it on your phone, then put it in front of your clients, leads and social following.</li>
    </ol>
  </section>

  <section>
    <h2>Questions buyers ask</h2>
    <div class="grid-cards">
      <article class="card"><h3>Is this financial advice?</h3><p>No. It is software that does arithmetic on the numbers you enter. It never recommends a product and always shows the assumptions it used.</p></article>
      <article class="card"><h3>Do I need to code?</h3><p>No. Rebranding is one config file and one command. It can be handed over fully deployed so you never touch a terminal.</p></article>
      <article class="card"><h3>Can I use my own domain?</h3><p>Yes - the site is static and works on any host. Your domain is part of the setup.</p></article>
      <article class="card"><h3>What about updates?</h3><p>Content and new calculators are part of the Growth and Agency packages. Starter stays as delivered.</p></article>
    </div>
  </section>

  <section class="cta-card">
    <h2>Ready to put your name on it?</h2>
    <p>Send your brand name, domain and the package you want. You will get back a live preview of your edition - usually the same day.</p>
    <form class="lead-form lead-form--stack" data-lead-form data-lead-kind="enquiry" novalidate>
      <label class="lead-form__label">Your email
        <input type="email" required placeholder="you@example.com" data-lead-email>
      </label>
      <label class="lead-form__label">Your brand / domain (optional)
        <input type="text" placeholder="Acme Wealth - acmewealth.in" data-lead-message>
      </label>
      <button class="btn btn--primary" type="submit">Request my preview</button>
      <span class="lead-form__status" data-lead-status role="status" aria-live="polite"></span>
    </form>
    <p class="sell__note"><strong>Launch guarantee:</strong> if your branded edition is not delivered in ${esc(s.setupDays || "48 hours")}, you pay nothing. Pay only after you have seen your own live preview.</p>
    <div class="hero-actions">
      <a class="btn" href="${mail}" data-sell="email">Email directly: ${esc(s.contactEmail)}</a>
      ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener" data-sell="whatsapp">WhatsApp</a>` : ""}
    </div>
  </section>
  <p class="sell__note">This page is for prospective buyers only and is excluded from search engines. ${esc(BRAND.name)} is educational planning software and does not provide financial, investment or tax advice.</p>
  </div>`;

  const html = pageShell({
    title: `White-label finance calculator platform - ${BRAND.name}`,
    desc: `Buy a rebrandable finance calculator platform: ${CALC_LIST.length} calculators, ${TOOLS.length} planners and ${ANSWER_PAGES.length} answer pages, deployed under your own brand.`,
    canonical: `${ROOT}/sell/`,
    body,
    noindex: true
  });
  write(join(DIST, "sell", "index.html"), html);
  return true;
}

/* ========================= trust pages (About / How it works / Privacy / Terms) ========================= */
function buildStaticPage(p) {
  const canonical = `${ROOT}/${p.slug}/`;
  const sections = (p.sections || []).map((s) => `
    <section class="prose-section">
      <h2>${esc(s.h2)}</h2>
      ${(s.body || []).map((b) => `<p>${esc(b)}</p>`).join("")}
      ${s.list ? `<ul>${s.list.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    </section>`).join("");
  const faq = (p.faqs || []).length ? `
    <section class="prose-section">
      <h2>Common questions</h2>
      <div class="grid-cards">
        ${p.faqs.map((f) => `<article class="card card--faq"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></article>`).join("")}
      </div>
    </section>` : "";
  const ld = [
    { "@context": "https://schema.org", "@type": p.ldType || "WebPage", name: p.h1, description: p.metaDesc, url: canonical },
    ...(p.faqs && p.faqs.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : [])
  ];
  const body = `
  <div class="container prose">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(p.h1)}</span></nav>
    <h1>${esc(p.h1)}</h1>
    ${(p.intro || []).map((b) => `<p class="prose__lead">${esc(b)}</p>`).join("")}
    ${sections}
    ${faq}
    <p class="prose__note">${esc(BRAND.name)} is educational planning software. Nothing here is financial, investment or tax advice.</p>
  </div>`;
  const html = pageShell({ title: p.title, desc: p.metaDesc, canonical, body, ldObjs: ld, active: `/${p.slug}/` });
  mkdirSync(join(DIST, p.slug), { recursive: true });
  write(join(DIST, p.slug, "index.html"), html);
}

function buildStaticPages() {
  for (const p of PAGES) buildStaticPage(p);
}

/* ========================= sitemap / robots ========================= */
function buildSeoFiles() {
  const urls = [`${ROOT}/`].concat(
    CALC_LIST.map((c) => `${ROOT}/${c.slug}/`),
    TOOLS.map((t) => `${ROOT}/${t.slug}/`),
    ANSWER_PAGES.map((a) => `${ROOT}/${a.slug}/`),
    PAGES.map((p) => `${ROOT}/${p.slug}/`)
  );
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

console.log("Building decision-tool pages\u2026");
for (const t of TOOLS) buildToolPage(t);

console.log("Building answer pages\u2026");
for (const a of ANSWER_PAGES) buildAnswerPage(a);

if (buildSalesPage()) console.log("Building white-label sales page\u2026");

console.log("Building trust pages\u2026");
buildStaticPages();

console.log("Writing sitemap + robots\u2026");
buildSeoFiles();

console.log("Done. Output in dist/ -", CALC_LIST.length, "calculators,", TOOLS.length, "tools,", ANSWER_PAGES.length, "answer pages,", PAGES.length, "trust pages + homepage.");
