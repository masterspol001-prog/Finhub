# Launch Guide - from this folder to a live, monetizable website

Plain-English steps for a non-technical person. FinHub is a static site: it is
just files that any host can serve. You do **not** need a server, a database or
any monthly fee to start.

Expected total cost to go live: **$0** (free tiers). A custom domain is
optional later at roughly $10-15/year.

---

## Step 0 - Understand the three pieces

1. **Code** - this `finance-hub` folder. Vercel builds it into website files.
2. **Hosting** - Vercel (free) turns your code into a public website at
   something like `https://finhub-xyz.vercel.app`.
3. **Your own name (optional, later)** - a domain like `finhub.com` bought from
   a registrar, then pointed at Vercel.

You can finish Step 1-3 below and have a live public URL in about 15 minutes.

---

## Step 1 - Deploy to Vercel (two ways, pick one)

### Way A - GitHub (recommended; Vercel rebuilds automatically on every change)

1. Create a free account at https://github.com
2. Download and install **GitHub Desktop** from https://desktop.github.com and
   sign in there.
3. Copy this whole `finance-hub` folder somewhere easy to find (your Desktop).
   Do **not** copy the `dist/` folder inside it - Vercel creates that itself.
4. In GitHub Desktop: File -> Add local repository -> choose the copied
   `finance-hub` folder.
5. Click **Publish repository** (uncheck "keep this code private" only if you
   are happy for anyone to see the code; private is fine).
6. Create a free account at https://vercel.com (sign in with the same GitHub
   account).
7. Click **Add New** -> **Project** -> choose the `finance-hub` repository ->
   click **Deploy**.
8. Wait ~1 minute. Vercel reads the included `vercel.json`, runs the build, and
   shows you a live URL like `https://finance-hub-xxxx.vercel.app`. Open it.

From now on, any change you make and "commit + push" in GitHub Desktop is
automatically rebuilt and live on Vercel within a minute. No command line
needed.

### Way B - No GitHub, using Vercel's command line

1. Install Node.js LTS from https://nodejs.org (accept all defaults).
2. Open a terminal (Windows: "Command Prompt" or "PowerShell"; Mac: "Terminal")
   and type:

   # Login to Vercel (opens your browser once)
   npx vercel login

   # From inside the finance-hub folder, deploy
   cd finance-hub
   npx vercel --prod

3. Answer the questions with Enter to accept the defaults. Vercel builds in the
   cloud and prints your live URL.

To update later, run `npx vercel --prod` again from the folder.

---

## Step 2 - (Optional now, cheap later) Buy and connect a domain

Until you do this you use the free `*.vercel.app` address, which is perfectly
fine for launch.

1. Buy a domain from any registrar (Namecheap, GoDaddy, Hostinger, Porkbun).
   A `.com` is usually $10-15/year; cheaper TLDs exist.
2. In Vercel: open your project -> **Settings** -> **Domains** -> add your
   domain and follow Vercel's DNS instructions at your registrar.
3. Add an environment variable so search engines are told your real address:

   - Vercel project -> Settings -> Environment Variables
   - Name: `SITE_URL`, value: `https://yourdomain.com` (your actual domain)
   - Redeploy (Settings -> Deployments -> ... -> Redeploy).

   The sitemap and every page's "canonical" link then point at your domain.

---

## Step 3 - Claim your free money accounts

Do these in any order. Only the first one is truly "now"; the others become
useful once you have visitors.

1. **Newsletter (start today)** - create a free account at Buttondown,
   Beehiiv or Substack. Replace the "One money tip, every Sunday" signup form
   on the site (it currently just pretends to subscribe) with their embed code,
   and start collecting emails. This list is the only asset you own outright.

2. **Affiliate programs (start after the site is live)** - sign up for
   financial affiliate programmes (loan aggregators, brokers, FD comparison
   sites, brokerages). When approved you get partner links. Fill them into
   `assets/js/content.js` under `SITE.affiliate.partners` (see below), set
   `enabled: true`, rebuild and push.

3. **Google AdSense (start after you have real traffic)** - Google only
   accepts sites with original content and visitors, so wait until the site
   has steady traffic and a few pages. Apply at https://adsense.google.com and
   paste your ad code into the `.ad-slot` boxes on the pages.

4. **Premium tier (much later, optional)** - the site already has a "Pro"
   gate scaffold (see below). Turning it on before you have an audience will
   cost you more in lost visitors than it earns. Wait for traffic, then wire it
   to a payment provider such as Stripe, or offer it as a membership.

---

## Step 4 - Turning on the monetization scaffold (when you're ready)

Both features are **off by default** and live in one file:
`assets/js/content.js`, in the `SITE` object.

### Affiliate partner cards

1. Replace the example partner entries under `SITE.affiliate.partners` with
   your real programme links (keep the page keys `emi-loan`, `mortgage`, `fd`).
2. Change `SITE.affiliate.enabled` from `false` to `true`.
3. Rebuild and push (see below). Cards with a disclosure line and
   `rel="sponsored"` links now appear on those pages.

### FinHub Pro gate

1. Keep `SITE.premium.enabled` at `false` until you have traffic.
2. When you are ready, set it to `true` and update the `priceLabel` and the
   "Get FinHub Pro" button to point at your checkout.
3. Rebuild and push. The calculators flagged `premium` (retirement,
   savings-goal, net-worth) then show a blurred preview behind the upgrade
   panel, and a "Pro" badge appears on their cards.

You can preview either feature before enabling it in the code:

# Build locally with the features on, then open the dist/ folder
PREMIUM_ENABLED=1 AFFILIATE_ENABLED=1 npm run build

---

## Step 5 - Rebuilding after any content change

With **Way A** (GitHub): commit and push in GitHub Desktop - Vercel rebuilds
automatically.

With **Way B** (CLI): run `npx vercel --prod` again.

Locally, on a machine with Node.js, from the `finance-hub` folder:

# Run the 21 unit tests to make sure the math still passes
npm test

# Regenerate the website into dist/
npm run build

# Preview locally at http://localhost:4173
npm run serve

---

## Checklist before you promote the site

- [ ] Site loads on your phone; dark mode and the currency switch work.
- [ ] Open the sitemap: `https://your-url/sitemap.xml` - 18 URLs listed.
- [ ] Newsletter form replaced with a real provider.
- [ ] Pages link to each other (check a couple of "Related calculators").
- [ ] Every page has the "educational tool, not financial advice" note (built in).
- [ ] Optional: submit your sitemap URL in Google Search Console to get indexed.
