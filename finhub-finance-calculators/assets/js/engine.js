/*
  FinHub finance engine
  ---------------------
  Pure calculation + calculator registry.
  No DOM access here -> shared by the browser app AND the Node unit tests.
*/
export const CURRENCIES = {
  INR: { code: "INR", symbol: "\u20B9", locale: "en-IN" },
  USD: { code: "USD", symbol: "$", locale: "en-US" },
  GBP: { code: "GBP", symbol: "\u00A3", locale: "en-GB" },
  CAD: { code: "CAD", symbol: "C$", locale: "en-CA" },
  AUD: { code: "AUD", symbol: "A$", locale: "en-AU" },
  AED: { code: "AED", symbol: "AED", locale: "en-AE" },
  SGD: { code: "SGD", symbol: "S$", locale: "en-SG" }
};

export const REGIONS = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "UK", name: "United Kingdom", currency: "GBP" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SG", name: "Singapore", currency: "SGD" }
];

export function getCurrency(code) {
  return CURRENCIES[code] || CURRENCIES.INR;
}

export function isCurrency(code) {
  return !!CURRENCIES[code];
}

/* Alphabetic symbols like "AED" need a space before digits; $/₹ don't. */
export function curPrefix(code) {
  const s = getCurrency(code).symbol;
  return /^[A-Za-z]+$/.test(s) ? `${s} ` : s;
}

export function fmtNum(v, decimals = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "0";
  const n = Number(v);
  if (!isFinite(n)) return "\u221E";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

export function fmtMoney(v, currencyCode = "INR", decimals = 0) {
  const c = getCurrency(currencyCode);
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  const grouped = Math.abs(n).toLocaleString(c.locale, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  return sign + curPrefix(currencyCode) + grouped;
}

export function fmtCompactMoney(v, currencyCode = "INR") {
  const c = getCurrency(currencyCode);
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const s = curPrefix(currencyCode);
  if (c.code === "INR") {
    if (a >= 1e7) return `${sign}${s}${compactTrim(a / 1e7)} Cr`;
    if (a >= 1e5) return `${sign}${s}${compactTrim(a / 1e5)} L`;
    if (a >= 1e3) return `${sign}${s}${(a / 1e3).toFixed(0)}k`;
    return fmtMoney(n, currencyCode);
  }
  if (a >= 1e12) return `${sign}${s}${compactTrim(a / 1e12)}T`;
  if (a >= 1e9) return `${sign}${s}${compactTrim(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}${s}${compactTrim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}${s}${(a / 1e3).toFixed(0)}k`;
  return fmtMoney(n, currencyCode);
}
function compactTrim(n) {
  const t = n.toFixed(2);
  return t.replace(/\.?0+$/, "");
}

export function fmtPct(v, decimals = 1) {
  const n = Number(v) || 0;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: decimals })}%`;
}

export function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export function clamp(v, lo, hi) {
  const n = Number(v);
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/* -------------------------------------------------------------------------
   Money input parsing / formatting (single source of truth).
   The amount field keeps the RAW string the user is typing (rawInputValue)
   separate from the NUMBER used in calculations (numericValue). These helpers
   convert between them without ever forcing a reformat mid-keystroke.
   Accepts: "1000", "1,00,000", "₹1,00,000", "10k", "1.5L", "2Cr", "1,00,000.50"
   Returns NaN when nothing usable is present.
   ------------------------------------------------------------------------- */
export function parseAmountText(raw) {
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  // strip currency symbols / spaces / alphabetic codes (AED, USD, INR, ...)
  s = s.replace(/^(AED|USD|GBP|CAD|AUD|SGD|INR|EUR)\s*/i, "").replace(/[₹$£€¥\s]/g, "");
  if (!s) return NaN;
  const neg = /^-/.test(s);
  s = s.replace(/^[-+]/, "");
  // shorthand suffix (k/l/lakh/cr/crore/m/b) after a number
  const m = s.match(/^([\d.,]+)\s*(k|lakh|l|cr|crore|m|b)?\s*(%)?$/i);
  if (!m) return NaN;
  let num = m[1].replace(/,/g, "");
  if (!/^\d*\.?\d+$/.test(num)) return NaN;
  const v = Number(num);
  if (!Number.isFinite(v)) return NaN;
  const suf = (m[2] || "").toLowerCase();
  const mult = suf === "k" ? 1e3
    : suf === "l" || suf === "lakh" ? 1e5
      : suf === "cr" || suf === "crore" ? 1e7
        : suf === "m" ? 1e6
          : suf === "b" ? 1e9
            : 1;
  return (neg ? -1 : 1) * v * mult;
}

/* Grouped display for an input (no symbol): 1000000 + INR -> "10,00,000" */
export function fmtGrouped(v, currencyCode = "INR", decimals = 0) {
  const c = getCurrency(currencyCode);
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toLocaleString(c.locale, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

/* ---- basic time-value math (annual rate as a percent, e.g. 12 for 12%) ---- */
export const tvm = {
  fv(pv, ratePct, years) {
    return pv * Math.pow(1 + ratePct / 100, years);
  },
  pv(fv, ratePct, years) {
    return fv / Math.pow(1 + ratePct / 100, years);
  },
  cagr(begin, end, years) {
    if (begin <= 0 || years <= 0) return 0;
    return Math.pow(end / begin, 1 / years) - 1;
  },
  monthlyRate(ratePct) {
    return ratePct / 100 / 12;
  },
  /* SIP: fixed monthly deposit P for n months at monthly rate i, invested at start of month */
  sipFV(p, nMonths, annualRatePct) {
    const i = this.monthlyRate(annualRatePct);
    if (i === 0) return p * nMonths;
    return (p * (Math.pow(1 + i, nMonths) - 1) / i) * (1 + i);
  },
  /* annuity factor for computing required monthly deposit (same timing) */
  sipFactor(nMonths, annualRatePct) {
    const i = this.monthlyRate(annualRatePct);
    if (i === 0) return nMonths;
    return (Math.pow(1 + i, nMonths) - 1) / i * (1 + i);
  },
  emi(principal, annualRatePct, nMonths) {
    if (principal <= 0 || nMonths <= 0) return 0;
    const i = this.monthlyRate(annualRatePct);
    if (i === 0) return principal / nMonths;
    const f = Math.pow(1 + i, nMonths);
    return principal * i * f / (f - 1);
  },
  compound(p, annualRatePct, years, freq) {
    const m = freq || 1;
    if (p <= 0) return 0;
    if (m <= 0) return p * Math.pow(1 + annualRatePct / 100, years);
    return p * Math.pow(1 + annualRatePct / 100 / m, m * years);
  },
  /* monthly deposit growth (SIP-style) with a step-up of gPct per year.
     Deposit made at start of month m grows (nMonths - m + 1) months,
     matching the annuity-due convention used by sipFV. */
  sipStepUpFV(p, nMonths, annualRatePct, stepUpPct) {
    const i = this.monthlyRate(annualRatePct);
    const g = stepUpPct / 100;
    let fv = 0;
    for (let m = 1; m <= nMonths; m++) {
      const yearIdx = Math.floor((m - 1) / 12);
      const pmt = p * Math.pow(1 + g, yearIdx);
      fv += pmt * Math.pow(1 + i, nMonths - m + 1);
    }
    return fv;
  }
};

export function growingAnnuityDuePV(firstAnnual, inflationPct, returnPct, years) {
  const g = inflationPct / 100;
  const r = returnPct / 100;
  if (years <= 0) return firstAnnual;
  if (Math.abs(r - g) < 1e-9) return firstAnnual * years * (1 + r);
  return firstAnnual * (1 + r) / (r - g) * (1 - Math.pow((1 + g) / (1 + r), years));
}

/* =========================================================================
   Calculator registry
   ========================================================================= */
const num = (o, k, d = 0) => {
  const v = Number(o[k]);
  if (!isFinite(v)) return d;
  return v;
};

const moneyHead = (label, value, negative) => ({ label, value, kind: "money", negative });
const pctStat = (label, value, negative) => ({ label, value, kind: "pct", negative });
const numStat = (label, value, negative) => ({ label, value, kind: "num", negative });
const yrsStat = (label, value, negative) => ({ label, value, kind: "years", negative });
const monthsStat = (label, value, negative) => ({ label, value, kind: "months", negative });
const moneyStat = (label, value, negative) => ({ label, value, kind: "money", negative });

const areaCurve = (id, title, labels, series, colors) => ({
  type: "area", title,
  data: { labels, series: series.map((s) => ({ name: s.name, points: s.points, color: s.color })) },
  colors
});

const donut = (id, title, segments) => ({
  type: "donut", title,
  data: { segments: segments.map((s) => ({ name: s.name, value: Math.max(0, s.value), color: s.color })) }
});

const bars = (id, title, items) => ({ type: "bars", title, data: { items } });

/* ---- scenario overlay: for a numeric field, build +-delta curves ---- */
function scenarioSeries(baseInput, fieldKey, fieldDelta, nYears, buildFn) {
  const out = [];
  [baseInput[fieldKey] - fieldDelta, baseInput[fieldKey], baseInput[fieldKey] + fieldDelta].forEach((val) => {
    if (val <= 0) return;
    const inp = { ...baseInput, [fieldKey]: val };
    out.push(buildFn(inp, val));
  });
  return out;
}

function yearLabels(years) {
  const labels = [];
  for (let y = 0; y <= years; y++) labels.push(y === 0 ? "Today" : `Yr ${y}`);
  return labels;
}

/* =========================== 1. SIP =========================== */
const sipDef = {
  monthly: { key: "monthly", label: "Monthly investment", type: "money", def: 10000, min: 100, max: 500000, step: 500 },
  rate: { key: "rate", label: "Expected annual return", type: "pct", def: 12, min: 0, max: 30, step: 0.5 },
  years: { key: "years", label: "Investment period", type: "years", def: 10, min: 1, max: 40, step: 1 },
  stepUp: { key: "stepUp", label: "Annual step-up", type: "pct", def: 0, min: 0, max: 30, step: 1 }
};

function sipCompute(o) {
  const p = num(o, "monthly"); const rate = num(o, "rate");
  const years = num(o, "years", 10); const step = num(o, "stepUp");
  const n = Math.round(years * 12);
  const invested = p * n;
  const fv = step > 0 ? tvm.sipStepUpFV(p, n, rate, step) : tvm.sipFV(p, n, rate);
  const estRet = Math.max(0, fv - invested);
  const labels = yearLabels(Math.round(years));
  const investedSeries = labels.map((_, y) => p * Math.min(n, y * 12));
  const fvSeries = labels.map((_, y) => {
    const m = Math.min(n, y * 12);
    if (m <= 0) return 0;
    return step > 0 ? tvm.sipStepUpFV(p, m, rate, step) : tvm.sipFV(p, m, rate);
  });
  const scenario = scenarioSeries(o, "rate", 2, years, (inp, r) => {
    const m = Math.round(inp.years * 12);
    const st = num(inp, "stepUp");
    const perMonth = num(inp, "monthly");
    return {
      name: `${r}%`,
      points: labels.map((_, y) => {
        const mm = Math.min(m, y * 12);
        if (mm <= 0) return 0;
        return st > 0 ? tvm.sipStepUpFV(perMonth, mm, r, st) : tvm.sipFV(perMonth, mm, r);
      })
    };
  });
  const charts = [
    areaCurve("sipGrowth", "Wealth growth", labels, [
      { name: "Invested", points: investedSeries, color: "#8b95a5" },
      { name: "Value", points: fvSeries, color: "#16a34a" },
      ...scenario
    ])
  ];
  return {
    head: moneyHead("Projected value", fv),
    stats: [moneyStat("Amount invested", invested), moneyStat("Est. returns", estRet), pctStat("X of invested", invested > 0 ? fv / invested : 0)],
    charts, note: "SIPs compound on every rupee from month one. Step-up grows your instalment every year and lifts final wealth sharply."
  };
}

/* ========================= 2. Lump Sum ========================= */
function lumpCompute(o) {
  const p = num(o, "amount"); const rate = num(o, "rate"); const years = num(o, "years", 10);
  const fv = tvm.fv(p, rate, years);
  const gain = fv - p;
  const labels = yearLabels(Math.round(years));
  const curve = labels.map((_, y) => tvm.fv(p, rate, y));
  const scenario = scenarioSeries(o, "rate", 2, years, (inp, r) => ({
    name: `${r}%`,
    points: labels.map((_, y) => tvm.fv(p, r, y))
  }));
  const charts = [
    areaCurve("lumpGrowth", "Growth of a one-time investment", labels, [
      { name: "Invested", points: labels.map(() => p), color: "#8b95a5" },
      { name: "Value", points: curve, color: "#16a34a" },
      ...scenario
    ]),
    donut("lumpSplit", "Where the money comes from", [
      { name: "Principal", value: p, color: "#3b82f6" },
      { name: "Returns", value: Math.max(0, gain), color: "#16a34a" }
    ])
  ];
  return {
    head: moneyHead("Future value", fv),
    stats: [moneyStat("Principal", p), moneyStat("Total returns", Math.max(0, gain)), pctStat("Return on investment", p > 0 ? gain / p * 100 : 0)],
    charts
  };
}

/* ===================== 3. Compound Interest ===================== */
function compoundCompute(o) {
  const p = num(o, "principal"); const rate = num(o, "rate");
  const years = num(o, "years", 10); const freq = num(o, "freq", 12);
  const add = num(o, "monthlyAdd");
  const monthsTotal = Math.round(years * 12);
  const contributions = add * monthsTotal;
  const labels = yearLabels(Math.round(years));
  const fvSeries = [];
  for (let y = 0; y <= Math.round(years); y++) {
    let v = tvm.compound(p, rate, y, freq);
    if (add > 0) v += tvm.sipFV(add, Math.min(Math.round(y * 12), monthsTotal), rate);
    fvSeries.push(v);
  }
  const total = fvSeries[fvSeries.length - 1];
  const interestEarned = Math.max(0, total - p - contributions);
  const donutSegs = [{ name: "Principal", value: p, color: "#3b82f6" }];
  const stats = [moneyStat("Principal", p)];
  if (add > 0) {
    donutSegs.push({ name: "Contributions", value: contributions, color: "#8b5cf6" });
    stats.push(moneyStat("Contributions", contributions));
  }
  donutSegs.push({ name: "Interest", value: interestEarned, color: "#f59e0b" });
  stats.push(moneyStat("Interest earned", interestEarned));
  const charts = [
    areaCurve("ciGrowth", "Compound growth", labels, [
      { name: "Principal", points: labels.map(() => p), color: "#3b82f6" },
      { name: "Total value", points: fvSeries, color: "#16a34a" }
    ]),
    donut("ciSplit", "What makes up the final balance", donutSegs)
  ];
  return {
    head: moneyHead("Final balance", total),
    stats,
    charts, note: "More frequent compounding (monthly > quarterly > yearly) earns extra interest on interest. Monthly additions compound alongside the principal."
  };
}

/* ========================= 4. EMI / Loan ========================= */
function emiCompute(o) {
  const P = num(o, "amount"); const rate = num(o, "rate");
  const years = num(o, "years", 5);
  const n = Math.round(years * 12);
  const e = tvm.emi(P, rate, n);
  const total = e * n;
  const interest = total - P;
  const perYear = [];
  let bal = P;
  const i = rate / 100 / 12;
  for (let y = 1; y <= Math.round(years); y++) {
    let principalY = 0; let interestY = 0;
    const lim = Math.min(12, n - (y - 1) * 12);
    for (let m = 0; m < lim; m++) {
      const ip = bal * i;
      const pp = e - ip;
      interestY += ip; principalY += pp; bal -= pp;
    }
    perYear.push({ year: y, principal: Math.max(0, principalY), interest: Math.max(0, interestY), balance: Math.max(0, bal) });
  }
  const charts = [
    bars("emiYear", "Yearly principal vs interest", perYear),
    donut("emiSplit", "Loan repaid breakdown", [
      { name: "Principal", value: P, color: "#3b82f6" },
      { name: "Total interest", value: Math.max(0, interest), color: "#ef4444" }
    ])
  ];
  return {
    head: moneyHead("Monthly EMI", e),
    stats: [moneyStat("Total payment", total), moneyStat("Total interest", interest), pctStat("Interest share", total > 0 ? interest / total * 100 : 0)],
    charts, note: "EMI = P x r x (1+r)^n / ((1+r)^n - 1). Early EMIs pay mostly interest; the principal share grows later."
  };
}

/* ======================= 5. Mortgage ======================= */
function mortgageCompute(o) {
  const price = num(o, "price"); const downPct = num(o, "down");
  const rate = num(o, "rate"); const years = num(o, "years", 20);
  const tax = num(o, "tax"); const ins = num(o, "insurance");
  const loan = price * (1 - downPct / 100);
  const n = Math.round(years * 12);
  const e = tvm.emi(loan, rate, n);
  const extra = (tax + ins) / 12;
  const total = e * n;
  const interest = total - loan;
  const charts = [
    donut("mortSplit", "Cost breakdown", [
      { name: "Down payment", value: price - loan, color: "#6366f1" },
      { name: "Loan principal", value: loan, color: "#3b82f6" },
      { name: "Interest", value: Math.max(0, interest), color: "#ef4444" }
    ]),
    bars("mortYear", "Principal vs interest by year", (() => {
      const perYear = []; let bal = loan; const i = rate / 100 / 12;
      for (let y = 1; y <= Math.round(years); y++) {
        let pr = 0; let it = 0; const lim = Math.min(12, n - (y - 1) * 12);
        for (let m = 0; m < lim; m++) { const ip = bal * i; const pp = e - ip; it += ip; pr += pp; bal -= pp; }
        perYear.push({ year: y, principal: Math.max(0, pr), interest: Math.max(0, it), balance: Math.max(0, bal) });
      }
      return perYear;
    })())
  ];
  return {
    head: moneyHead("Monthly payment", e + extra),
    stats: [
      moneyStat("Loan amount", loan),
      moneyStat("EMI (principal + interest)", e),
      moneyStat("Tax & insurance", extra),
      moneyStat("Total interest", Math.max(0, interest))
    ],
    charts, note: "Total monthly cost = EMI plus annual property tax and insurance divided over 12 months."
  };
}

/* ===================== 6. Retirement ===================== */
function retirementCompute(o) {
  const ageNow = num(o, "ageNow", 30); const ageRet = num(o, "ageRet", 60);
  const monthlyToday = num(o, "monthly", 60000); const infl = num(o, "inflation", 6);
  const retRate = num(o, "retRate", 8); const wdRate = num(o, "wdRate", 6);
  const corpusNow = num(o, "corpus", 0); const monthlySave = num(o, "save", 10000);
  const lifeExp = num(o, "lifeExp", 85);
  const toRetire = Math.max(1, ageRet - ageNow);
  const monthlyAtRet = monthlyToday * Math.pow(1 + infl / 100, toRetire);
  const yearsOfWd = Math.max(1, lifeExp - ageRet);
  const corpusNeeded = growingAnnuityDuePV(monthlyAtRet * 12, infl, wdRate, yearsOfWd);
  const fvCorpus = corpusNow > 0 ? tvm.fv(corpusNow, retRate, toRetire) : 0;
  const fvSave = monthlySave > 0 ? tvm.sipFV(monthlySave, toRetire * 12, retRate) : 0;
  const projected = fvCorpus + fvSave;
  const gap = Math.max(0, corpusNeeded - projected);
  const factor = tvm.sipFactor(toRetire * 12, retRate);
  const neededMonthly = factor > 0 ? gap / factor : 0;
  const labels = [];
  const corpusCurve = [];
  const yearsToPlot = Math.round(lifeExp - ageNow);
  for (let y = 0; y <= yearsToPlot; y++) {
    labels.push(y === 0 ? `Age ${ageNow}` : `Age ${ageNow + y}`);
    if (y <= toRetire) {
      corpusCurve.push((corpusNow > 0 ? tvm.fv(corpusNow, retRate, y) : 0) + (monthlySave > 0 ? tvm.sipFV(monthlySave, y * 12, retRate) : 0));
    } else {
      corpusCurve.push(0);
    }
  }
  let pot = corpusCurve[toRetire];
  for (let y = toRetire + 1; y <= yearsToPlot; y++) {
    const s = y - toRetire - 1;
    const wd = monthlyAtRet * 12 * Math.pow(1 + infl / 100, s);
    pot = Math.max(0, (pot - wd) * (1 + wdRate / 100));
    corpusCurve[y] = pot;
  }
  const charts = [
    areaCurve("retCorpus", "Corpus across your lifetime", labels, [
      { name: "Corpus", points: corpusCurve, color: "#6366f1" }
    ]),
    donut("retNeed", "Retirement income need", [
      { name: "Corpus you need", value: corpusNeeded, color: "#6366f1" },
      { name: "Corpus you'll build", value: Math.min(corpusNeeded, projected), color: "#16a34a" }
    ])
  ];
  return {
    head: moneyHead("Corpus needed at retirement", corpusNeeded),
    stats: [
      moneyStat("Monthly income needed at retirement", monthlyAtRet),
      moneyStat("Projected corpus", projected),
      moneyStat("Gap", gap),
      moneyStat("Extra monthly saving to close gap", neededMonthly)
    ],
    charts, note: "Model assumes expenses grow with inflation and your withdrawal pot earns the post-retirement return while paying you."
  };
}

/* ========================= 7. FD ========================= */
function fdCompute(o) {
  const p = num(o, "amount"); const rate = num(o, "rate", 7);
  const years = num(o, "years", 5); const freq = num(o, "freq", 4);
  const mature = tvm.compound(p, rate, years, freq);
  const interest = mature - p;
  const effYield = (Math.pow(1 + rate / 100 / freq, freq) - 1) * 100;
  const charts = [
    areaCurve("fdGrowth", "FD maturity growth", yearLabels(Math.round(years)), [
      { name: "Deposit", points: yearLabels(Math.round(years)).map(() => p), color: "#3b82f6" },
      { name: "Maturity value", points: yearLabels(Math.round(years)).map((_, y) => tvm.compound(p, rate, y, freq)), color: "#16a34a" }
    ]),
    donut("fdSplit", "Interest vs deposit", [
      { name: "Principal", value: p, color: "#3b82f6" },
      { name: "Interest", value: Math.max(0, interest), color: "#f59e0b" }
    ])
  ];
  return {
    head: moneyHead("Maturity amount", mature),
    stats: [moneyStat("Invested", p), moneyStat("Interest earned", Math.max(0, interest)), pctStat("Effective annual yield", effYield)],
    charts, note: "Banks typically compound FD interest quarterly. The effective yield is slightly higher than the quoted rate."
  };
}

/* ========================= 8. PPF ========================= */
function ppfCompute(o) {
  const annual = num(o, "annual", 150000); const rate = num(o, "rate", 7.1);
  const years = num(o, "years", 15); const balance = num(o, "balance", 0);
  const labels = []; const balSeries = []; const investedSeries = [];
  let bal = balance; let invested = balance; let maxAnnual = annual;
  for (let y = 0; y <= Math.round(years); y++) {
    labels.push(y === 0 ? "Start" : `Yr ${y}`);
    if (y === 0) { balSeries.push(balance); investedSeries.push(balance); continue; }
    bal = bal * (1 + rate / 100) + maxAnnual;
    invested += maxAnnual;
    balSeries.push(bal); investedSeries.push(invested);
  }
  const mature = bal;
  const interest = mature - invested;
  const charts = [
    areaCurve("ppfGrowth", "PPF balance over time", labels, [
      { name: "Deposited", points: investedSeries, color: "#8b95a5" },
      { name: "Maturity value", points: balSeries, color: "#16a34a" }
    ]),
    donut("ppfSplit", "Principal vs interest", [
      { name: "Total deposited", value: invested, color: "#3b82f6" },
      { name: "Interest (tax-free)", value: Math.max(0, interest), color: "#f59e0b" }
    ])
  ];
  return {
    head: moneyHead("PPF maturity value", mature),
    stats: [moneyStat("Total deposited", invested), moneyStat("Tax-free interest", Math.max(0, interest)), pctStat("Interest share", invested > 0 ? interest / invested * 100 : 0)],
    charts, note: "PPF compounds annually and the entire corpus is exempt under EEE (Exempt-Exempt-Exempt)."
  };
}

/* ===================== 9. GST / Tax ===================== */
function gstCompute(o) {
  const amount = num(o, "amount"); const rate = num(o, "rate", 18);
  const mode = o.mode === "inclusive" ? "inclusive" : "exclusive";
  let net, tax, total;
  if (mode === "exclusive") { net = amount; tax = amount * rate / 100; total = net + tax; }
  else { total = amount; net = amount * 100 / (100 + rate); tax = total - net; }
  const charts = [
    donut("gstSplit", "Net amount vs GST", [
      { name: "Net value", value: net, color: "#3b82f6" },
      { name: "GST", value: tax, color: "#8b5cf6" }
    ])
  ];
  return {
    head: moneyHead(mode === "exclusive" ? "Total including GST" : "Net value (before GST)", mode === "exclusive" ? total : net),
    stats: [moneyStat(mode === "exclusive" ? "Net value" : "Total including GST", mode === "exclusive" ? net : total), moneyStat("GST amount", tax), pctStat("GST rate", rate)],
    charts, note: `Add GST to a price with "exclusive" mode, or back-out GST from an invoice total with "inclusive" mode.`
  };
}

/* ===================== 10. Inflation ===================== */
function inflationCompute(o) {
  const amount = num(o, "amount"); const rate = num(o, "rate", 6);
  const years = num(o, "years", 20); const direction = o.direction === "past" ? "past" : "future";
  const inYears = tvm.fv(amount, rate, years);
  const valueToday = tvm.pv(amount, rate, years);
  let headValue, note;
  if (direction === "future") {
    headValue = inYears;
    note = `Today's ${fmtMoney(amount)} buys about ${fmtMoney(headValue)} worth of the same goods in ${years} years at ${rate}% inflation - you need ${fmtMoney(Math.max(0, inYears - amount))} more to keep up.`;
  } else {
    headValue = valueToday;
    note = `${fmtMoney(amount)} in ${years} years buys what only about ${fmtMoney(headValue)} buys today at ${rate}% inflation - a ${fmtMoney(Math.max(0, amount - valueToday))} loss of purchasing power.`;
  }
  const labels = yearLabels(Math.round(years));
  const trend = labels.map((_, y) => tvm.fv(direction === "future" ? amount : valueToday, rate, y));
  const todayBars = direction === "future" ? amount : valueToday;
  const laterBars = direction === "future" ? inYears : amount;
  const charts = [
    areaCurve("inflTrend", "Rising cost over time", labels, [
      { name: "Value", points: trend, color: "#ef4444" }
    ]),
    bars("inflBuy", "Money now vs money later", [
      { name: "Same money today", value: todayBars, color: "#3b82f6" },
      { name: "Equivalent later", value: laterBars, color: "#8b95a5" }
    ].map((b) => ({ year: b.name, principal: b.value, interest: 0, balance: b.value })))
  ];
  const result = {
    head: moneyHead(direction === "future" ? "Future cost" : "Value in today's money", headValue),
    stats: [
      moneyStat(direction === "future" ? "Today's amount" : "Amount at that future date", amount),
      moneyStat("Purchasing power gap", direction === "future" ? Math.max(0, inYears - amount) : Math.max(0, amount - valueToday), true)
    ],
    charts, note
  };
  return result;
}

/* ================= 11. Investment Return ================= */
function investmentReturnCompute(o) {
  const initial = num(o, "initial"); const final = num(o, "final");
  const years = num(o, "years", 3); const monthly = num(o, "monthly", 0);
  const totalPut = initial + (monthly > 0 ? monthly * Math.round(years * 12) : 0);
  const gain = final - totalPut;
  const roi = totalPut > 0 ? gain / totalPut * 100 : 0;
  const cagr = initial > 0 && monthly === 0 ? tvm.cagr(initial, final, years) * 100 : null;
  const charts = [
    donut("retSplit", "Invested vs gain", [
      { name: "Amount invested", value: totalPut, color: "#3b82f6" },
      { name: "Profit / loss", value: Math.abs(gain), color: gain >= 0 ? "#16a34a" : "#ef4444" }
    ])
  ];
  const stats = [moneyStat("Amount invested", totalPut), moneyStat("Absolute return", gain, gain < 0), pctStat("Return on investment", roi, roi < 0)];
  if (cagr !== null) stats.push(pctStat("CAGR", cagr, cagr < 0));
  return { head: moneyHead("Current value", final), stats, charts, note: "ROI shows simple gain vs money put in. CAGR annualises it only when there are no periodic deposits." };
}

/* ===================== 12. CAGR ===================== */
function cagrCompute(o) {
  const begin = num(o, "begin"); const end = num(o, "end"); const years = num(o, "years", 5);
  const c = tvm.cagr(begin, end, years) * 100;
  const totalReturn = begin > 0 ? (end - begin) / begin * 100 : 0;
  const simple = begin > 0 ? (end - begin) / years / begin * 100 : 0;
  const charts = [
    areaCurve("cagrCurve", "Hypothetical growth at CAGR", yearLabels(Math.round(years)), [
      { name: `CAGR ${c.toFixed(2)}%`, points: yearLabels(Math.round(years)).map((_, y) => tvm.fv(begin, c, y)), color: "#16a34a" },
      { name: "Linear growth", points: yearLabels(Math.round(years)).map((_, y) => begin + (end - begin) * (y / Math.max(1, years))), color: "#8b95a5" }
    ])
  ];
  return {
    head: { label: "CAGR", value: c, kind: "pct" },
    stats: [pctStat("Total return", totalReturn), pctStat("Simple average return", simple)],
    charts, note: "CAGR = (End / Begin)^(1 / years) - 1. It smooths volatility into one annual growth number."
  };
}

/* ================== 13. Stock Position Size ================== */
function positionSizeCompute(o) {
  const balance = num(o, "balance"); const riskPct = num(o, "riskPct", 1);
  const entry = num(o, "entry"); const stop = num(o, "stop");
  const riskMoney = balance * riskPct / 100;
  const riskPerShare = Math.abs(entry - stop);
  const shares = riskPerShare > 0 ? Math.floor(riskMoney / riskPerShare) : 0;
  const posValue = shares * entry;
  const riskPctOfPos = posValue > 0 ? riskMoney / posValue * 100 : 0;
  const charts = [
    donut("posSplit", "How your risk is deployed", [
      { name: "Capital at risk", value: riskMoney, color: "#ef4444" },
      { name: "Remaining capital", value: Math.max(0, balance - riskMoney), color: "#3b82f6" }
    ]),
    bars("posLevels", "Entry vs stop distance", [
      { year: "Entry", principal: entry, interest: 0, balance: entry, color: "#16a34a" },
      { year: "Stop", principal: stop, interest: 0, balance: stop, color: "#ef4444" }
    ])
  ];
  return {
    head: numStat("Shares to buy", shares),
    stats: [moneyStat("Capital you risk", riskMoney), moneyStat("Position value", posValue), pctStat("Risk as % of position", riskPctOfPos), moneyStat("Per-share risk", riskPerShare)],
    charts, note: "Never risk more than a fixed small % of your account. Position size = (Account x Risk%) / (Entry - Stop)."
  };
}

/* ==================== 14. Risk / Reward ==================== */
function riskRewardCompute(o) {
  const entry = num(o, "entry"); const stop = num(o, "stop"); const target = num(o, "target");
  const qty = num(o, "qty", 0); const balance = num(o, "balance", 0); const riskPct = num(o, "riskPct", 1);
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rr = risk > 0 ? reward / risk : 0;
  const perShareRR = rr;
  let riskMoney = balance > 0 ? balance * riskPct / 100 : 0;
  if (qty > 0) riskMoney = qty * risk;
  const winAmt = qty > 0 ? reward * qty : 0;
  const charts = [
    bars("rrCompare", "Risk vs reward per unit", [
      { year: "Risk", principal: risk, interest: 0, balance: risk, color: "#ef4444" },
      { year: "Reward", principal: reward, interest: 0, balance: reward, color: "#16a34a" }
    ])
  ];
  const stats = [numStat("Reward : Risk", rr, false)];
  if (qty > 0) { stats.push(moneyStat("Dollar amount risked", riskMoney)); stats.push(moneyStat("Potential profit at target", winAmt)); }
  return {
    head: { label: "Risk / Reward ratio", value: rr, kind: "ratio" },
    stats,
    charts, note: "A 1:2 trade risks one unit to make two. Aim for setups whose reward clearly outweighs the risk."
  };
}

/* ==================== 15. Profit & Loss ==================== */
function pnlCompute(o) {
  const buy = num(o, "buy"); const sell = num(o, "sell"); const qty = num(o, "qty");
  const buyFee = num(o, "buyFee", 0); const sellFee = num(o, "sellFee", 0);
  const cost = buy * qty + buyFee;
  const proceeds = sell * qty - sellFee;
  const pnl = proceeds - cost;
  const pnlPct = cost > 0 ? pnl / cost * 100 : 0;
  const charts = [
    donut("pnlSplit", "Cost vs proceeds", [
      { name: "Total cost", value: cost, color: "#ef4444" },
      { name: "Sale proceeds", value: proceeds, color: pnl >= 0 ? "#16a34a" : "#8b95a5" }
    ])
  ];
  return {
    head: moneyHead("Profit / loss", pnl, pnl < 0),
    stats: [moneyStat("Total cost (incl. fees)", cost), moneyStat("Sale proceeds (less fees)", proceeds), pctStat("Return", pnlPct, pnl < 0)],
    charts, note: "P&L = (Sell x Qty - sell fees) - (Buy x Qty + buy fees). Fees matter more on small trades."
  };
}

/* ==================== 16. Savings Goal ==================== */
function monthsToReach(target, current, monthly, annualRatePct) {
  if (target <= current) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return monthly > 0 ? Math.ceil((target - current) / monthly) : null;
  const A = 1 + i;
  const perTerm = monthly * A / i;
  const den = current + perTerm;
  if (den <= 0) return null;
  const ratio = (target + perTerm) / den;
  if (ratio <= 1) return 0;
  return Math.ceil(Math.log(ratio) / Math.log(A));
}

function savingsGoalCompute(o) {
  const target = num(o, "target"); const current = num(o, "current", 0);
  const monthly = num(o, "monthly"); const rate = num(o, "rate", 7);
  const months = monthsToReach(target, current, monthly, rate);
  const reachable = months !== null;
  const m = reachable ? months : 0;
  const i = rate / 100 / 12;
  const A = 1 + i;
  const invested = current + monthly * m;
  const achieved = i === 0
    ? invested
    : current * Math.pow(A, m) + (monthly > 0 ? monthly * (Math.pow(A, m) - 1) / i * A : 0);
  const interest = Math.max(0, achieved - invested);
  const years = m / 12;
  const maxPts = reachable ? Math.max(1, Math.round(m / 12)) : 60;
  const labels = []; const proj = [];
  const horizon = Math.min(maxPts, 120);
  for (let y = 0; y <= horizon; y++) {
    labels.push(y === 0 ? "Now" : `Yr ${y}`);
    proj.push(tvm.sipFV(monthly, Math.min(m, y * 12), rate) + (current > 0 ? tvm.fv(current, rate, y) : 0));
  }
  const charts = [
    areaCurve("goalPath", "Progress to your goal", labels, [
      { name: "Projected", points: proj, color: "#16a34a" },
      { name: "Goal", points: labels.map(() => target), color: "#8b5cf6" }
    ])
  ];
  const stats = [moneyStat("Total you will invest", invested), moneyStat("Interest earned", interest), monthsStat("In months", reachable ? m : null)];
  return {
    head: reachable
      ? { label: "Time to reach goal", value: years, kind: "years" }
      : { label: "Goal not reachable", value: 0, kind: "text", negative: true },
    stats,
    charts, note: reachable
      ? "Saving beats the clock: let compounding pull your deadline closer as your monthly amount or return rises."
      : "Raise your monthly saving or rate (or reduce the goal) - with nothing growing toward it the goal is never reached."
  };
}

/* ==================== 17. Net Worth ==================== */
function netWorthCompute(o) {
  const assets = (o.assets || []).map((a) => ({ name: a.name, value: num(a, "value") }));
  const liabilities = (o.liabilities || []).map((a) => ({ name: a.name, value: num(a, "value") }));
  const totalA = assets.reduce((s, a) => s + a.value, 0);
  const totalL = liabilities.reduce((s, a) => s + a.value, 0);
  const net = totalA - totalL;
  const assetsSeg = assets.filter((a) => a.value > 0).map((a, idx) => ({
    name: a.name, value: a.value, color: ["#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"][idx % 6]
  }));
  const charts = [
    donut("nwAssets", "Asset allocation", assetsSeg),
    bars("nwTotal", "Assets vs liabilities", [
      { year: "Assets", principal: totalA, interest: 0, balance: totalA, color: "#16a34a" },
      { year: "Liabilities", principal: totalL, interest: 0, balance: totalL, color: "#ef4444" },
      { year: "Net worth", principal: net, interest: 0, balance: net, color: "#6366f1" }
    ])
  ];
  return {
    head: moneyHead("Net worth", net, net < 0),
    stats: [moneyStat("Total assets", totalA), moneyStat("Total liabilities", totalL), numStat("Asset classes", assets.length), numStat("Debt accounts", liabilities.length)],
    charts, note: "Net worth = total assets - total liabilities. Track it quarterly to see the trend, not day-to-day noise."
  };
}

/* =========================================================================
   Shared solvers + amortization (P3 calculators)
   ========================================================================= */
/* Annual rate (%) for monthly deposits pmt over nMonths to hit target */
function solveSipRate(pmt, nMonths, target) {
  if (pmt <= 0 || nMonths <= 0 || target <= 0) return 0;
  const f = (pct) => tvm.sipFV(pmt, nMonths, pct);
  if (f(0) >= target) return 0;
  let hi = 1;
  while (f(hi) < target && hi < 1e5) hi *= 2;
  let lo = 0;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
  }
  return lo;
}

/* Outstanding balance after `months` of `totalMonths` EMIs (reducing balance) */
function balanceAfter(principal, annualPct, months, totalMonths) {
  if (months <= 0) return principal;
  if (months >= totalMonths) return 0;
  const i = tvm.monthlyRate(annualPct);
  if (i === 0) return principal * (1 - months / totalMonths);
  const fi = Math.pow(1 + i, totalMonths);
  return principal * (fi - Math.pow(1 + i, months)) / (fi - 1);
}

/* Months to clear balance at a fixed monthly payment (Infinity if payment <= interest) */
function clearMonths(balance, annualPct, payment) {
  if (balance <= 0) return 0;
  if (payment <= 0) return Infinity;
  const i = tvm.monthlyRate(annualPct);
  if (i === 0) return Math.ceil(balance / payment);
  const ip = balance * i;
  if (payment <= ip) return Infinity;
  return Math.ceil(-Math.log(1 - ip / payment) / Math.log(1 + i));
}

/* Months to grow start + monthly deposits to target at annual rate */
function solveMonthsTo(deposit, annualPct, start, target) {
  if (target <= 0) return 0;
  const f = (n) => start * Math.pow(1 + annualPct / 100, n / 12) + tvm.sipFV(deposit, Math.max(0, Math.round(n)), annualPct);
  if (f(0) >= target) return 0;
  let hi = 24;
  while (f(hi) < target && hi < 36000) hi *= 2;
  if (f(hi) < target) return Infinity;
  let lo = 0;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
  }
  return lo;
}

const PALETTE = ["#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"];

/* =========================== 18. Real return =========================== */
function realReturnCompute(o) {
  const nominal = num(o, "nominal", 8);
  const inflation = num(o, "inflation", 6);
  const real = inflation < -100 ? 0 : (1 + nominal / 100) / (1 + inflation / 100) - 1;
  return {
    head: pctStat("Real return", real * 100, real < 0),
    stats: [pctStat("Nominal return", nominal), pctStat("Inflation", inflation), moneyStat("Buying power lost per lakh", 100000 * (1 - 1 / (1 + inflation / 100)))],
    charts: [],
    note: "Real return = (1 + nominal) / (1 + inflation) - 1. This is the growth after inflation erodes purchasing power."
  };
}

/* ======================= 19. Expense ratio impact ======================= */
function expenseRatioCompute(o) {
  const p = num(o, "principal", 500000);
  const rate = num(o, "rate", 10);
  const years = clamp(num(o, "years", 20), 1, 50);
  const exp = clamp(num(o, "expense", 1), 0, 5);
  const clean = tvm.fv(p, rate, years);
  const net = rate - exp;
  const withFee = tvm.fv(p, Math.max(0, net), years);
  const labels = yearLabels(years);
  const pts = (r) => labels.map((_, y) => Math.round(p * Math.pow(1 + r / 100, y)));
  return {
    head: moneyHead("Final value (after fees)", withFee),
    stats: [moneyStat("Value without fees", clean), moneyStat("Fees drag over the period", clean - withFee), pctStat("Effective return", net)],
    charts: [areaCurve("ef", "Impact of fees on your growth", labels, [
      { name: "Without fees", points: pts(rate), color: "#16a34a" },
      { name: `With ${exp}% fees`, points: pts(Math.max(0, net)), color: "#ef4444" }
    ])],
    note: "Fund fees compound just like returns. A 1% expense ratio on a 10% return over 20 years costs a meaningful slice of your final wealth."
  };
}

/* ============================== 20. SWP =============================== */
function swpCompute(o) {
  const corpus = num(o, "corpus", 20000000);
  const rate = num(o, "rate", 8);
  const years = clamp(num(o, "years", 25), 1, 50);
  const growth = num(o, "growth", 6);
  const factor = growingAnnuityDuePV(1, growth, rate, years);
  const firstAnnual = factor > 0 ? corpus / factor : corpus;
  const firstMonthly = firstAnnual / 12;
  let bal = corpus, wd = firstAnnual, totalWd = 0;
  const labels = yearLabels(years);
  const balPts = [Math.round(bal)];
  for (let y = 1; y <= Math.round(years); y++) {
    bal = bal * (1 + rate / 100) - wd;
    totalWd += wd;
    wd *= (1 + growth / 100);
    balPts.push(Math.max(0, Math.round(bal)));
  }
  return {
    head: moneyHead("Monthly income (year 1)", firstMonthly),
    stats: [moneyHead("Annual income (year 1)", firstAnnual), moneyHead("Total withdrawn", totalWd), monthsStat("Income period", years * 12)],
    charts: [areaCurve("swp", "Corpus while withdrawing", labels, [
      { name: "Corpus balance", points: balPts, color: "#6366f1" }
    ])],
    note: "Assumes withdrawals rise by the stated annual growth rate and the remaining corpus earns the post-retirement return. Not a guarantee."
  };
}

/* ============================== 21. XIRR ============================== */
function xirrCompute(o) {
  const pmt = num(o, "monthly", 10000);
  const years = clamp(num(o, "years", 5), 1, 40);
  const final = num(o, "final", 800000);
  const nMonths = Math.round(years * 12);
  const invested = pmt * nMonths;
  const rate = solveSipRate(pmt, nMonths, final);
  const labels = yearLabels(years);
  const proj = tvm.sipFV(pmt, Math.round(years * 12), rate);
  const curve = labels.map((_, y) => Math.round(tvm.sipFV(pmt, Math.min(nMonths, Math.round(y * 12)), rate)));
  const invPts = labels.map((_, y) => Math.round(pmt * Math.min(nMonths, Math.round(y * 12))));
  return {
    head: pctStat("Annualized return (XIRR)", rate),
    stats: [moneyStat("Total invested", invested), moneyStat("Gain", final - invested, final < invested), pctStat("Return on invested", invested ? (final - invested) / invested * 100 : 0, final < invested)],
    charts: [areaCurve("xirr", "Growth implied by your final value", labels, [
      { name: "Invested", points: invPts, color: "#8b95a5" },
      { name: `Value at ~${rate.toFixed(2)}%`, points: curve, color: "#16a34a" }
    ])],
    note: `XIRR is the annual rate that turns regular ${fmtNum(pmt)}-per-month investments into your stated final value. Here it solves to about ${rate.toFixed(2)}% p.a.`
  };
}

/* ============================== 22. STP =============================== */
function stpCompute(o) {
  const transfer = num(o, "transfer", 20000);
  const years = clamp(num(o, "years", 5), 1, 40);
  const rate = num(o, "rate", 10);
  const srcRate = num(o, "srcRate", 6);
  const nMonths = Math.round(years * 12);
  const total = transfer * nMonths;
  const iR = tvm.monthlyRate(rate);
  const iS = tvm.monthlyRate(srcRate);
  let src = total, fund = 0, moved = 0, fundPts = [0];
  const labels = yearLabels(years);
  for (let m = 1; m <= nMonths; m++) {
    const t = Math.min(transfer, src);
    src -= t;
    fund += t;
    moved += t;
    fund *= (1 + iR);
    src *= (1 + iS);
    if (m % 12 === 0) fundPts.push(Math.round(fund));
  }
  while (fundPts.length < labels.length) fundPts.push(Math.round(fund));
  const finalVal = fund + src;
  return {
    head: moneyHead("Final value (fund + source)", finalVal),
    stats: [moneyStat("Value in target fund", fund), moneyStat("Value left in source", src), moneyStat("Total transferred", moved)],
    charts: [areaCurve("stp", "Money moved into the target fund", labels, [
      { name: "Fund value", points: fundPts, color: "#16a34a" }
    ])],
    note: "STP moves a lump sum into a fund in monthly tranches. Transferred amounts then grow at the fund rate; money still in the source keeps earning the (usually lower) source return."
  };
}

/* ========================= Home loan prepayment ========================= */
function homeLoanPrepayCompute(o) {
  const P = num(o, "amount", 3000000);
  const rate = num(o, "rate", 8.5);
  const years = clamp(num(o, "years", 20), 1, 40);
  const n = Math.round(years * 12);
  const emi = tvm.emi(P, rate, n);
  const prepay = num(o, "prepay", 500000);
  const atYear = clamp(num(o, "atYear", 5), 1, years);
  const k = Math.round(atYear * 12);
  const totalBase = emi * n - P;
  const b0 = balanceAfter(P, rate, k, n);
  const newBal = Math.max(0, b0 - prepay);
  const oldRemaining = emi * (n - k) - b0;
  let newMonths = clearMonths(newBal, rate, emi);
  let interestSaved = oldRemaining;
  if (isFinite(newMonths)) {
    const newRemaining = emi * newMonths - newBal;
    interestSaved = oldRemaining - newRemaining;
  } else {
    newMonths = n - k;
  }
  return {
    head: moneyHead("Interest saved", Math.max(0, interestSaved), interestSaved < 0),
    stats: [moneyStat("Monthly EMI (unchanged)", emi), monthsStat("Loan closes early by", (n - k) - newMonths), moneyStat("Balance before prepayment", b0), moneyStat("Original total interest", totalBase)],
    charts: [bars("hp", "Total interest: before vs after", [
      { year: "Without prepayment", principal: 0, interest: 0, balance: totalBase, color: "#ef4444" },
      { year: "With prepayment", principal: 0, interest: 0, balance: Math.max(0, totalBase - Math.max(0, interestSaved)), color: "#16a34a" }
    ])],
    note: "A one-time principal payment lowers the balance; the same EMI then clears the loan faster and cuts total interest. Banks may charge a prepayment fee on some loans."
  };
}

/* =========================== Loan comparison =========================== */
function loanCompareCompute(o) {
  const P = num(o, "amount", 1000000);
  const rA = num(o, "rateA", 8);
  const yA = clamp(num(o, "yearsA", 5), 1, 40);
  const rB = num(o, "rateB", 9.5);
  const yB = clamp(num(o, "yearsB", 7), 1, 40);
  const eA = tvm.emi(P, rA, Math.round(yA * 12));
  const eB = tvm.emi(P, rB, Math.round(yB * 12));
  const iA = eA * Math.round(yA * 12) - P;
  const iB = eB * Math.round(yB * 12) - P;
  const labels = yearLabels(Math.max(yA, yB));
  const balA = labels.map((_, y) => Math.round(balanceAfter(P, rA, Math.min(Math.round(y * 12), Math.round(yA * 12)), Math.round(yA * 12))));
  const balB = labels.map((_, y) => Math.round(balanceAfter(P, rB, Math.min(Math.round(y * 12), Math.round(yB * 12)), Math.round(yB * 12))));
  return {
    head: moneyHead("Loan A - monthly EMI", eA),
    stats: [moneyStat("Loan B - monthly EMI", eB), moneyStat("Total interest - A", iA), moneyStat("Total interest - B", iB), moneyStat("Interest difference", iB - iA, iB < iA)],
    charts: [areaCurve("lc", "Outstanding balance over time", labels, [
      { name: `Loan A (${rA}% / ${yA} yr)`, points: balA, color: "#16a34a" },
      { name: `Loan B (${rB}% / ${yB} yr)`, points: balB, color: "#ef4444" }
    ])],
    note: "Compare apples to apples: a lower rate can lose to a shorter tenure on total interest. Check both EMI and total cost before choosing."
  };
}

/* ============================ Debt payoff ============================ */
function debtPayoffCompute(o) {
  const bal0 = num(o, "balance", 200000);
  const apr = num(o, "apr", 15);
  const payment = num(o, "payment", 8000);
  const extra = num(o, "extra", 0);
  const pmt = payment + extra;
  const i = tvm.monthlyRate(apr);
  let bal = bal0, months = 0, totalInt = 0, intThisYear = 0;
  const yearly = [{ y: 0, bal: Math.round(bal) }];
  while (bal > 0 && months < 3600) {
    const int = bal * i;
    bal = bal + int - pmt;
    totalInt += int;
    months++;
    if (months % 12 === 0) yearly.push({ y: months / 12, bal: Math.max(0, Math.round(bal)) });
  }
  const clearable = bal <= 0 && months < 3600;
  if (clearable) {
    const lastY = yearly[yearly.length - 1].y;
    const endY = months / 12;
    if (endY > lastY + 1e-9) yearly.push({ y: endY, bal: 0 });
  }
  const labels = yearly.map((p) => (p.y === 0 ? "Today" : `Yr ${fmtNum(p.y, p.y % 1 ? 2 : 0)}`));
  const pts = yearly.map((p) => p.bal);
  return {
    head: monthsStat("Months to clear the debt", clearable ? months : null),
    stats: [moneyStat("Total interest paid", totalInt), moneyStat("Total paid", totalInt + bal0), numStat("Monthly payment", pmt)],
    charts: [areaCurve("dp", "Outstanding balance", labels, [
      { name: "Balance", points: pts, color: "#6366f1" }
    ])],
    note: clearable
      ? `At ${fmtNum(pmt)}/month the debt clears in about ${fmtNum(months)} months (${Math.floor(months / 12)} yr ${months % 12} mo). Paying more monthly or lowering the APR cuts the interest sharply.`
      : "This payment is below the monthly interest, so the balance would never clear. Raise the payment or lower the APR."
  };
}

/* ======================== Credit card interest ======================== */
function creditCardInterestCompute(o) {
  const bal = num(o, "balance", 50000);
  const apr = num(o, "apr", 36);
  const months = clamp(Math.round(num(o, "months", 6)), 1, 120);
  const daily = (1 + apr / 100 / 365);
  const owed = bal * Math.pow(daily, 30 * months);
  const interest = owed - bal;
  return {
    head: moneyHead("Interest accrued", interest),
    stats: [moneyStat("Total you will owe", owed), pctStat("APR", apr), monthsStat("Months of revolving", months)],
    charts: [donut("cc", "Balance vs interest", [
      { name: "Principal", value: bal, color: "#3b82f6" },
      { name: "Interest", value: Math.max(0, interest), color: "#ef4444" }
    ])],
    note: "Credit card interest compounds daily on the unpaid balance. Paying only the minimum keeps the balance high, so interest keeps compounding."
  };
}

/* ========================= Recurring deposit ========================= */
function rdCompute(o) {
  const deposit = num(o, "monthly", 5000);
  const rate = num(o, "rate", 6.5);
  const years = clamp(num(o, "years", 5), 1, 30);
  const nMonths = Math.round(years * 12);
  const iq = rate / 100 / 4;
  let bal = 0, pts = [0];
  const labels = yearLabels(years);
  let deposited = 0;
  for (let m = 1; m <= nMonths; m++) {
    bal += deposit; deposited += deposit;
    if (m % 3 === 0) bal += bal * iq;
    if (m % 12 === 0) pts.push(Math.round(bal));
  }
  if (nMonths % 12 !== 0) pts.push(Math.round(bal));
  while (pts.length < labels.length) pts.push(Math.round(bal));
  const interest = bal - deposited;
  return {
    head: moneyHead("Maturity value", bal),
    stats: [moneyStat("Total deposited", deposited), moneyStat("Interest earned", interest), pctStat("Effective annual yield", rate)],
    charts: [areaCurve("rd", "Balance over time", labels, [
      { name: "RD balance", points: pts.slice(0, labels.length), color: "#3b82f6" },
      { name: "Deposited", points: labels.map((_, y) => Math.round(deposit * 12 * y)), color: "#8b95a5" }
    ])],
    note: "Model uses quarterly compounding on the balance, the common convention for recurring deposits in India. Interest is taxable per your slab."
  };
}

/* ========================= Emergency fund ========================= */
function emergencyFundCompute(o) {
  const exp = num(o, "expenses", 30000);
  const monthsT = clamp(Math.round(num(o, "months", 6)), 1, 24);
  const target = exp * monthsT;
  const current = num(o, "current", 0);
  const monthly = num(o, "monthly", 5000);
  const rate = num(o, "rate", 5);
  const monthsNeeded = solveMonthsTo(monthly, rate, current, target);
  const reachable = isFinite(monthsNeeded);
  const horizon = reachable ? Math.max(12, Math.ceil(monthsNeeded / 12) + 1) : 6;
  const labels = yearLabels(horizon);
  const proj = labels.map((_, y) => Math.round(current * Math.pow(1 + rate / 100, y) + tvm.sipFV(monthly, y * 12, rate)));
  return {
    head: moneyHead("Emergency fund target", target),
    stats: [monthsStat("Months to build (at current saving)", reachable ? monthsNeeded : null), moneyStat("Current saved", current), monthsStat("Coverage targeted", monthsT)],
    charts: [areaCurve("ef", "Growing your buffer", labels, [
      { name: "Projected savings", points: proj, color: "#16a34a" },
      { name: "Target", points: labels.map(() => Math.round(target)), color: "#8b5cf6" }
    ])],
    note: reachable
      ? `A ${monthsT}-month buffer equals about ${fmtMoney(target)}. At your current saving rate you reach it in roughly ${fmtNum(monthsNeeded / 12, 1)} years.`
      : "Your target is not reachable at the current monthly saving - raise it or lower the coverage months."
  };
}

/* =============================== FIRE =============================== */
function fireCompute(o) {
  const expenses = num(o, "expenses", 60000);
  const swr = num(o, "swr", 4);
  const age = clamp(Math.round(num(o, "age", 30)), 18, 80);
  const corpus = num(o, "corpus", 1000000);
  const monthly = num(o, "monthly", 30000);
  const rate = num(o, "rate", 10);
  const target = (expenses * 12) * 100 / swr;
  const monthsNeeded = solveMonthsTo(monthly, rate, corpus, target);
  const reachable = isFinite(monthsNeeded);
  const horizon = reachable ? Math.max(5, Math.ceil(monthsNeeded / 12)) : 5;
  const labels = yearLabels(horizon);
  const proj = labels.map((_, y) => Math.round(corpus * Math.pow(1 + rate / 100, y) + tvm.sipFV(monthly, y * 12, rate)));
  return {
    head: moneyHead("FI number (25x expenses)", target),
    stats: [moneyStat("Safe annual withdrawal (4%)", target * swr / 100), yrsStat("Years to FI", reachable ? monthsNeeded / 12 : null), numStat("FI age", reachable ? age + monthsNeeded / 12 : null)],
    charts: [areaCurve("fi", "Path to financial independence", labels, [
      { name: "Projected corpus", points: proj, color: "#16a34a" },
      { name: "FI target", points: labels.map(() => Math.round(target)), color: "#8b5cf6" }
    ])],
    note: reachable
      ? `FI number uses the 4% rule: annual expenses x 25. Reaching it needs about ${fmtNum(monthsNeeded / 12, 1)} more years of saving at your current rate.`
      : "Your FI target is not reachable at the current saving rate - raise monthly saving or lower target expenses."
  };
}

/* ============================ Coast FIRE ============================ */
function coastFireCompute(o) {
  const age = clamp(Math.round(num(o, "age", 30)), 18, 80);
  const corpus = num(o, "corpus", 500000);
  const rate = num(o, "rate", 8);
  const target = num(o, "target", 30000000);
  const growthOk = rate > 0;
  const past = corpus >= target;
  const reachable = !past && growthOk && corpus > 0;
  let years = 0;
  if (reachable) years = Math.log(target / corpus) / Math.log(1 + rate / 100);
  const fireAge = reachable ? age + years : null;
  const labels = yearLabels(reachable ? Math.max(5, Math.ceil(years)) : 5);
  const proj = labels.map((_, y) => Math.round(corpus * Math.pow(1 + rate / 100, y)));
  return {
    head: numStat("Coast-FIRE age", fireAge),
    stats: [yrsStat("Years until corpus is enough", reachable ? years : null), moneyStat("Corpus today", corpus), pctStat("Assumed return", rate)],
    charts: [areaCurve("cf", "Compounding to your FI number", labels, [
      { name: "Corpus (no more contributions)", points: proj, color: "#16a34a" },
      { name: "FI target", points: labels.map(() => Math.round(target)), color: "#8b5cf6" }
    ])],
    note: reachable
      ? `Coast FIRE: stop adding money and let compounding do the rest. Your corpus reaches the FI target around age ${Math.round(fireAge)} with no further contributions.`
      : past
        ? "Your current corpus is already at (or above) the target - you are past coast-FIRE."
        : corpus <= 0
          ? "Add a starting corpus greater than zero to see how far compounding takes you."
          : "A zero (or negative) expected return can never grow your corpus to the target - raise the expected return to see a coast-FIRE age."
  };
}

/* ========================== Income tax (IN) ========================== */
const TAX_BRACKETS = {
  "new": { name: "New regime (FY 2024-25)", std: 75000, slabs: [[300000, 0], [700000, 0.05], [1000000, 0.10], [1200000, 0.15], [1500000, 0.20], [Infinity, 0.30]] },
  "old": { name: "Old regime (FY 2024-25)", std: 50000, slabs: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]] }
};
function slabTax(taxable, slabs) {
  let tax = 0, prev = 0;
  for (const [cap, rate] of slabs) {
    if (taxable <= prev) break;
    const band = Math.min(taxable, cap) - prev;
    tax += band * rate;
    prev = cap;
  }
  return tax;
}
function incomeTaxCompute(o) {
  const income = num(o, "income", 1200000);
  const regime = o.regime === "old" ? "old" : "new";
  const cfg = TAX_BRACKETS[regime];
  const taxable = Math.max(0, income - cfg.std);
  const base = slabTax(taxable, cfg.slabs);
  const cess = base * 0.04;
  const total = base + cess;
  return {
    head: moneyHead("Income tax (estimate)", total),
    stats: [moneyStat("Taxable income (after standard deduction)", taxable), moneyStat("Base tax", base), moneyStat("Health & education cess (4%)", cess), pctStat("Effective tax rate", income ? total / income * 100 : 0)],
    charts: [donut("it", "Where your income goes", [
      { name: "Tax", value: total, color: "#ef4444" },
      { name: "Take-home", value: Math.max(0, income - total), color: "#16a34a" }
    ])],
    note: `${cfg.name} estimate. Excludes surcharge, rebates and deductions beyond the standard deduction. Educational estimate - not tax advice.`
  };
}

/* ========================= Capital gains (IN) ========================= */
function capitalGainsCompute(o) {
  const gain = num(o, "gain", 300000);
  const type = o.type === "stcg" ? "stcg" : "ltcg";
  const tax = type === "stcg" ? gain * 0.20 : Math.max(0, gain - 125000) * 0.125;
  return {
    head: moneyHead("Capital gains tax (estimate)", tax),
    stats: [moneyStat("Taxable gain", type === "stcg" ? gain : Math.max(0, gain - 125000)), pctStat("Effective tax rate", gain ? tax / gain * 100 : 0), moneyStat("Post-tax gain", gain - tax)],
    charts: [donut("cg", "Your gain after tax", [
      { name: "Tax", value: tax, color: "#ef4444" },
      { name: "Post-tax gain", value: Math.max(0, gain - tax), color: "#16a34a" }
    ])],
    note: "India equity rules: STCG (held < 1 year) at 20%; LTCG over 1.25 lakh at 12.5% (FY 2024-25). Estimate only - not tax advice."
  };
}

export const FIELD_TYPES = { MONEY: "money", NUMBER: "number", PCT: "pct", YEARS: "years", MONTHS: "months", SELECT: "select", SWITCH: "switch" };

/* =========================================================================
   Registry
   ========================================================================= */
export const CALCULATORS = {
  "sip": {
    slug: "sip", name: "SIP Calculator", icon: "sip",
    category: "investment", popular: true,
    fields: [sipDef.monthly, sipDef.rate, sipDef.years, sipDef.stepUp],
    compute: sipCompute
  },
  "lump-sum": {
    slug: "lump-sum", name: "Lump Sum Calculator", icon: "coins",
    category: "investment", popular: false,
    fields: [
      { key: "amount", label: "One-time investment", type: "money", def: 500000, min: 1000, max: 10000000, step: 10000 },
      sipDef.rate, sipDef.years
    ],
    compute: lumpCompute
  },
  "compound-interest": {
    slug: "compound-interest", name: "Compound Interest Calculator", icon: "growth",
    category: "investment", popular: true,
    fields: [
      { key: "principal", label: "Principal amount", type: "money", def: 100000, min: 100, max: 10000000, step: 1000 },
      { key: "rate", label: "Annual interest rate", type: "pct", def: 8, min: 0, max: 25, step: 0.25 },
      { key: "years", label: "Time period", type: "years", def: 10, min: 1, max: 50, step: 1 },
      { key: "freq", label: "Compounding frequency", type: "select", def: 12, options: [{ v: 1, label: "Yearly" }, { v: 4, label: "Quarterly" }, { v: 12, label: "Monthly" }] },
      { key: "monthlyAdd", label: "Monthly addition (optional)", type: "money", def: 0, min: 0, max: 100000, step: 500 }
    ],
    compute: compoundCompute
  },
  "emi-loan": {
    slug: "emi-loan", name: "EMI / Loan Calculator", icon: "emi",
    category: "loan", popular: true,
    fields: [
      { key: "amount", label: "Loan amount", type: "money", def: 1000000, min: 1000, max: 100000000, step: 10000 },
      { key: "rate", label: "Interest rate (p.a.)", type: "pct", def: 8.5, min: 0, max: 30, step: 0.1 },
      { key: "years", label: "Loan tenure", type: "years", def: 5, min: 1, max: 30, step: 1 }
    ],
    compute: emiCompute
  },
  "mortgage": {
    slug: "mortgage", name: "Mortgage Calculator", icon: "home",
    category: "loan", popular: false,
    fields: [
      { key: "price", label: "Home price", type: "money", def: 2500000, min: 100000, max: 100000000, step: 50000 },
      { key: "down", label: "Down payment", type: "pct", def: 20, min: 0, max: 90, step: 1 },
      { key: "rate", label: "Interest rate (p.a.)", type: "pct", def: 8, min: 0, max: 20, step: 0.05 },
      { key: "years", label: "Loan term", type: "years", def: 20, min: 5, max: 40, step: 1 },
      { key: "tax", label: "Annual property tax", type: "money", def: 12000, min: 0, max: 500000, step: 500 },
      { key: "insurance", label: "Annual insurance", type: "money", def: 8000, min: 0, max: 500000, step: 500 }
    ],
    compute: mortgageCompute
  },
  "retirement": {
    slug: "retirement", name: "Retirement Calculator", icon: "retire",
    category: "retirement", popular: true, premium: true,
    fields: [
      { key: "ageNow", label: "Current age", type: "years", def: 30, min: 18, max: 75, step: 1 },
      { key: "ageRet", label: "Retirement age", type: "years", def: 60, min: 30, max: 80, step: 1 },
      { key: "lifeExp", label: "Life expectancy", type: "years", def: 85, min: 60, max: 100, step: 1 },
      { key: "monthly", label: "Monthly expenses today", type: "money", def: 60000, min: 1000, max: 10000000, step: 1000 },
      { key: "inflation", label: "Inflation rate", type: "pct", def: 6, min: 0, max: 15, step: 0.25 },
      { key: "retRate", label: "Return while saving", type: "pct", def: 10, min: 0, max: 20, step: 0.5 },
      { key: "wdRate", label: "Return after retirement", type: "pct", def: 7, min: 0, max: 15, step: 0.25 },
      { key: "corpus", label: "Current retirement corpus", type: "money", def: 0, min: 0, max: 100000000, step: 10000 },
      { key: "save", label: "Monthly saving now", type: "money", def: 15000, min: 0, max: 1000000, step: 500 }
    ],
    compute: retirementCompute
  },
  "fd": {
    slug: "fd", name: "FD Calculator", icon: "bank",
    category: "savings", popular: false,
    fields: [
      { key: "amount", label: "Deposit amount", type: "money", def: 500000, min: 1000, max: 10000000, step: 5000 },
      { key: "rate", label: "Interest rate (p.a.)", type: "pct", def: 7, min: 1, max: 12, step: 0.05 },
      { key: "years", label: "Tenure", type: "years", def: 5, min: 1, max: 20, step: 1 },
      { key: "freq", label: "Compounding", type: "select", def: 4, options: [{ v: 1, label: "Yearly" }, { v: 2, label: "Half-yearly" }, { v: 4, label: "Quarterly" }, { v: 12, label: "Monthly" }] }
    ],
    compute: fdCompute
  },
  "ppf": {
    slug: "ppf", name: "PPF Calculator", icon: "shield",
    category: "savings", popular: false,
    fields: [
      { key: "annual", label: "Annual deposit", type: "money", def: 150000, min: 500, max: 1500000, step: 5000 },
      { key: "rate", label: "PPF interest rate (p.a.)", type: "pct", def: 7.1, min: 1, max: 12, step: 0.1 },
      { key: "years", label: "Tenure (years)", type: "years", def: 15, min: 1, max: 30, step: 1 },
      { key: "balance", label: "Current balance (optional)", type: "money", def: 0, min: 0, max: 100000000, step: 10000 }
    ],
    compute: ppfCompute
  },
  "gst-tax": {
    slug: "gst-tax", name: "GST / Tax Calculator", icon: "tax",
    category: "tax", popular: true,
    fields: [
      { key: "amount", label: "Amount", type: "money", def: 10000, min: 1, max: 100000000, step: 100 },
      { key: "rate", label: "GST / tax rate", type: "select", def: 18, options: [{ v: 0, label: "0%" }, { v: 5, label: "5%" }, { v: 12, label: "12%" }, { v: 18, label: "18%" }, { v: 28, label: "28%" }] },
      { key: "mode", label: "Price type", type: "select", def: "exclusive", options: [{ v: "exclusive", label: "Tax excluded - add tax" }, { v: "inclusive", label: "Tax included - remove tax" }] }
    ],
    compute: gstCompute
  },
  "inflation": {
    slug: "inflation", name: "Inflation Calculator", icon: "inflate",
    category: "tax", popular: true,
    fields: [
      { key: "amount", label: "Amount", type: "money", def: 100000, min: 100, max: 100000000, step: 1000 },
      { key: "rate", label: "Inflation rate (p.a.)", type: "pct", def: 6, min: 0, max: 20, step: 0.25 },
      { key: "years", label: "Years ahead / ago", type: "years", def: 20, min: 1, max: 60, step: 1 },
      { key: "direction", label: "Direction", type: "select", def: "future", options: [{ v: "future", label: "Today -> future (future cost)" }, { v: "past", label: "Future -> today (today's value)" }] }
    ],
    compute: inflationCompute
  },
  "investment-return": {
    slug: "investment-return", name: "Investment Return Calculator", icon: "return",
    category: "investment", popular: false,
    fields: [
      { key: "initial", label: "Amount invested (initial)", type: "money", def: 100000, min: 0, max: 100000000, step: 1000 },
      { key: "monthly", label: "Monthly investment (optional)", type: "money", def: 0, min: 0, max: 1000000, step: 500 },
      { key: "final", label: "Current value", type: "money", def: 150000, min: 0, max: 1000000000, step: 1000 },
      { key: "years", label: "Holding period", type: "years", def: 3, min: 1, max: 50, step: 1 }
    ],
    compute: investmentReturnCompute
  },
  "cagr": {
    slug: "cagr", name: "CAGR Calculator", icon: "growth2",
    category: "investment", popular: true,
    fields: [
      { key: "begin", label: "Beginning value", type: "money", def: 100000, min: 100, max: 1000000000, step: 1000 },
      { key: "end", label: "Ending value", type: "money", def: 200000, min: 100, max: 1000000000, step: 1000 },
      { key: "years", label: "Number of years", type: "years", def: 5, min: 1, max: 50, step: 0.5 }
    ],
    compute: cagrCompute
  },
  "position-size": {
    slug: "position-size", name: "Stock Position Size Calculator", icon: "target",
    category: "trading", popular: true,
    fields: [
      { key: "balance", label: "Account balance", type: "money", def: 500000, min: 1000, max: 100000000, step: 5000 },
      { key: "riskPct", label: "Risk per trade", type: "pct", def: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "entry", label: "Entry price", type: "money", def: 250, min: 0.01, max: 100000, step: 1 },
      { key: "stop", label: "Stop-loss price", type: "money", def: 230, min: 0.01, max: 100000, step: 1 }
    ],
    compute: positionSizeCompute
  },
  "risk-reward": {
    slug: "risk-reward", name: "Risk/Reward Calculator", icon: "scale",
    category: "trading", popular: false,
    fields: [
      { key: "entry", label: "Entry price", type: "money", def: 250, min: 0.01, max: 100000, step: 1 },
      { key: "stop", label: "Stop-loss price", type: "money", def: 240, min: 0.01, max: 100000, step: 1 },
      { key: "target", label: "Target price", type: "money", def: 270, min: 0.01, max: 100000, step: 1 },
      { key: "qty", label: "Quantity (optional)", type: "number", def: 0, min: 0, max: 10000000, step: 1 }
    ],
    compute: riskRewardCompute
  },
  "profit-loss": {
    slug: "profit-loss", name: "Profit & Loss Calculator", icon: "pnl",
    category: "trading", popular: false,
    fields: [
      { key: "buy", label: "Buy price", type: "money", def: 200, min: 0.01, max: 100000, step: 1 },
      { key: "sell", label: "Sell price", type: "money", def: 230, min: 0.01, max: 100000, step: 1 },
      { key: "qty", label: "Quantity", type: "number", def: 100, min: 1, max: 10000000, step: 1 },
      { key: "buyFee", label: "Buy fees (optional)", type: "money", def: 0, min: 0, max: 100000, step: 10 },
      { key: "sellFee", label: "Sell fees (optional)", type: "money", def: 0, min: 0, max: 100000, step: 10 }
    ],
    compute: pnlCompute
  },
  "savings-goal": {
    slug: "savings-goal", name: "Savings Goal Calculator", icon: "goal",
    category: "retirement", popular: false, premium: true,
    fields: [
      { key: "target", label: "Goal amount", type: "money", def: 1000000, min: 1000, max: 1000000000, step: 10000 },
      { key: "current", label: "Already saved", type: "money", def: 100000, min: 0, max: 100000000, step: 5000 },
      { key: "monthly", label: "Monthly saving", type: "money", def: 20000, min: 100, max: 1000000, step: 500 },
      { key: "rate", label: "Expected return (p.a.)", type: "pct", def: 8, min: 0, max: 20, step: 0.5 }
    ],
    compute: savingsGoalCompute
  },
  "net-worth": {
    slug: "net-worth", name: "Net Worth Calculator", icon: "wallet",
    category: "personal", popular: false,
    dynamic: true, premium: true,
    fields: [],
    compute: netWorthCompute
  },
  "real-return": {
    slug: "real-return", name: "Real Return Calculator", icon: "rr",
    category: "investment",
    fields: [
      { key: "nominal", label: "Nominal return", type: "pct", def: 8, min: 0, max: 30, step: 0.5 },
      { key: "inflation", label: "Inflation rate", type: "pct", def: 6, min: 0, max: 20, step: 0.25 }
    ],
    compute: realReturnCompute
  },
  "expense-ratio": {
    slug: "expense-ratio", name: "Expense Ratio Impact Calculator", icon: "er",
    category: "investment",
    fields: [
      { key: "principal", label: "Initial investment", type: "money", def: 500000, min: 1000, max: 100000000, step: 10000 },
      { key: "rate", label: "Expected return", type: "pct", def: 10, min: 0, max: 25, step: 0.5 },
      { key: "years", label: "Investment period", type: "years", def: 20, min: 1, max: 50, step: 1 },
      { key: "expense", label: "Expense ratio", type: "pct", def: 1, min: 0, max: 5, step: 0.1 }
    ],
    compute: expenseRatioCompute
  },
  "swp": {
    slug: "swp", name: "SWP Calculator", icon: "swp",
    category: "investment", popular: true,
    fields: [
      { key: "corpus", label: "Corpus", type: "money", def: 20000000, min: 100000, max: 1000000000, step: 100000 },
      { key: "rate", label: "Return after retirement", type: "pct", def: 8, min: 0, max: 15, step: 0.25 },
      { key: "years", label: "Withdrawal period", type: "years", def: 25, min: 1, max: 50, step: 1 },
      { key: "growth", label: "Withdrawal growth", type: "pct", def: 6, min: 0, max: 15, step: 0.5 }
    ],
    compute: swpCompute
  },
  "xirr": {
    slug: "xirr", name: "XIRR Calculator", icon: "xirr",
    category: "investment",
    fields: [
      { key: "monthly", label: "Monthly investment", type: "money", def: 10000, min: 100, max: 1000000, step: 500 },
      { key: "years", label: "Investment period", type: "years", def: 5, min: 1, max: 40, step: 1 },
      { key: "final", label: "Current / final value", type: "money", def: 800000, min: 0, max: 1000000000, step: 10000 }
    ],
    compute: xirrCompute
  },
  "stp": {
    slug: "stp", name: "STP Calculator", icon: "stp",
    category: "investment",
    fields: [
      { key: "transfer", label: "Monthly transfer", type: "money", def: 20000, min: 100, max: 1000000, step: 500 },
      { key: "years", label: "STP period", type: "years", def: 5, min: 1, max: 40, step: 1 },
      { key: "rate", label: "Target fund return", type: "pct", def: 10, min: 0, max: 25, step: 0.5 },
      { key: "srcRate", label: "Source (debt) return", type: "pct", def: 6, min: 0, max: 15, step: 0.25 }
    ],
    compute: stpCompute
  },
  "home-loan-prepay": {
    slug: "home-loan-prepay", name: "Home Loan Prepayment Calculator", icon: "hlp",
    category: "loan",
    fields: [
      { key: "amount", label: "Loan amount", type: "money", def: 3000000, min: 100000, max: 100000000, step: 50000 },
      { key: "rate", label: "Interest rate", type: "pct", def: 8.5, min: 1, max: 20, step: 0.1 },
      { key: "years", label: "Loan tenure", type: "years", def: 20, min: 5, max: 40, step: 1 },
      { key: "prepay", label: "Prepayment amount", type: "money", def: 500000, min: 0, max: 100000000, step: 10000 },
      { key: "atYear", label: "Prepay after (years)", type: "years", def: 5, min: 1, max: 30, step: 1 }
    ],
    compute: homeLoanPrepayCompute
  },
  "loan-compare": {
    slug: "loan-compare", name: "Loan Comparison Calculator", icon: "lcp",
    category: "loan",
    fields: [
      { key: "amount", label: "Loan amount", type: "money", def: 1000000, min: 10000, max: 100000000, step: 10000 },
      { key: "rateA", label: "Loan A rate", type: "pct", def: 8, min: 0.5, max: 30, step: 0.1 },
      { key: "yearsA", label: "Loan A tenure", type: "years", def: 5, min: 1, max: 40, step: 1 },
      { key: "rateB", label: "Loan B rate", type: "pct", def: 9.5, min: 0.5, max: 30, step: 0.1 },
      { key: "yearsB", label: "Loan B tenure", type: "years", def: 7, min: 1, max: 40, step: 1 }
    ],
    compute: loanCompareCompute
  },
  "debt-payoff": {
    slug: "debt-payoff", name: "Debt Payoff Calculator", icon: "dp",
    category: "loan",
    fields: [
      { key: "balance", label: "Outstanding balance", type: "money", def: 200000, min: 1000, max: 100000000, step: 1000 },
      { key: "apr", label: "Interest rate (APR)", type: "pct", def: 15, min: 0, max: 48, step: 0.5 },
      { key: "payment", label: "Monthly payment", type: "money", def: 8000, min: 100, max: 10000000, step: 500 },
      { key: "extra", label: "Extra monthly (optional)", type: "money", def: 0, min: 0, max: 10000000, step: 500 }
    ],
    compute: debtPayoffCompute
  },
  "credit-card-interest": {
    slug: "credit-card-interest", name: "Credit Card Interest Calculator", icon: "cci",
    category: "loan",
    fields: [
      { key: "balance", label: "Unpaid balance", type: "money", def: 50000, min: 100, max: 100000000, step: 1000 },
      { key: "apr", label: "Card APR", type: "pct", def: 36, min: 5, max: 60, step: 1 },
      { key: "months", label: "Revolving period", type: "select", def: 6, options: [{ v: 3, label: "3 months" }, { v: 6, label: "6 months" }, { v: 12, label: "12 months" }, { v: 24, label: "24 months" }, { v: 36, label: "36 months" }] }
    ],
    compute: creditCardInterestCompute
  },
  "rd": {
    slug: "rd", name: "Recurring Deposit Calculator", icon: "rd",
    category: "savings",
    fields: [
      { key: "monthly", label: "Monthly deposit", type: "money", def: 5000, min: 100, max: 1000000, step: 100 },
      { key: "rate", label: "Interest rate (p.a.)", type: "pct", def: 6.5, min: 1, max: 12, step: 0.05 },
      { key: "years", label: "Tenure", type: "years", def: 5, min: 1, max: 30, step: 1 }
    ],
    compute: rdCompute
  },
  "emergency-fund": {
    slug: "emergency-fund", name: "Emergency Fund Calculator", icon: "emf",
    category: "savings",
    fields: [
      { key: "expenses", label: "Monthly expenses", type: "money", def: 30000, min: 1000, max: 10000000, step: 500 },
      { key: "months", label: "Coverage", type: "select", def: 6, options: [{ v: 3, label: "3 months" }, { v: 6, label: "6 months" }, { v: 9, label: "9 months" }, { v: 12, label: "12 months" }] },
      { key: "current", label: "Already saved", type: "money", def: 0, min: 0, max: 100000000, step: 1000 },
      { key: "monthly", label: "Monthly saving", type: "money", def: 5000, min: 0, max: 10000000, step: 500 },
      { key: "rate", label: "Expected return", type: "pct", def: 5, min: 0, max: 15, step: 0.5 }
    ],
    compute: emergencyFundCompute
  },
  "fire": {
    slug: "fire", name: "FIRE Calculator", icon: "fire",
    category: "retirement", popular: true,
    fields: [
      { key: "expenses", label: "Monthly expenses", type: "money", def: 60000, min: 1000, max: 10000000, step: 1000 },
      { key: "swr", label: "Safe withdrawal rate", type: "pct", def: 4, min: 2, max: 6, step: 0.5 },
      { key: "age", label: "Current age", type: "years", def: 30, min: 18, max: 75, step: 1 },
      { key: "corpus", label: "Current corpus", type: "money", def: 1000000, min: 0, max: 1000000000, step: 100000 },
      { key: "monthly", label: "Monthly saving", type: "money", def: 30000, min: 0, max: 10000000, step: 1000 },
      { key: "rate", label: "Expected return", type: "pct", def: 10, min: 0, max: 20, step: 0.5 }
    ],
    compute: fireCompute
  },
  "coast-fire": {
    slug: "coast-fire", name: "Coast FIRE Calculator", icon: "cf",
    category: "retirement",
    fields: [
      { key: "age", label: "Current age", type: "years", def: 30, min: 18, max: 75, step: 1 },
      { key: "corpus", label: "Current corpus", type: "money", def: 500000, min: 0, max: 1000000000, step: 10000 },
      { key: "rate", label: "Expected return", type: "pct", def: 8, min: 0, max: 20, step: 0.5 },
      { key: "target", label: "FI target amount", type: "money", def: 30000000, min: 1000000, max: 10000000000, step: 100000 }
    ],
    compute: coastFireCompute
  },
  "income-tax": {
    slug: "income-tax", name: "Income Tax Calculator (India)", icon: "it",
    category: "tax", popular: true,
    fields: [
      { key: "income", label: "Annual income", type: "money", def: 1200000, min: 100000, max: 100000000, step: 10000 },
      { key: "regime", label: "Tax regime", type: "select", def: "new", options: [{ v: "new", label: "New regime" }, { v: "old", label: "Old regime" }] }
    ],
    compute: incomeTaxCompute
  },
  "capital-gains": {
    slug: "capital-gains", name: "Capital Gains Calculator (India)", icon: "cg",
    category: "tax",
    fields: [
      { key: "gain", label: "Capital gain", type: "money", def: 300000, min: 0, max: 1000000000, step: 10000 },
      { key: "type", label: "Holding type", type: "select", def: "ltcg", options: [{ v: "ltcg", label: "Long-term (equity, > 1 yr)" }, { v: "stcg", label: "Short-term (equity, < 1 yr)" }] }
    ],
    compute: capitalGainsCompute
  }
};

export const CATEGORIES = {
  investment: "Investment Calculators",
  loan: "Loan Calculators",
  retirement: "Retirement & Goals",
  savings: "Savings Calculators",
  tax: "Tax & Inflation",
  trading: "Stock & Trading",
  personal: "Personal Finance"
};

export const CALC_LIST = Object.values(CALCULATORS);

export function getCalc(slug) {
  return CALCULATORS[slug] || null;
}

export function computeCalc(slug, inputs) {
  const c = getCalc(slug);
  if (!c) return null;
  return c.compute(inputs || {});
}

export function computeChartForTest(slug, inputs) {
  const model = computeCalc(slug, inputs);
  return model;
}
