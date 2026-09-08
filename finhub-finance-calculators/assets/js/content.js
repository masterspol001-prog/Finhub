/*
  FinHub content
  --------------
  SEO copy, formula explanations, worked examples and FAQ content for the
  homepage and every calculator page. Pure data - shared by build.js (SSG)
  and the browser shell. Keep facts accurate: every example figure here is
  reproducible with engine.js at the stated inputs.
*/

export const HOME = {
  seoTitle: "Free Finance Calculators - SIP, EMI, CAGR, FD, Mortgage & More",
  metaDesc: "Accurate, instant and free finance calculators: SIP, EMI, CAGR, FD, PPF, retirement, GST and trading tools. Compare scenarios and plan smarter.",
  heroTitle: "Money math, made instantly clear.",
  heroSub: "Accurate finance calculators for investing, loans, retirement and trading - built on transparent formulas with charts and step-by-step answers. No sign-up, no noise.",
  headline: "Every calculator is free, formula-transparent and mobile-friendly.",
  popularNote: "Most used this week"
};

export const SITE = {
  name: "FinHub",
  org: "FinHub Tools",
  url: "https://finhub.example.com",
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
