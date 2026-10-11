# Selling the white-label platform

How to turn this codebase into money. Read section 0 first - it keeps you out of
trouble. The rest is a straight runbook.

---

## 0. What you are actually selling (and what you are not)

You are selling **software and branding**, not financial advice.

- You are selling: a website, calculators, planners, reports, design, setup and support.
- You are not selling: investment recommendations, portfolio management, or advice.
- The product already refuses to give advice: every result shows assumptions and a
  disclaimer, and there is no AI guessing anywhere. Keep it that way.

This distinction is what keeps a solo seller safe. Do not market it as "advice"
or as "guaranteed returns". Market it as "tools your clients can use".

One line to remember: **"I sell the calculator and the brand. The adviser gives
the advice."**

---

## 1. The offer

You are selling a complete, rebrandable personal-finance calculator platform:

- 32 calculators (SIP, EMI, CAGR, FD, PPF, retirement, GST, trading and more)
- 10 interactive planners (goal, retirement, debt, emergency fund, net worth, what-if)
- 11 pre-written answer pages
- CSV export and print/PDF client reports
- SEO-ready static site, mobile-first, dark/light, accessible
- Rebrandable to the buyer's name, logo mark, colours, domain and contact details

The live demo is the product. You do not need to build a custom demo per buyer -
point them at the running site.

### Packages

| Package | Price (example) | What they get |
|---|---|---|
| Starter | USD 199 / INR 14,999 | Full platform rebranded and deployed on their domain |
| Growth | Ask (suggest 2-3x Starter) | Starter + lead form, analytics, priority support, content updates |
| Agency | Ask (suggest 5-10x Starter) | Multi-site licence, resell to their own clients, onboarding call |

Edit the prices once in `brand.config.json` under `sales` and the `/sell/` page
updates automatically.

---

## 2. Before your first sale: three things

Do these first. Everything else is noise until they exist.

1. **A real contact address.** Put your email (and WhatsApp if you want) in
   `brand.config.json` under `sales.contactEmail` / `sales.contactWhatsapp`.
   Right now the page ships with `you@example.com`.
2. **A live demo URL.** Deploy the site somewhere public (see section 5) and share
   that link. Nobody pays without clicking.
3. **A way to get paid.** Section 4.

Then rebuild so the sales page carries your details:

```bash
npm run build
```

Your page is at `/sell/`. It is `noindex`, so search engines ignore it - share the
link directly.

---

## 3. First 12 hours

1. Set your contact details in `brand.config.json` and run `npm run build`.
2. Deploy the demo (section 5). Copy the URL.
3. Set up one payment link (section 4). Test it with a small amount.
4. Post the offer in 5 places (section 6 templates): 2 WhatsApp groups, 1 LinkedIn
   post, 3 direct messages to advisers/agents you already know.
5. Offer a launch discount for the first 3 buyers (for example Starter at
   INR 9,999 / USD 129). Scarcity closes the first sale.
6. When someone replies, send the demo link and the payment link in the same
   message. Reduce their effort to zero.

The first sale comes from people who already know you, not from ads. Start there.

---

## 4. Getting paid

You need two rails: one for India (cheap, instant) and one for the rest of the
world (card/Gumroad).

### India - UPI and Razorpay

Fastest, lowest-friction option for Indian buyers.

**Plain UPI (no account needed beyond your bank):**
1. Open any UPI app (GPay, PhonePe, Paytm) on your phone.
2. Use "Receive" / "My QR" and save a screenshot of your QR, or copy your UPI ID
   (looks like `yourname@okhdfcbank`).
3. Send the QR image plus your UPI ID when a buyer says yes.

**Razorpay (looks more professional, sends receipts, supports cards/netbanking):**
1. Sign up at razorpay.com with your PAN and bank account.
2. Create a **Payment Link** or a **Payment Page** for each package price.
3. Copy the link. That link is your "buy" button - paste it into the offer email.
4. Razorpay holds and settles to your bank (typically T+2).

**GST note:** selling a website/service in India may attract GST once you cross the
threshold. If you are unsure, keep the first few sales small and ask a CA. Do not
guess on tax.

### International - Gumroad or Stripe

**Gumroad (simplest for a solo seller):**
1. Create a Gumroad account.
2. Create a product named e.g. "White-label Finance Calculator Platform - Starter".
3. Set price in USD, attach the demo link in the description.
4. Copy the product URL. Gumroad handles cards, receipts and VAT collection.

**Stripe (if you have a registered business):**
1. Create a Stripe account and complete verification.
2. Create a Payment Link for your USD price.
3. Send the link to international buyers.

### The delivery rule

1. Buyer pays.
2. You run the rebrand with their details (section 5).
3. You deploy to their domain or hand over the built `dist/` folder plus the config.
4. Send a short handover note: their login/domain, how to change prices/copy, and
   your support window.

Do not hand over the source until you are paid. Show the live demo first.

---

## 5. Delivery: rebrand and deploy

Everything brand-related lives in **one file**: `brand.config.json`.

```json
{
  "name": "TheirBrand",
  "org": "TheirBrand Advisory LLP",
  "url": "https://theirbrand.example",
  "logoMark": "T",
  "theme": { "accent": "#0f766e", "accent2": "#ea580c" },
  "footerBlurb": "...",
  "footerDisclaimer": "...",
  "sales": { "enabled": false }
}
```

Then one command regenerates the whole branded site:

```bash
npm run rebrand
```

That command writes `assets/js/brand.js` and rebuilds `dist/`. Their name, logo
mark, favicon, page titles, structured data and accent colours are all updated.
Set `"sales": { "enabled": false }` on the buyer's edition so their copy does not
advertise your white-label offer.

**Rebranding checklist for a buyer:**

1. `cp brand.config.json theirbrand.config.json`
2. Fill in their name, org, domain, logo mark (1-2 letters), colours, contacts.
3. `node scripts/rebrand.mjs theirbrand.config.json --build`
4. Deploy `dist/` and point their domain at it.
5. Open it on a phone and click through every nav link once.

**Deploying:** `dist/` is a static folder. Drag it onto Netlify, Vercel, Cloudflare
Pages or any static host, or `npx --yes serve dist -l 4173` to preview locally.
Static hosts are free or near-free; put the buyer's domain on it.

**Keep a master copy.** Before each buyer, keep the clean `brand.config.json` (the
FinHub one) so you can reset to demo state: `node scripts/rebrand.mjs brand.config.json --build`.

---

## 6. Finding buyers

Best buyers, in order of how fast they pay:

1. **People you already know** who sell financial products - advisers, RIAs,
   mutual-fund distributors, insurance agents, tax consultants.
2. **Fintech bloggers and comparison sites** who need tools to keep readers.
3. **Small agencies** who build finance sites and want a ready module.
4. **LinkedIn** finance-adviser communities. Post the demo, not a pitch.

### Outreach template - direct message (WhatsApp / LinkedIn)

> Hi [Name], I built a finance calculator website - SIP, EMI, retirement, debt,
> emergency fund planners - and I can put your brand on it. It is the kind of tool
> set clients actually use before they call you. Live demo: [link]. I am doing it
> for the first few advisers at [discount]. Want me to send a version with your
> name on it?

### Outreach template - email

> Subject: A branded calculator hub for [Firm]
>
> Hi [Name],
>
> Your clients keep asking "how much will this SIP grow to" and "how much do I need
> to retire" - questions numbers answer better than paragraphs.
>
> I have a ready-made finance calculator platform (32 calculators, 10 planners)
> that I can brand as [Firm] and put on [firmdomain], usually within a day. Live
> demo: [link].
>
> It is educational software only - it never gives advice, always shows its
> assumptions, and exports a client-ready PDF report.
>
> Starter is [price]. Want me to set up a preview with your name and colours so you
> can judge it on your own brand?
>
> [Your name] | [phone] | [email]

### Objections and answers

- **"Is this financial advice?"** - No. It does arithmetic and shows assumptions.
  It never recommends a product. You keep giving the advice.
- **"Can I get it in my colours?"** - Yes, that is the whole point. One config file.
- **"Do I have to maintain it?"** - No. It is static and dependency-free. Updates
  are optional and part of the Growth/Agency packages.
- **"Why not just use free online calculators?"** - Because those carry someone
  else's brand and ads. This one carries yours and keeps the visitor on your site.
- **"Is it expensive?"** - Compare it to one custom-built calculator page from an
  agency. Then compare it to one client it helps you win.

---

## 7. Pricing and upselling

- The Starter price is a **launch price**. Raise it after every 2-3 sales.
- Upsell at handover: custom domain setup, lead form, analytics, a monthly content
  refresh, extra calculators branded to their niche (NPS, HRA, specific loan types).
- Agency buyers pay the most: one licence, many branded sites for their clients.
- Referrals: give an existing buyer one month of updates for a referral that pays.

---

## 8. What already exists in the product

- Every result: CSV export and a clean print/PDF layout for client reports.
- `/sell/` - your white-label offer page (edit details in `brand.config.json`).
- `scripts/rebrand.mjs` - the one-command rebrand.
- `npm run build` - regenerates all pages, sitemap, robots.
- `npm test` - 114 tests that keep the maths honest when you rebrand.

## 9. What is deliberately NOT built

- No AI, no advice engine, no guaranteed-return claims.
- No accounts or server. Plans save in the visitor's own browser (localStorage).
  This is a feature: no data, no compliance headache, nothing to host.
- Premium/affiliate/ads flags stay OFF by default. Selling the platform is a faster
  and cleaner first revenue than waiting on ad approvals.
