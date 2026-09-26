/*
  FinHub content
  --------------
  SEO copy, formula explanations, worked examples and FAQ content for the
  homepage and every calculator page. Pure data - shared by build.js (SSG)
  and the browser shell. Keep facts accurate: every example figure here is
  reproducible with engine.js at the stated inputs.
*/

import { BRAND } from "./brand.js";

export const HOME = {
  seoTitle: "Free Finance Calculators - SIP, EMI, CAGR, FD, Mortgage & More",
  metaDesc: "Accurate, instant and free finance calculators: SIP, EMI, CAGR, FD, PPF, retirement, GST and trading tools. Compare scenarios and plan smarter.",
  heroTitle: "Make better money decisions.",
  heroSub: "Tell us what you want to figure out and we will open the right calculator - or start with your numbers and see where you stand. No sign-up, no jargon.",
  headline: "Every calculator is free, formula-transparent and mobile-friendly.",
  popularNote: "Free, instant, no sign-up"
};

export const SITE = {
  name: BRAND.name,
  org: BRAND.org,
  url: BRAND.url,
  /* Monetization config. Everything here is OFF by default so the site ships
     fully free and clean. Flip a flag (or set PREMIUM_ENABLED=1 /
     AFFILIATE_ENABLED=1 at build time) to turn the scaffold on.
     premium.enabled: lock flagged calculators behind a Pro upsell gate.
     affiliate.enabled: render partner/offer cards on the listed pages. */
  premium: {
    enabled: false,
    slugs: ["retirement", "savings-goal", "net-worth"],
    name: "FinHub Pro",
    upsellTitle: "Unlock advanced planning with FinHub Pro",
    upsellBody: "Retirement and goal planning deserve more than a single estimate.",
    perks: [
      "Unlimited saved scenarios and comparisons",
      "PDF & CSV export of every projection",
      "Tax-aware advanced retirement modelling",
      "No ads, across the whole site"
    ],
    priceLabel: "Coming soon - launch your own pricing with Stripe, or keep it free.",
    cta: "Get FinHub Pro"
  },
  affiliate: {
    enabled: false,
    disclaimer: "If you use a partner link, FinHub may earn a commission at no extra cost to you. We only surface options we think are useful; figures above are never influenced by partners.",
    partners: {
      "emi-loan": [
        { name: "Personal loan offers", note: "Check eligibility and compare interest rates across lenders.", url: "https://example.com/compare-loans", cta: "Compare loans" }
      ],
      "mortgage": [
        { name: "Home loan rates", note: "Current home loan offers from major banks and NBFCs.", url: "https://example.com/home-loans", cta: "View offers" }
      ],
      "fd": [
        { name: "Best FD rates this quarter", note: "Regular and senior-citizen FD rates compared by tenure.", url: "https://example.com/fd-rates", cta: "Compare FD rates" }
      ]
    }
  },
  /* Ad slots are OFF by default. When enabled they render only at the
     reserved, labelled positions below - never inside a result, never
     between inputs and outputs. Flip ADS_ENABLED=1 at build time to preview. */
  ads: {
    enabled: false,
    slotLabel: "Advertisement",
    slots: ["calculator-result", "home-mid", "answer-inline"]
  },
  /* Lead capture. With no endpoint configured the forms fall back to opening
     the visitor's email app addressed to contactEmail - so a sign-up always
     reaches you. Set newsletterEndpoint to a form/collector URL (Formspree,
     a Google Apps Script Web App, your own API) to capture silently. */
  leads: {
    newsletterEndpoint: ""
  },
  /* Privacy-friendly analytics. Leave blank to ship with no tracking at all.
     plausibleDomain: your domain, e.g. "finhub-jet.vercel.app". */
  analytics: {
    plausibleDomain: ""
  },
  /* Search-engine verification meta tags (paste the content value only). */
  verification: {
    google: "",
    bing: ""
  }
};

const content = (seoTitle, metaDesc, intro, formula, steps, example, faqs, related) => ({
  seoTitle, metaDesc, intro, formula, steps, example, faqs, related
});

export const CONTENT = {
  "sip": content(
    "SIP Calculator - Free Monthly Investment Return Estimator",
    "See the future value of monthly SIPs with total invested, estimated returns and annual step-up. Accurate annuity-due math, free and instant.",
    [
      "A Systematic Investment Plan (SIP) invests a fixed amount every month into a mutual fund or other growth vehicle. Because each instalment is invested from its own month one, every rupee compounds on top of the earlier ones - the essence of rupee-cost averaging plus compounding.",
      "This SIP calculator applies the standard annuity-due formula: it assumes your instalment is invested at the start of each month and compounds at the expected annual return, so the numbers match how fund SIPs actually behave."
    ],
    "FV = P x [((1 + i)^n - 1) / i] x (1 + i)   where  i = rate/12  and  n = months",
    [
      "Pick your monthly instalment - the calculator assumes it is invested at the start of every month.",
      "Choose the expected annual return. Most long-term equity expectations fall between 10% and 14%.",
      "Set the period in years. Total invested = monthly x 12 x years, shown alongside the projected value.",
      "Optional step-up: if you raise the instalment by a set % each year, future-value math includes the growing deposits.",
      "Read the projected value, the estimated returns and how many times your money grew (X of invested)."
    ],
    "Invest 10,000/month at 12% expected return for 10 years. The calculator returns about 23,23,000: you invested 12,00,000 and compounding contributed roughly 11,23,000.",
    [
      { q: "What return should I assume for a SIP?", a: "Depends on the asset. Broad equity index funds historically returned around 12% p.a. in India over 10+ years; debt funds 6-8%. Use conservative figures for planning and treat higher numbers as scenarios, not promises." },
      { q: "Is a step-up SIP worth it?", a: "Usually yes. A small 10% annual step-up can add a large amount to the final corpus because the extra deposits also compound. The chart compares 0% vs 10% growth of your instalment." },
      { q: "Why does my first instalment earn more?", a: "This is a start-of-month (annuity-due) model, which matches how fund SIPs work: the earliest instalment compounds for the longest and the last instalment still earns one month." },
      { q: "Are SIP returns guaranteed?", a: "No. Returns depend on market performance. The calculator shows projections at your chosen rate, not a guarantee of profit." }
    ],
    ["lump-sum", "compound-interest", "retirement"]
  ),

  "lump-sum": content(
    "Lump Sum Calculator - One-Time Investment Future Value",
    "See what a one-time investment grows to. Future value, total returns and ROI for a lump sum invested at a chosen annual return - with a rate comparison chart.",
    [
      "A lump-sum investment puts a single amount to work at once. Its future value depends only on the annual return and how long it compounds - the full principal earns from day one, which makes time your most powerful ally.",
      "Use this calculator for windfalls, bonuses, maturity proceeds or to compare 'invest now vs invest later'. The scenario lines on the chart show how one or two percentage points of return difference compounds into real money."
    ],
    "FV = P x (1 + r)^n   where P = amount invested, r = annual return %, n = years",
    [
      "Enter the one-time amount you can invest today.",
      "Set the expected annual return for the chosen asset class.",
      "Choose how many years the money will stay invested.",
      "Compare the invested line (flat) with the value curve - the gap is pure compounding.",
      "Toggle the scenario overlays to see 2% higher or lower returns on the same money."
    ],
    "Invest 5,00,000 once at 12% for 10 years. Future value is about 15,53,000, i.e. 10,53,000 of compounded returns on top of your principal.",
    [
      { q: "Lump sum or SIP?", a: "If you have the money now and time is long, a lump sum usually wins because the entire amount compounds for the full period. SIPs help when you earn monthly and want to smooth market timing." },
      { q: "What is a realistic return to assume?", a: "12-15% is a common planning range for Indian equities over long horizons; 7-8% for debt. Always plan with a range, not a single number." },
      { q: "Does the calculator consider taxes?", a: "No - returns shown are pre-tax. Long-term equity gains above the exemption threshold are taxed at 10%; check current rules for your asset." }
    ],
    ["sip", "cagr", "compound-interest"]
  ),

  "compound-interest": content(
    "Compound Interest Calculator - Principal, Rate & Frequency",
    "Calculate compound interest with yearly, quarterly or monthly compounding plus optional monthly additions. See the final balance and how much is pure interest.",
    [
      "Compound interest means you earn interest on previously earned interest. The more frequently interest is credited and reinvested - daily, monthly, quarterly or yearly - the faster your balance grows.",
      "This calculator shows the effect of compounding frequency on the same principal, and can add a monthly contribution so you can model a recurring investment plus a starting sum in one place."
    ],
    "A = P x (1 + r/m)^(m x n)  where m = compounding periods per year, n = years",
    [
      "Enter the principal you are starting with.",
      "Set the nominal annual interest rate offered by the product.",
      "Choose the compounding frequency that actually applies (deposits and bonds state this).",
      "Optionally add a monthly addition to model regular investing.",
      "Read the final balance, your contributions and the interest earned."
    ],
    "10,00,000 at 8% compounded monthly for 10 years (with no additions) grows to about 22,19,000 - over 12,19,000 of pure interest. Switching that same rate to yearly compounding would give about 21,59,000.",
    [
      { q: "What is the difference between APR and the effective rate?", a: "The quoted rate is nominal. The effective annual rate includes intra-year compounding; monthly compounding at 8% gives roughly 8.30% effective." },
      { q: "How do monthly additions change the result?", a: "Additions contribute their own compounding curve. The donut chart separates principal, your contributions and interest so you can see the true source of growth." },
      { q: "Is this the same as an FD calculator?", a: "Similar math, but FDs typically state a specific compounding convention and are taxed (unless like PPF). Use the FD calculator for deposit-style products." }
    ],
    ["fd", "sip", "savings-goal"]
  ),

  "emi-loan": content(
    "EMI Calculator - Loan EMI, Total Interest & Amortization",
    "Calculate monthly EMI for a loan with interest rate and tenure. See total payment, total interest and a year-by-year principal vs interest breakup.",
    [
      "An EMI (Equated Monthly Instalment) is a fixed monthly payment that repays a loan over its tenure. Early EMIs are interest-heavy; as the balance falls, more of each payment chips away at the principal.",
      "The EMI formula gives the exact same number banks use (reducing balance method). The yearly bars reveal how the principal and interest shares shift across the loan."
    ],
    "EMI = P x r x (1 + r)^n / ((1 + r)^n - 1)   where r = rate/12, n = months",
    [
      "Enter the loan amount you plan to borrow.",
      "Set the annual interest rate your lender quotes.",
      "Choose the tenure in years.",
      "Read your monthly EMI, the total repayment and the total interest cost.",
      "Inspect the yearly chart - notice the principal share climbing every year."
    ],
    "Borrow 10,00,000 at 8.5% for 5 years. The EMI is about 20,517. Over the loan you repay ~12,31,000, of which ~2,31,000 is interest.",
    [
      { q: "What is the reducing balance method?", a: "Interest is charged only on the outstanding balance, which falls each month. This is standard for personal, home and car loans - and what this formula models." },
      { q: "How do I lower my total interest?", a: "Shorten the tenure, negotiate a lower rate, or make part-prepayments. A higher EMI for a shorter tenure usually saves the most interest." },
      { q: "Does the EMI include processing fees?", a: "No. Lenders charge processing fees separately, so your effective cost is slightly higher than the interest shown." }
    ],
    ["mortgage", "compound-interest", "net-worth"]
  ),

  "mortgage": content(
    "Mortgage Payment Calculator - Tax & Insurance Included",
    "Estimate your true monthly housing cost: mortgage payment plus property tax and insurance. See the loan amount after down payment and interest over the term.",
    [
      "A mortgage is a home loan repaid through EMIs, but your true monthly cost includes more than principal and interest - property tax and home insurance are usually billed annually.",
      "This calculator converts all of it into one comparable monthly figure so you can judge affordability honestly before you commit to a property."
    ],
    "Monthly cost = EMI(loan, rate, term) + (annual tax + annual insurance) / 12   and   loan = price x (1 - down/100)",
    [
      "Enter the home price and your down payment percentage - the loan is what is left.",
      "Set the mortgage interest rate and the loan term.",
      "Add annual property tax and insurance that the bank or locality charges.",
      "Read the total monthly payment (EMI + tax + insurance) and the interest over the loan life.",
      "The donut shows the full cost of the home: down payment, principal and interest."
    ],
    "Home price 25,00,000 with 20% down (5,00,000), so the loan is 20,00,000. At 8% for 20 years the EMI is ~16,730; adding 12,000 tax and 8,000 insurance a year gives a true monthly cost of about 18,400.",
    [
      { q: "How much down payment do I need?", a: "Lenders usually require 10-25%. A larger down payment lowers the loan and total interest, and often gets you a better rate." },
      { q: "Should property tax be included in affordability?", a: "Yes. It is a real annual outlay. Including it gives an honest monthly number instead of a surprise bill." },
      { q: "What is a good mortgage interest rate?", a: "It varies with your credit profile and market rates. Compare offers and remember that even 0.25% difference changes the total interest by lakhs over 20 years." }
    ],
    ["emi-loan", "compound-interest", "net-worth"]
  ),

  "retirement": content(
    "Retirement Calculator - Corpus Needed & Monthly Saving Gap",
    "Find the retirement corpus you need, what your savings will grow to, and the monthly SIP that closes the gap - inflation-adjusted income model.",
    [
      "Retirement planning is about converting today's expenses into tomorrow's income. Your expenses will inflate until you retire, and then must be funded by a corpus that keeps earning while you draw it down.",
      "This calculator models three phases: growing your current savings until retirement, your future expenses inflated each year, and a post-retirement drawdown where the remaining pot earns a lower, safer return."
    ],
    "Corpus needed = PV of a growing annuity due:  E x (1+r)/(r-g) x [1 - ((1+g)/(1+r))^N]   (E = first year's expenses, g = inflation, r = post-retirement return)",
    [
      "Enter your current age, planned retirement age and life expectancy.",
      "State today's monthly expenses - these are inflated to retirement age.",
      "Set expected inflation, the return while saving and the safer post-retirement return.",
      "Optionally include a current retirement corpus and your present monthly saving.",
      "Read the corpus needed and the extra monthly saving that would close any gap."
    ],
      "Age 30, retire at 60, 85 lifespan, expenses 60,000/month today. At 6% inflation those become ~3,45,000/month at 60. To fund that for 25 years a corpus of roughly 9.3 Cr is needed (assuming a 7% post-retirement return).",
    [
      { q: "How is the corpus expected to last until age 85?", a: "The model assumes the corpus earns your post-retirement return while you withdraw inflation-rising annual amounts. If your projected corpus equals the number shown, the chart drains to zero around your life expectancy." },
      { q: "What return should I assume while saving?", a: "A blended equity-heavy portfolio might plan 10-12%; debt-heavy plans 7-8%. After retirement you typically shift to safer assets, so the calculator uses a separate, lower number." },
      { q: "Is 60,000/month realistic for retirement expenses?", a: "It depends on your lifestyle and inflation assumptions. The value of the calculator is the gap it reveals - try raising inflation to see how much more you need to save." }
    ],
    ["sip", "savings-goal", "inflation"]
  ),

  "fd": content(
    "FD Calculator - Fixed Deposit Maturity & Interest",
    "Calculate fixed deposit maturity value and interest for a chosen deposit, rate and compounding frequency. Shows the effective annual yield.",
    [
      "A fixed deposit (FD) locks money for a fixed tenure at a fixed interest rate. In India, most banks compound FD interest quarterly, which makes the effective yield slightly higher than the quoted rate.",
      "This FD calculator shows both the maturity amount and the effective annual yield so you can compare FDs honestly against other products."
    ],
    "Maturity = P x (1 + r/m)^(m x n)   and   effective yield = (1 + r/m)^m - 1",
    [
      "Enter the amount you want to deposit.",
      "Set the FD interest rate your bank quotes for the tenure.",
      "Choose the compounding frequency (quarterly is the common default).",
      "Pick the tenure in years.",
      "Read the maturity value, interest earned and the effective annual yield."
    ],
    "Deposit 5,00,000 at 7% for 5 years with quarterly compounding. Maturity value is about 7,07,400, with interest of about 2,07,400. The effective yield is 7.19%.",
    [
      { q: "Is FD interest taxable?", a: "Yes. Interest is added to your income and taxed at your slab rate; banks also deduct TDS above a threshold unless you submit form 15G/15H. The calculator shows pre-tax figures." },
      { q: "Why is the effective yield higher than the rate?", a: "Because compounding within the year earns interest on interest. Quarterly compounding at 7% produces about 7.19% a year." },
      { q: "What happens if I break the FD early?", a: "Most banks charge a penalty and pay a lower rate. Early withdrawal can noticeably reduce your interest." }
    ],
    ["ppf", "compound-interest", "lump-sum"]
  ),

  "ppf": content(
    "PPF Calculator - Maturity & Tax-Free Interest",
    "Calculate your PPF maturity value, total deposits and tax-free interest for the 15-year (or extended) tenure at the current PPF rate.",
    [
      "The Public Provident Fund (PPF) is a 15-year, government-backed saving scheme with an EEE (Exempt-Exempt-Exempt) tax status: deposits, interest and maturity are all tax-free. Interest compounds annually.",
      "This calculator projects the balance from an optional existing balance plus your annual deposits, showing the maturity value at the end of the chosen tenure."
    ],
    "Yearly: Balance = Balance x (1 + r/100) + deposit   (interest is credited annually on the opening balance)",
    [
      "Enter your annual PPF deposit (the scheme caps deposits at 1,50,000 per year).",
      "Set the current PPF rate announced by the government quarterly.",
      "Choose the tenure - 15 years is the minimum lock-in; many extend to 20+.",
      "Optionally start from an existing PPF balance.",
      "Read the maturity value, your total deposited and the tax-free interest."
    ],
    "Deposit the 1,50,000 annual cap every year for 15 years at 7.1%. You deposit 22,50,000 and the balance grows to about 38,00,000 - roughly 15,50,000 of tax-free interest.",
    [
      { q: "How is PPF interest credited?", a: "Interest is calculated on the lowest balance between the 5th and the end of each month, and credited annually on 31 March. Deposits made before the 5th earn interest for that month." },
      { q: "Can I extend PPF beyond 15 years?", a: "Yes, in blocks of 5 years with or without further deposits. Extension keeps the EEE tax benefit, making it a strong long-term debt holding." },
      { q: "Is the return guaranteed?", a: "The rate is set by the government and reviewed quarterly; it is not market-linked and historically has been stable, but it can change." }
    ],
    ["fd", "savings-goal", "retirement"]
  ),

  "gst-tax": content(
    "GST Calculator - Add or Remove GST from a Price",
    "Add GST to a net price or back it out of an inclusive total. Covers 0%, 5%, 12%, 18% and 28% slabs with instant net / tax / gross values.",
    [
      "Goods and Services Tax (GST) is applied on top of the taxable value of goods and services. Two questions come up constantly: what is the gross price when GST is added, and what was the net value when a quoted price already includes GST?",
      "This GST calculator handles both directions. Choose 'exclusive' to add tax to a net price, or 'inclusive' to strip the tax out of an invoice total."
    ],
    "Exclusive: gross = net x (1 + rate/100)    Inclusive: net = gross / (1 + rate/100)",
    [
      "Enter the amount you are working with.",
      "Pick the GST slab that applies to the goods or service.",
      "Choose exclusive mode to add GST, or inclusive mode to remove it.",
      "Read the net value, the GST amount and the gross total."
    ],
    "A service quoted at 10,000 exclusive of 18% GST: GST is 1,800 and the customer pays 11,800. Alternatively, an invoice total of 11,800 that includes 18% GST contains a net value of exactly 10,000.",
    [
      { q: "Which GST rate applies to me?", a: "Slabs are 0%, 5%, 12%, 18% and 28% depending on the goods/service category. Check the official rate list or ask your CA - choosing the wrong rate is a compliance issue." },
      { q: "How do I back GST out of a total?", a: "Use inclusive mode: net = gross / 1.18 for 18%. The calculator does this precisely and shows the tax portion separately." },
      { q: "Is GST different for intra-state and inter-state?", a: "The total rate is the same; intra-state is split into CGST + SGST while inter-state is IGST. The amount of tax is identical." }
    ],
    ["inflation", "net-worth", "savings-goal"]
  ),

  "inflation": content(
    "Inflation Calculator - Future Cost & Purchasing Power",
    "Calculate what today's money will cost in the future, or what a future amount is worth today. Inflation-adjusted purchasing power made visible.",
    [
      "Inflation quietly reduces what a rupee can buy every year. At 6% inflation the purchasing power of money halves in roughly 12 years, which is why long-term goals must always be stated in inflated rupees.",
      "Use 'future' mode to price a future expense (a child's education, a car, retirement spend) in today's money. Use 'past' mode to express an amount you will have later in today's purchasing power."
    ],
    "Future cost = today x (1 + i)^n      Today's value = future / (1 + i)^n",
    [
      "Enter the amount you want to convert across time.",
      "Set the inflation rate you expect (6% is a common Indian planning figure).",
      "Choose how many years ahead or ago.",
      "Pick the direction: today-to-future (future cost) or future-to-today (today's value).",
      "Read the equivalent amount and the purchasing power gap."
    ],
    "A 1,00,000 expense today will cost about 3,21,000 in 20 years at 6% inflation. Flip the direction: 1,00,000 in 20 years would only buy what about 31,000 buys today.",
    [
      { q: "What inflation rate should I plan with?", a: "Indian CPI has averaged 5-6%. Education and healthcare costs often inflate faster (8-10%). Use a slightly conservative higher number for essential goals." },
      { q: "Why does inflation matter for investing?", a: "Your real return is nominal return minus inflation. If an FD earns 7% and inflation is 6%, your real growth is only ~1% - the calculator makes that erosion tangible." },
      { q: "What is the 'rule of 72' for inflation?", a: "Divide 72 by the inflation rate to estimate how long money takes to halve in value. At 6%, 72/6 = about 12 years." }
    ],
    ["retirement", "savings-goal", "gst-tax"]
  ),

  "investment-return": content(
    "Investment Return Calculator - ROI & CAGR on Your Portfolio",
    "Calculate the absolute return and ROI of an investment, with CAGR when there are no periodic deposits. Understand what your portfolio really earned.",
    [
      "When you check a portfolio you see a current value, but the headline number that matters is the return you earned relative to what you put in. If you invested in lumps and monthly amounts, the money invested total is not simply what you started with.",
      "This calculator shows absolute profit or loss and ROI. When you made only a single investment, it also computes the CAGR - the annualised return that lets you compare against any other investment."
    ],
    "ROI = (final - invested) / invested x 100     CAGR = (final / initial)^(1/years) - 1   (single-investment case)",
    [
      "Enter the total amount you invested initially.",
      "Add any regular monthly investment you made during the period.",
      "Enter the current (or sold) value of the holding.",
      "State how many years the money was invested.",
      "Read your absolute gain, ROI, and - if there were no periodic deposits - the CAGR."
    ],
    "Invest 1,00,000 initially plus 5,000/month for 3 years = 2,80,000 put in. If the current value is 3,60,000, your gain is 80,000 and ROI is about 28.6%. With only the initial 1,00,000, a final of 1,50,000 in 3 years is a CAGR of ~14.5%.",
    [
      { q: "Why can't CAGR be shown with monthly deposits?", a: "CAGR assumes a single beginning amount growing for the whole period. With ongoing deposits each instalment has its own time horizon, so ROI is the honest headline." },
      { q: "What is the difference between ROI and CAGR?", a: "ROI is the total gain as a percentage of money put in. CAGR annualises that growth, which makes a 3-year 30% gain read as about 9.1% per year." },
      { q: "Should dividends be included?", a: "Ideally yes. Include dividends received in the final value, or add them as invested income, for a truer return picture." }
    ],
    ["cagr", "profit-loss", "sip"]
  ),

  "cagr": content(
    "CAGR Calculator - Annualised Growth Rate",
    "Calculate the compound annual growth rate of an investment from beginning value, ending value and years. Compare any asset on one annualised number.",
    [
      "CAGR (Compound Annual Growth Rate) is the smooth annual growth rate that would turn a beginning value into an ending value over a given number of years. It removes the noise of ups and downs so you can compare investments on equal terms.",
      "The chart contrasts the smooth CAGR curve against simple linear growth, making the power of compounding visible."
    ],
    "CAGR = (End / Begin)^(1 / years) - 1",
    [
      "Enter the beginning value of the investment.",
      "Enter its ending value today (or at sale).",
      "Set the number of years between the two.",
      "Read the CAGR and compare it against the total and simple average returns.",
      "Use the same number across different assets - a mutual fund's CAGR vs a stock's CAGR - for a fair comparison."
    ],
    "A portfolio that grew from 1,00,000 to 2,00,000 in 5 years has a CAGR of about 14.9%. The total return was 100%, but the annualised rate is under 15%.",
    [
      { q: "Why use CAGR instead of total return?", a: "A 100% total return over 2 years is far more impressive than the same return over 10 years. CAGR normalises for time, making returns comparable." },
      { q: "Does CAGR include dividends?", a: "Only if you include reinvested dividends in the ending value. For a fair comparison, use total-return figures." },
      { q: "Is CAGR a guarantee?", a: "No - it is a backward-looking average. Markets are volatile; a smooth 14.9% CAGR typically conceals years of big gains and losses." }
    ],
    ["investment-return", "lump-sum", "sip"]
  ),

  "position-size": content(
    "Stock Position Size Calculator - Risk-Based Position Sizing",
    "Calculate how many shares to buy based on your account balance, risk per trade and stop-loss distance. Protect your capital with disciplined sizing.",
    [
      "Position sizing is the discipline that separates traders who survive from those who blow up. The idea is simple: decide first how much of your account you are willing to lose on the trade, then size the position so that hitting your stop costs exactly that.",
      "This calculator uses the standard risk-based method: risk amount divided by the per-share distance between entry and stop-loss gives the number of shares."
    ],
    "Shares = (Account x risk%) / (Entry - Stop)     risk per share = |Entry - Stop|",
    [
      "Enter your total trading account balance.",
      "Set the % of capital you risk per trade (1% is the classic rule).",
      "Enter the price at which you plan to buy.",
      "Set the stop-loss price where you will exit if the trade fails.",
      "Read the exact shares to buy, the position value and your real risk as a % of the position."
    ],
    "Account 5,00,000 risking 1% = 5,000. Entry 250 with a 230 stop means 20 risked per share, so you buy 250 shares worth 62,500. If stopped, you lose 5,000 - exactly your planned 1%.",
    [
      { q: "Why risk only 1% per trade?", a: "Even a strong system loses streaks. With 1% risk you can lose 10 in a row and still be down less than 10% - enough to keep trading with confidence." },
      { q: "What if the stock gaps past my stop?", a: "Slippage happens. A stop order may fill worse than the trigger price, so your real loss can exceed the planned risk. Position size as if the stop could slip." },
      { q: "Should I risk more on high-probability trades?", a: "Some traders use a risk ladder, but keeping every trade near the same risk keeps the math consistent. Consistency beats occasional aggression." }
    ],
    ["risk-reward", "profit-loss", "net-worth"]
  ),

  "risk-reward": content(
    "Risk/Reward Calculator - Trade Setup R Multiples",
    "Calculate the risk/reward ratio of any trade setup from entry, stop-loss and target. Optionally include quantity for rupee risk and potential profit.",
    [
      "The risk/reward (R) ratio tells you how much you stand to make for every unit you risk. A 1:2 setup risking 1 to make 2 needs to win only about a third of the time to break even.",
      "Enter the three prices that define your trade and the calculator returns the ratio instantly. Add a quantity to convert the geometry into actual money at risk and at target."
    ],
    "Risk = |Entry - Stop|, Reward = |Target - Entry|, Ratio = Reward / Risk",
    [
      "Enter the entry price of your planned trade.",
      "Set the stop-loss price (your exit if wrong).",
      "Set the target price (your exit if right).",
      "Optionally add quantity and account size to see money terms.",
      "Read the ratio - aim for setups where reward clearly outweighs risk."
    ],
    "Entry 250, stop 240, target 270: risk is 10, reward is 20, so the ratio is 2 (1:2). With 1,000 shares you risk 10,000 and stand to make 20,000.",
    [
      { q: "What is a good risk/reward ratio?", a: "Many traders look for at least 1:1.5 to 1:3, but a ratio is only meaningful combined with your win rate. At 1:2 you break even winning about 33% of trades." },
      { q: "How is R multiple used?", a: "One R is your unit of risk. A 1:2 trade that wins returns +2R; losing costs -1R. Tracking results in R keeps a performance journal honest." },
      { q: "Should I move my target after entry?", a: "That is trade management. What matters is that the ratio is computed from realistic levels - a target placed too close to make the ratio look good defeats the purpose." }
    ],
    ["position-size", "profit-loss", "investment-return"]
  ),

  "profit-loss": content(
    "Profit & Loss Calculator - Trade P&L With Fees",
    "Calculate the profit or loss of a trade including buy and sell fees. See cost, proceeds and your return percentage for any quantity.",
    [
      "Knowing a trade's gross move is not enough - fees, commissions and charges eat into results, especially on smaller trades. This calculator computes the real net profit or loss of a buy-and-sell round trip.",
      "Enter buy and sell prices, the quantity traded and optional buy/sell fees to see the bottom line and your return on the money at risk."
    ],
    "P&L = (Sell x qty - sell fees) - (Buy x qty + buy fees)",
    [
      "Enter the price you paid per unit.",
      "Enter the price you sold at.",
      "Set the quantity traded.",
      "Add optional buy and sell fees (brokerage, STT, exchange charges).",
      "Read the net profit/loss, total cost, proceeds and your return percentage."
    ],
    "Buy 100 shares at 200 and sell at 230 with 0 fees: proceeds 23,000 minus cost 20,000 = 3,000 profit, a 15% return. Add fees of 100 in and 100 out, and the profit drops to 2,800 (~14%).",
    [
      { q: "Do brokerage charges matter?", a: "Yes - percentage-wise they hit small trades hardest. Always model the round-trip cost before sizing a trade." },
      { q: "What about taxes on profits?", a: "The calculator shows pre-tax P&L. Short-term and long-term capital gains rules differ by market and holding period; account for them when planning." },
      { q: "Does this handle fractional shares?", a: "Yes - enter a fractional quantity and the math still works, but note many platforms only allow whole shares." }
    ],
    ["risk-reward", "investment-return", "position-size"]
  ),

  "savings-goal": content(
    "Savings Goal Calculator - Time to Reach a Target",
    "Find out how long it takes to reach a savings goal with monthly deposits and expected return, starting from what you have saved already.",
    [
      "Every financial goal - an emergency fund, a car, a wedding, a down payment - is really a question of time and rate. Given how much you save each month and the return it earns, when will you get there?",
      "This calculator solves exactly that: it finds the month your balance first crosses the target, showing the total you invest and the interest that does part of the work."
    ],
    "Solve for n in:  current x (1+i)^n + monthly x ((1+i)^n - 1)/i x (1+i) = target   (monthly deposits at the start of each month)",
    [
      "Enter the goal amount you need to reach.",
      "Add how much you have already saved toward it.",
      "Set your monthly saving amount.",
      "Choose the expected annual return on those savings.",
      "Read the time to reach the goal, total invested and interest earned."
    ],
    "Goal 10,00,000 with 1,00,000 already saved and 20,000/month at 8%: the goal is reached in about 3.25 years (39 months), investing ~7,80,000 more, with interest covering the balance.",
    [
      { q: "How do I reach a goal faster?", a: "Save more each month, expect a higher (realistic) return, or accept a lower target. The chart shows the projection; sliding your monthly amount shows the deadline moving." },
      { q: "What if I cannot save enough monthly?", a: "The calculator marks the goal 'not reachable' at that saving level. That is useful information - it forces a choice between a bigger monthly number or a smaller goal." },
      { q: "Should I use pre-tax or post-tax returns?", a: "Use post-tax, post-inflation returns for goals far in the future, otherwise the plan silently under-delivers. Debt goals can reasonably use a lower, safer return." }
    ],
    ["retirement", "inflation", "compound-interest"]
  ),

  "net-worth": content(
    "Net Worth Calculator - Assets Minus Liabilities",
    "Calculate your net worth: total assets minus total liabilities, with a visual breakdown of where your money sits.",
    [
      "Net worth is the single best snapshot of financial health: everything you own minus everything you owe. It removes the noise of a single account balance and shows your true financial position.",
      "Add your assets (cash, investments, property) and liabilities (loans, credit card dues) and the calculator totals them, shows the split and computes your net worth - track it quarterly to watch the trend."
    ],
    "Net worth = Sum of assets - Sum of liabilities",
    [
      "Add each asset you own - cash, bank balances, investments, property, vehicles - with its current value.",
      "Add each liability - home loan, car loan, personal loan, credit card dues - with its outstanding balance.",
      "The calculator totals both sides and subtracts liabilities from assets.",
      "Read your net worth and inspect the donut to see concentration risk.",
      "Re-run it every quarter to see whether you are trending up."
    ],
    "Assets of 1,03,00,000 (cash 5L, shares 20L, house 60L, FD 10L, PPF 8L) minus liabilities of 24,80,000 (home loan 20L, car loan 4L, credit card 80k) gives a net worth of 78,20,000.",
    [
      { q: "Should my house count as an asset?", a: "Yes, at its realistic market value, but remember you still need somewhere to live. Many planners exclude the primary home's equity from 'investable' net worth while counting it fully." },
      { q: "How is this different from income?", a: "Income is a flow; net worth is a stock. Two people earning the same can have wildly different net worths depending on how much they save and invest." },
      { q: "What is a good target for net worth?", a: "A common rough benchmark is to have accumulated your annual income by age 30 and several multiples by retirement. Trends matter more than hitting any single number." }
    ],
    ["retirement", "emi-loan", "mortgage"]
  )
};

export function getContent(slug) {
  return CONTENT[slug] || null;
}

/* Tool page copy (decision tools, not single calculators). */
export const TOOL_CONTENT = {
  "dashboard": {
    seoTitle: "Financial Health Dashboard - Savings, Surplus & Goal Check",
    metaDesc: "See your savings rate, monthly surplus, emergency fund cover, debt burden and a transparent financial health score - then get the next best action.",
    intro: [
      "The dashboard pulls your monthly cash flow together in one place: what comes in, what goes out, what you invest, and what is left over. Instead of one number, it shows the whole picture so you can see which lever to pull.",
      "Everything is computed from your inputs with transparent rules and capped components - there is no black box. Change any figure and the score, the projection and the recommended next step update instantly."
    ],
    steps: [
      "Enter your take-home income, fixed and variable spending, debt payments and monthly investing.",
      "Add what you already have saved and the goal you are working toward.",
      "Read your financial health score and the breakdown showing exactly how it was earned.",
      "Look at the projection against your goal, then open the recommended next tool."
    ],
    example: "On an income of 1,00,000 with 30,000 fixed, 20,000 variable and 10,000 debt, you have a 40,000 monthly surplus before investing. Investing 20,000 of it lifts your investment rate to 20% of income and builds the emergency fund and goal projection at the same time.",
    faqs: [
      { q: "Is the financial health score a credit score?", a: "No. It is a coaching gauge built from ratios you control - savings rate, emergency cover, investment rate, debt burden and goal progress. It is not a credit score, a credit check or financial advice." },
      { q: "How is the score calculated?", a: "Five components are capped at 100 and weighted: savings rate 25, emergency fund 20, investment rate 20, debt burden 20 and goal progress 15. The breakdown table shows each component score, weight and target." },
      { q: "Does my data leave my device?", a: "No. Everything is calculated in your browser and saved locally so you can return to it. Nothing is uploaded." }
    ],
    related: ["sip", "emergency-fund", "net-worth"]
  },
  "goal-planner": {
    seoTitle: "Goal Planner - How Much to Invest to Reach Any Goal",
    metaDesc: "Turn any goal into a required monthly investment. See the future value after inflation, your projected corpus, the shortfall, and costed strategies to close the gap.",
    intro: [
      "A goal is only useful once it becomes a monthly number. The goal planner inflates your target to its future value, grows what you have already saved, and works out the monthly investment needed - in today's rupees and in the future ones you will actually spend.",
      "If you are short, it generates costed strategies: invest more each month, step up every year, invest for longer, or start with a bigger lump sum. The recommended option is the cheapest one that still reaches the goal."
    ],
    steps: [
      "Pick the goal type and enter the amount in today's money.",
      "Set how many years you have, plus inflation and expected return assumptions.",
      "Add what you have already saved and what you currently invest each month.",
      "Compare the costed strategies table and read the recommendation."
    ],
    example: "A 50,00,000 goal in 15 years at 6% inflation needs about 1.2 crore then. With nothing saved and a 12% expected return, the required monthly investment is roughly 24,000; a 10% annual step-up starting near 13,000 can reach the same goal.",
    faqs: [
      { q: "Why inflate the goal?", a: "Prices rise, so a house that costs 50 lakh today will cost far more in 15 years. Planning against the inflated value stops you silently under-saving." },
      { q: "What return should I assume?", a: "Use a conservative long-run figure such as 10-12% for equity-heavy goals and lower for short or debt goals. The planner treats your figure as an assumption, not a promise." },
      { q: "What if my goal is unreachable?", a: "The tools then show the realistic choices: a larger monthly amount, a longer horizon, a bigger lump sum, or a smaller target. Seeing the trade-off early is the point." }
    ],
    related: ["sip", "retirement", "inflation"]
  },
  "sip-compare": {
    seoTitle: "SIP Comparison - Compare Investment Plans Side by Side",
    metaDesc: "Compare 2-5 SIP or lump-sum plans on one chart and table: invested, gains, final corpus, inflation-adjusted value and CAGR for each scenario.",
    intro: [
      "Choosing between plans is easier when they sit on the same axes. Add two to five scenarios, each with its own monthly amount, initial lump sum, annual step-up, duration and expected return, and compare them directly.",
      "The comparison table normalises for how much you actually put in, so a plan that earns more is only 'better' if it also justifies the extra money committed."
    ],
    steps: [
      "Set the scenarios: monthly investment, initial amount, step-up, years and expected return.",
      "Adjust inflation and, optionally, a goal amount.",
      "Read the corpus growth chart and the invested-vs-gains bars.",
      "Use the table to compare final corpus, real value and CAGR."
    ],
    example: "Comparing 5,000/month, 10,000/month and 5,000/month with a 10% annual step-up over 20 years shows the step-up plan overtaking the flat 10,000 plan on final corpus - because the early deposits still compound even though the larger instalments arrive later.",
    faqs: [
      { q: "Is a higher SIP always better?", a: "It produces a bigger corpus only because you invest more. Compare the CAGR and gains columns to see which plan is genuinely more efficient per rupee invested." },
      { q: "Should I compare real or nominal values?", a: "Use nominal figures to see account balances and the inflation-adjusted column to see spending power. Long horizons make this gap large." },
      { q: "Can I mix SIP and lump sum?", a: "Yes. Each scenario has an initial amount and a monthly amount, so you can model a lump sum, a SIP, or both." }
    ],
    related: ["sip", "lump-sum", "cagr"]
  },
  "what-if-lab": {
    seoTitle: "What-If Lab - Test Changes to Your Investment Plan",
    metaDesc: "See what happens if you invest more, step up, invest longer, add a lump sum, assume lower returns or pause for a year - one lever at a time, with the corpus impact.",
    intro: [
      "The what-if lab takes your current plan and changes one assumption at a time, so you can feel the sensitivity of the numbers instead of guessing.",
      "Each lever is priced: it shows the change in projected corpus and the extra money you would actually commit, so the trade-off is visible."
    ],
    steps: [
      "Enter your current plan: monthly amount, initial amount, step-up, years and return.",
      "Read the baseline projection and the effect of every lever at once.",
      "Use the levers to see which single change helps most for the least extra money.",
      "Stress-test with a lower return before you commit to anything."
    ],
    example: "Adding 2,000 to a 10,000 monthly plan over 15 years changes the projected corpus meaningfully, but a 10% annual step-up often moves it further for a similar or smaller total outlay - the table shows both.",
    faqs: [
      { q: "Why hold other things constant?", a: "Isolating one change makes its effect readable. Real life moves several things at once, which is why the tool is a sensitivity check, not a forecast." },
      { q: "Is the lower-return lever a prediction?", a: "No. It is a stress test. If your plan only works at an optimistic return, it is fragile; the lever shows how fragile." },
      { q: "What does the pause lever model?", a: "It removes twelve monthly deposits mid-plan, as if you stopped investing for a year. Compounding on the existing balance continues." }
    ],
    related: ["sip", "goal-planner", "inflation"]
  },
  "savings-planner": {
    seoTitle: "Savings Planner - Find Your Monthly Surplus",
    metaDesc: "Work out your monthly surplus, savings rate, expense ratio and emergency fund gap - and see what saving a little more each month becomes over time.",
    intro: [
      "Most people can save more than they think; they just cannot see where. The savings planner starts with your income and every category of outflow to reveal the surplus hiding in plain sight.",
      "It then prices the choice: saving 1,000, 3,000 or 5,000 more each month is not an abstract virtue, it is a specific, investable number with a long-run result."
    ],
    steps: [
      "Enter your take-home income and each category of monthly spending.",
      "Add existing debt payments, current investing and liquid savings.",
      "Read your surplus, savings rate and emergency fund cover.",
      "Compare what each extra monthly saving becomes over your chosen horizon."
    ],
    example: "On 1,00,000 a month with 50,000 of spending, 10,000 of debt and 15,000 of investing, about 25,000 is unallocated. Redirecting 5,000 of it to investing every month is one of the highest-return moves available.",
    faqs: [
      { q: "What counts as fixed vs variable?", a: "Fixed is committed and stable - rent, utilities, school fees, insurance. Variable is discretionary - dining, shopping, travel. Splitting them shows what you can actually reduce." },
      { q: "How big should my emergency fund be?", a: "A common target is six months of essential expenses including debt payments, held in cash or near-cash. The planner computes the exact gap." },
      { q: "Should I clear debt or invest first?", a: "Very high-interest debt such as credit cards usually costs more than investments earn, so it is often best cleared first. Compare the rates and decide deliberately." }
    ],
    related: ["emergency-fund", "sip", "dashboard"]
  },
  "retirement-planner": {
    seoTitle: "Retirement Planner - Corpus Needed & Monthly Saving",
    metaDesc: "Work out the retirement corpus you need, the monthly saving to reach it, and compare retiring early, retiring later, saving more or lower returns.",
    intro: [
      "Retirement planning has one hard question and several soft ones. The hard question is the corpus: how much you need at retirement to replace an inflation-growing income for the rest of your life. The soft ones are your assumptions - return, inflation and how long you live.",
      "This planner keeps your assumptions on the page. It projects the corpus across your lifetime, shows the gap or surplus against the target, and prices the four levers people actually control: retire later, retire earlier, save more, or accept a lower return."
    ],
    steps: [
      "Enter your age, target retirement age and life expectancy.",
      "Add today's monthly expenses, what you have saved and what you save each month.",
      "Set your return while saving, your return after retirement, and inflation.",
      "Compare the scenario table and read the recommended monthly saving."
    ],
    example: "A 30-year-old spending 60,000 a month today, retiring at 60 and living to 85, needs a pot that can pay an inflation-linked income for 25 years. The planner shows the future monthly expense, the corpus required, and what the current saving grows to."
  , faqs: [
      { q: "Why is the corpus so large?", a: "Because it has to fund 20-30 years of withdrawals that themselves rise with inflation, while the remaining pot still earns a return. Retiring earlier or living longer both increase it." },
      { q: "What returns should I use?", a: "Be conservative. Many planners assume 10-12% while saving and 6-7% after retirement, with inflation around 6%. The lower the return you plan around, the more resilient the plan." },
      { q: "Does this include tax or pensions?", a: "No. It models your own savings and withdrawals in today's and future rupees. Add expected pensions or other income as a lower monthly expense figure if you prefer." }
    ],
    related: ["retirement", "swp", "inflation"]
  },
  "debt-planner": {
    seoTitle: "Debt Payoff Planner - Timeline, Interest & Extra Payments",
    metaDesc: "Plan the payoff of up to three debts: see the timeline, total interest, and what extra monthly payments save with avalanche or snowball strategies.",
    intro: [
      "Being in debt is a cash-flow problem with an arithmetic answer. This planner simulates every month: interest accrues, minimum payments are made, and any extra goes at one debt at a time until everything is clear.",
      "Choose avalanche (highest interest rate first) to pay the least interest, or snowball (smallest balance first) for quicker wins. The table shows exactly what an extra payment buys you in interest and time."
    ],
    steps: [
      "Enter the balance, interest rate and minimum payment for each debt.",
      "Choose the payoff strategy and add any extra monthly payment.",
      "Read the payoff timeline and total interest.",
      "Use the scenarios table to price a larger extra payment before committing."
    ],
    example: "Two debts - 2,00,000 at 15% and 50,000 at 12% - clear faster and cheaper under avalanche than snowball, but the snowball clears the smaller debt within months, which many people find easier to sustain."
  , faqs: [
      { q: "Avalanche or snowball?", a: "Avalanche minimises interest mathematically. Snowball clears small balances sooner and can be easier to stick with. The planner shows both, so you can see the cost of choosing the more motivating option." },
      { q: "Does the order of minimum payments matter?", a: "The simulation pays the minimums first, then throws everything extra at the target debt. When a debt clears, its minimum rolls into the next target - the snowball effect." },
      { q: "What if my payment does not cover the interest?", a: "The balance would never fall. The planner flags this, and the fix is to raise the payment or lower the rate (for example by consolidating)." }
    ],
    related: ["debt-payoff", "credit-card-interest", "savings-planner"]
  },
  "emergency-fund-planner": {
    seoTitle: "Emergency Fund Planner - Target, Coverage & Gap",
    metaDesc: "Set an emergency fund target in months of essential expenses, see your current coverage and gap, and how long it takes to fill at your saving rate.",
    intro: [
      "An emergency fund is the part of your money that is not trying to grow - it is trying to be there. The target is simple: a number of months of essential expenses, held somewhere safe and liquid.",
      "This planner computes the target, your coverage today, the gap, and how long the gap takes to fill at your current saving rate. It also compares 3, 6, 9 and 12 months of cover so you can choose deliberately."
    ],
    steps: [
      "Enter essential monthly expenses - not discretionary spending.",
      "Choose how many months of cover you want.",
      "Add what you have set aside and what you can save each month.",
      "Read the gap and the months needed, then compare coverage options."
    ],
    example: "Essential expenses of 40,000 a month make a 6-month fund 2,40,000. With 1,00,000 already saved and 10,000 a month going in, the planner shows how long the remaining 1,40,000 takes."
  , faqs: [
      { q: "How many months do I need?", a: "Three months can suit stable salaried income with no dependants. Six is the common target. Nine to twelve suits variable income, single-income households or business owners." },
      { q: "Where should it sit?", a: "A savings account, sweep-in deposit or liquid fund - somewhere certain and quick to access. Return is secondary; the job is availability." },
      { q: "Should I invest it instead?", a: "Only money you can afford to see fall in the short term should be invested. The emergency fund exists so you never have to sell investments at a bad time." }
    ],
    related: ["emergency-fund", "savings-planner", "fd"]
  },
  "net-worth-tracker": {
    seoTitle: "Net Worth Tracker - Assets, Liabilities & Snapshots",
    metaDesc: "Add your assets and liabilities to see net worth instantly, then save dated snapshots and track the trend over time - all in your browser.",
    intro: [
      "Net worth - everything you own minus everything you owe - is the single best scoreboard for long-term progress. It is deliberately boring: no daily prices, no predictions, just the balance sheet.",
      "Add each asset and liability at its current value, watch net worth update, then save a dated snapshot. Repeat each quarter and the trend chart does the motivating for you."
    ],
    steps: [
      "Add each asset with its current value.",
      "Add each liability - loans, credit cards, anything owed.",
      "Read your net worth, debt-to-assets ratio and asset allocation.",
      "Save a snapshot with today's date; repeat regularly to build the trend."
    ],
    example: "Assets of 11,00,000 against liabilities of 15,50,000 give a net worth of -4,50,000. A year later, with the loan partially repaid and investments grown, the same snapshot shows the direction of travel."
  , faqs: [
      { q: "What should I count?", a: "Cash, deposits, investments, property and vehicles as assets; home loans, personal loans and card balances as liabilities. Use current market value, not purchase price." },
      { q: "Does my data leave my device?", a: "No. Everything is stored in your browser's local storage. Nothing is uploaded. You can export your snapshots as JSON and import them elsewhere." },
      { q: "How often should I update it?", a: "Quarterly is plenty. Net worth is noisy month to month; the trend over a year is what tells you whether the plan is working." }
    ],
    related: ["net-worth", "dashboard", "savings-planner"]
  },
  "my-plans": {
    seoTitle: "My Plans - Saved FinHub Plans & Net Worth Snapshots",
    metaDesc: "Every plan you saved across FinHub's tools, in one place, ready to resume exactly where you left off. Export or import your plans as JSON.",
    howTitle: "How My Plans works",
    intro: [
      "Every tool on FinHub can save a named plan - a goal, a retirement scenario, a debt payoff, a SIP strategy. This page collects them all so you can resume a plan, rename it, or see how it compares later.",
      "Plans live in your browser's local storage, never on a server. Use Export to back them up or move them to another device, and Import to bring them back."
    ],
    steps: [
      "Open any tool and set your numbers.",
      "Type a name in the Save plan box and press Save.",
      "Return here to resume, rename or delete plans.",
      "Export a JSON backup, or import one on another device."
    ],
    example: "Save 'House 2028' in the Goal Planner and 'Aggressive SIP' in the Strategy Lab, then compare both side by side here before deciding which to commit to."
  , faqs: [
      { q: "Where are my plans stored?", a: "In this browser's local storage on this device. They are not uploaded and are not tied to any account." },
      { q: "What happens if I clear browsing data?", a: "Local storage is cleared too. Export your plans first if you want a backup you can re-import." },
      { q: "Can I share a saved plan?", a: "Yes. Open the plan and use the Share button - the URL carries the inputs, though the saved name itself stays on your device." }
    ],
    related: ["dashboard", "goal-planner", "net-worth-tracker"]
  }
};

/* Homepage: the problems a user is trying to solve. Each routes to a tool or
   a calculator, so the home page behaves like an assistant, not a directory. */
/* The six things people actually arrive wanting to know. One question, six
   answers - deliberately short so the homepage asks for one decision, not
   thirty. Each routes to the single best tool for that intent. */
export const PROBLEMS = [
  { id: "grow", title: "Grow my money", desc: "See what a monthly investment could become over time.", to: "sip" },
  { id: "goal", title: "Reach a goal", desc: "Find out how much you need to invest each month.", to: "goal-planner" },
  { id: "retire", title: "Plan my retirement", desc: "Work out your retirement number and the monthly saving.", to: "retirement-planner" },
  { id: "debt", title: "Get out of debt", desc: "See when you will be debt-free and what extra payments save.", to: "debt-planner" },
  { id: "safety", title: "Build financial safety", desc: "Set your emergency fund target and the months to fill it.", to: "emergency-fund-planner" },
  { id: "understand", title: "Understand my finances", desc: "See your savings, debt and progress in one place.", to: "dashboard" }
];

/* Static trust pages: About, How it works (methodology), Privacy, Terms.
   These build credibility, satisfy ad-network requirements and answer the
   questions a cautious buyer or AdSense reviewer asks. Real content only. */
export const PAGES = [
  {
    slug: "about",
    title: `About ${BRAND.name} - Free, Transparent Finance Calculators`,
    h1: `About ${BRAND.name}`,
    metaDesc: `${BRAND.name} is a free, transparent personal-finance calculator platform. Every tool shows its formula and assumptions, runs in your browser, and needs no sign-up.`,
    intro: [
      `${BRAND.name} exists to answer everyday money questions with real numbers instead of vague advice: what a SIP becomes, what a loan really costs, when you could be debt-free, and whether you are on track for retirement.`,
      `Every calculator and planner runs entirely in your browser. Nothing you type is uploaded, there is no account, and no page asks for your phone number or bank details.`
    ],
    sections: [
      {
        h2: "Why it is free",
        body: [
          `The core calculators are and stay free, with no sign-up. The platform is supported by optional advertising, clearly labelled, and by licensing the same engine to advisers and finance creators who brand it for their own clients. Monetisation never changes the numbers a calculator shows you.`
        ],
        list: [
          "No paywall on any calculator or planner.",
          "Ads, when present, are labelled and never placed inside a result.",
          "Partner links, when present, are disclosed and never influence figures."
        ]
      },
      {
        h2: "Who it is for",
        body: [
          `Individuals planning their own money, and professionals who want a fast, honest tool to show a client what a decision actually does. The language is plain on purpose: if a number matters, the assumption behind it is visible.`
        ],
        list: [
          "Anyone comparing a SIP, a loan offer or a savings product.",
          "People building an emergency fund or paying down debt.",
          "Advisers and creators who want a branded tool for their audience."
        ]
      },
      {
        h2: "What it is not",
        body: [
          `${BRAND.name} is educational software. It is not financial, investment, tax or legal advice, and it does not know your full circumstances. Every result is an estimate at the assumptions you choose - use it to ask better questions, then decide with a qualified professional if you need one.`
        ]
      }
    ],
    faqs: [
      { q: `Is ${BRAND.name} really free?`, a: "Yes. Every calculator and planner is free and needs no account. The project is supported by labelled advertising and by licensing the engine to professionals who brand it." },
      { q: "Do you sell my data?", a: "There is no account and nothing you enter is sent to us, so there is no personal data to sell. Inputs stay in your browser." },
      { q: "How do you make money?", a: "Optional advertising and white-label licensing to advisers and creators. Neither changes the maths or the results you see." }
    ],
    ldType: "AboutPage"
  },
  {
    slug: "how-it-works",
    title: `How ${BRAND.name} calculations work - Formulas & Assumptions`,
    h1: "How the calculations work",
    metaDesc: `The exact formulas and assumptions behind every ${BRAND.name} calculator: annuity-due SIP maths, reducing-balance EMI, compound interest, inflation and retirement projections.`,
    intro: [
      `Every tool on ${BRAND.name} is built on published, standard formulas. Nothing is a black box: the formula itself is printed under each result, and the assumptions panel lists the exact inputs used.`
    ],
    sections: [
      {
        h2: "Standard formulas, shown openly",
        body: [
          `Calculations use the same maths you would find in a textbook or a spreadsheet. Change one input and the whole result, chart and table recompute instantly.`
        ],
        list: [
          "SIP and step-up: future value of a growing annuity-due (instalment at the start of each month).",
          "EMI and loans: reducing-balance amortisation with a year-by-year principal/interest split.",
          "Compound interest: periodic compounding with optional monthly additions.",
          "Inflation: real value = nominal divided by (1 + inflation)^years.",
          "Retirement: corpus needed to fund inflation-adjusted withdrawals, plus the saving gap."
        ]
      },
      {
        h2: "Assumptions are visible and yours to change",
        body: [
          `Defaults are realistic starting points, not recommendations. Expected returns, inflation and timeframes are exposed as inputs, and the assumptions panel repeats every value used so a result can be reproduced and checked.`
        ]
      },
      {
        h2: "Where the numbers live",
        body: [
          `All computation happens in your browser. Saved plans, recent tools and your snapshot are kept in this browser's local storage on your device. Nothing is uploaded, and clearing your browser data clears them too - export a backup first if you want to keep a plan.`
        ]
      },
      {
        h2: "Rounding",
        body: [
          `Rounding happens only for display. Calculations carry full precision internally, so totals in a table may look a unit different from the rounded figures shown in a card - the underlying value is the same.`
        ]
      }
    ],
    faqs: [
      { q: "Why does my result differ from another calculator?", a: "Usually a different convention: start-of-month vs end-of-month SIP, annual vs monthly compounding, or a different rounding. This site states its convention and formula so you can compare like with like." },
      { q: "Are the returns guaranteed?", a: "No. Returns are projections at the rate you enter. Markets can do better or worse; use conservative assumptions for planning." },
      { q: "Can I check the maths myself?", a: "Yes. The formula is printed under each result and the assumptions panel lists every input, so you can reproduce it in a spreadsheet." }
    ],
    ldType: "WebPage"
  },
  {
    slug: "privacy",
    title: `Privacy - ${BRAND.name}`,
    h1: "Privacy",
    metaDesc: `${BRAND.name} runs in your browser. No account, no upload of your figures, no sale of personal data. How the site handles your information.`,
    intro: [
      `This page explains, in plain language, what ${BRAND.name} does and does not do with your information.`
    ],
    sections: [
      {
        h2: "The short version",
        body: [
          `There is no account and no sign-up. The numbers you enter into a calculator stay in your browser and are not sent to us. We do not ask for your bank details, PAN, Aadhaar or phone number, and we do not sell personal data.`
        ]
      },
      {
        h2: "What is stored, and where",
        body: [
          `Your theme choice, recently viewed tools, saved plans and the snapshot you enter on the homepage are stored in your browser's local storage on your own device. They are not transmitted to a server. You can clear them at any time by clearing your browser data for this site.`
        ]
      },
      {
        h2: "Cookies and analytics",
        body: [
          `By default this site sets no advertising cookies and runs no third-party analytics. If the operator enables a privacy-friendly analytics tool (for example Plausible), it is cookieless and reports only aggregate page counts - no individual is identified. Any advertising, where enabled, is clearly labelled.`
        ]
      },
      {
        h2: "If you email us",
        body: [
          `If you choose to contact us or subscribe to a newsletter, we receive the email address you send and use it only to reply or to send the updates you asked for. You can ask to be removed at any time.`
        ]
      }
    ],
    faqs: [
      { q: "Do I need to create an account?", a: "No. Every tool works without an account. Saved plans live in your browser." },
      { q: "Can you see the amounts I type?", a: "No. Calculations run in your browser and your inputs are not uploaded." }
    ],
    ldType: "WebPage"
  },
  {
    slug: "terms",
    title: `Terms of Use - ${BRAND.name}`,
    h1: "Terms of use",
    metaDesc: `Terms for using ${BRAND.name}: educational estimates only, not financial advice, no warranty, and how optional advertising and partner links work.`,
    intro: [
      `By using ${BRAND.name} you agree to these terms. They are written to be readable on purpose.`
    ],
    sections: [
      {
        h2: "Educational use only",
        body: [
          `${BRAND.name} provides educational estimates. It is not financial, investment, tax, legal or accounting advice, and no result is a recommendation to buy, sell or hold anything. You are responsible for the decisions you make.`
        ]
      },
      {
        h2: "Accuracy and no warranty",
        body: [
          `The tools use standard formulas and the assumptions you enter. We work to keep them correct, but we provide the site "as is", without warranties of any kind, and accept no liability for any loss arising from its use. Always verify important figures independently before acting.`
        ]
      },
      {
        h2: "Advertising and partner links",
        body: [
          `The site may display labelled advertising and may include partner or affiliate links. Where a link is a partner link, we may earn a commission at no extra cost to you, and this is disclosed. Partners never influence a calculation or the result you see.`
        ]
      },
      {
        h2: "Intellectual property and fair use",
        body: [
          `The site's design, text and code are protected. You may use the calculators freely for personal and professional planning. Republishing, reselling or redistributing the site or its code without a licence is not permitted; licensing is available for professionals who want a branded copy.`
        ]
      }
    ],
    faqs: [
      { q: "Can I use these calculators with my clients?", a: "Yes, for planning and discussion. Professionals who want a branded copy under their own name can license the white-label version." },
      { q: "Do ads affect the numbers?", a: "No. Advertising and partner links never influence any calculation or result." }
    ],
    ldType: "WebPage"
  }
];
