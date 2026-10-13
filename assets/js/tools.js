/*
  FinHub decision tools
  ---------------------
  Interactive, multi-input experiences built on the pure decision engine:
    dashboard        - financial health at a glance
    goal-planner     - turn a goal into a plan with strategies
    sip-compare      - compare 2-5 investment plans
    what-if-lab      - sensitivity of a plan to one change at a time
    savings-planner  - find surplus and see what saving more is worth

  Reuses charts.js (SVG charts), table.js (detailed tables) and engine.js
  (all mathematics). No new frameworks, no dependencies.
*/
import {
  CURRENCIES, getCurrency, fmtMoney, fmtCompactMoney, fmtPct, fmtNum,
  parseAmountText, fmtGrouped,
  projectPlan, goalPlan, buildStrategies, compareScenarios, savingsPlan,
  healthScore, whatIf, WHAT_IF_LEVERS,
  retirementPlan, debtPlan, emergencyPlan, netWorthTotals, netWorthTrend, sipStrategies,
  profileToState, PROFILE_KEY, moneyPlan,
  COMPARISON_MODES, compareDecision, encodePlanParam, decodePlanParam
} from "./engine.js";
import {
  listPlans, getPlan, savePlan, deletePlan, renamePlan,
  exportPlans, importPlans, listSnapshots, saveSnapshot, deleteSnapshot,
  listGoals, saveGoal, updateGoal, deleteGoal,
  listReviews, saveReview, deleteReview
} from "./plans.js";
import { renderChart } from "./charts.js";
import { renderTablesInto, downloadCsv } from "./table.js";

/* ---------------- tiny DOM helpers ---------------- */
function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function div(cls, text) { return h("div", cls, text); }
function fmtValue(kind, value, cur) {
  if (value === null || value === undefined) return "\u2014";
  if (kind === "text") return String(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return "\u2014";
  switch (kind) {
    case "money": return fmtMoney(n, cur);
    case "compact": return fmtCompactMoney(n, cur);
    case "pct": return fmtPct(n, 2);
    case "years": return `${fmtNum(n, n % 1 ? 2 : 0)} yr${n === 1 ? "" : "s"}`;
    case "months": return `${fmtNum(n, n % 1 ? 1 : 0)} mo`;
    case "ratio": return `1 : ${fmtNum(n, 2)}`;
    default: return fmtNum(n, 2);
  }
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  else legacyCopy(text);
}
function legacyCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch { /* ignore */ }
  ta.remove();
}
function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1400);
}
function readState() {
  try { return JSON.parse(localStorage.getItem("finhub_currency")); } catch { return null; }
}

/* ---------------- form primitives ---------------- */
/* spec: { key, label, type, def, min, max, step, options, help } */
function buildField(spec, state, onChange) {
  // select
  if (spec.type === "select") {
    const box = h("label", "field");
    box.appendChild(h("span", "field__label", spec.label));
    const sel = h("select", "field__select");
    (spec.options || []).forEach((o) => {
      const op = h("option", null, o.label);
      op.value = o.v;
      sel.appendChild(op);
    });
    sel.value = state[spec.key] ?? spec.def;
    sel.addEventListener("change", () => { state[spec.key] = sel.value; onChange(); });
    box.appendChild(sel);
    if (spec.help) box.appendChild(h("span", "field__help", spec.help));
    return { el: box, set: (v) => { sel.value = v; state[spec.key] = v; } };
  }

  const box = h("label", "field");
  box.appendChild(h("span", "field__label", spec.label));
  const ctl = div("field__ctl");
  const wrap = div("field__input");
  const symbol = spec.type === "money" ? getCurrency(state.__currency).symbol : "";
  if (symbol) wrap.appendChild(h("span", "field__prefix", symbol));
  const input = h("input", "field__num");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", spec.label);
  const suffix = spec.type === "pct" ? "%" : spec.type === "years" ? "yrs" : "";
  wrap.appendChild(input);
  if (suffix) wrap.appendChild(h("span", "field__suffix", suffix));
  ctl.appendChild(wrap);

  const hasRange = Number.isFinite(spec.min) && Number.isFinite(spec.max) && spec.max > spec.min;
  let range = null;
  if (hasRange) {
    range = h("input", "field__range");
    range.type = "range";
    range.min = spec.min; range.max = spec.max; range.step = spec.step || 1;
    range.setAttribute("aria-label", `${spec.label} slider`);
    ctl.appendChild(range);
  }
  box.appendChild(ctl);
  if (spec.help) box.appendChild(h("span", "field__help", spec.help));

  const display = (n) => spec.type === "money" ? fmtGrouped(n, state.__currency, spec.step && String(spec.step).includes(".") ? 2 : 0) : fmtNum(n, spec.step && String(spec.step).includes(".") ? 2 : 0);
  const sync = () => {
    const v = Number(state[spec.key]);
    input.value = display(Number.isFinite(v) ? v : spec.def);
    if (range) range.value = Math.min(spec.max, Math.max(spec.min, Number.isFinite(v) ? v : spec.def));
  };
  state[spec.key] = Number.isFinite(Number(state[spec.key])) ? Number(state[spec.key]) : spec.def;
  sync();

  input.addEventListener("input", () => {
    const parsed = parseAmountText(input.value);
    if (Number.isFinite(parsed)) {
      state[spec.key] = parsed;
      if (range) range.value = Math.min(spec.max, Math.max(spec.min, parsed));
      onChange();
    }
  });
  input.addEventListener("blur", () => { sync(); onChange(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  if (range) range.addEventListener("input", () => { state[spec.key] = Number(range.value); input.value = display(state[spec.key]); onChange(); });

  return { el: box, set: (v) => { state[spec.key] = Number(v); sync(); } };
}

/* ---------------- chart model builders ---------------- */
const areaModel = (title, labels, series) => ({ type: "area", title, data: { labels, series } });
const lineModel = (title, labels, series) => ({ type: "line", title, data: { labels, series } });
const donutModel = (title, segments) => ({ type: "donut", title, data: { segments } });
const hbarModel = (title, items) => ({ type: "hbar", title, data: { items } });
const gaugeModel = (title, opts) => ({ type: "gauge", title, data: opts });
const barsModel = (title, items) => ({ type: "bars", title, data: { items } });

function projectionsFrom(proj) {
  return [
    { name: "Corpus", points: proj.corpusSeries, color: "#6366f1" },
    { name: "Invested", points: proj.investedSeries, color: "#3b82f6" },
    { name: "In today's money", points: proj.realSeries, color: "#8b5cf6", dashed: true }
  ];
}
function milestoneTable(proj, inflationPct, currencyCode) {
  const years = Math.round(proj.years);
  const marks = [1, 3, 5, 10, 15, 20, 25, 30, 35, 40].filter((y) => y < years);
  if (years > 0) marks.push(years);
  const rows = [...new Set(marks)].sort((a, b) => a - b).map((y) => {
    const invested = proj.investedSeries[y];
    const corpus = proj.corpusSeries[y];
    const real = proj.realSeries[y];
    return [`Yr ${y}`, invested, corpus - invested, corpus, real];
  });
  return {
    title: "Milestones year by year",
    columns: [{ label: "Year", kind: "text" }, { label: "Invested", kind: "money" }, { label: "Gains", kind: "money" }, { label: "Corpus", kind: "money" }, { label: "In today's money", kind: "money" }],
    rows,
    note: "The final column restates the corpus in today's purchasing power, after inflation."
  };
}

/* ============================================================
   TOOL DEFINITIONS
   ============================================================ */
function dashboardFields(s) {
  return [
    { key: "income", label: "Monthly income (take-home)", type: "money", def: 100000, min: 10000, max: 5000000, step: 5000 },
    { key: "fixed", label: "Fixed monthly expenses", type: "money", def: 30000, min: 0, max: 2000000, step: 1000, help: "Rent, EMIs on essentials, utilities, school fees." },
    { key: "variable", label: "Variable monthly spending", type: "money", def: 20000, min: 0, max: 2000000, step: 1000 },
    { key: "debt", label: "Debt payments (EMIs)", type: "money", def: 10000, min: 0, max: 2000000, step: 1000 },
    { key: "monthlyInvestment", label: "Monthly investing", type: "money", def: 20000, min: 0, max: 2000000, step: 1000 },
    { key: "savings", label: "Current savings & investments", type: "money", def: 500000, min: 0, max: 500000000, step: 10000 },
    { key: "goalAmount", label: "Primary goal (today's money)", type: "money", def: 10000000, min: 100000, max: 1000000000, step: 100000 },
    { key: "goalYears", label: "Years to that goal", type: "years", def: 15, min: 1, max: 50, step: 1 },
    { key: "returnPct", label: "Expected return", type: "pct", def: 12, min: 0, max: 20, step: 0.5 },
    { key: "inflationPct", label: "Inflation assumption", type: "pct", def: 6, min: 0, max: 15, step: 0.5 }
  ];
}

function computeDashboard(s, cur) {
  const sp = savingsPlan(s);
  const gp = goalPlan({ goalAmount: s.goalAmount, years: s.goalYears, inflationPct: s.inflationPct, returnPct: s.returnPct, currentSavings: s.savings, monthly: s.monthlyInvestment, stepUpPct: 0 });
  const hs = healthScore({ income: s.income, fixed: s.fixed, variable: s.variable, debt: s.debt, monthlyInvestment: s.monthlyInvestment, savings: s.savings, goalProgress: gp.progress });
  const proj = gp.project;

  const spend = s.fixed + s.variable;
  const invest = s.monthlyInvestment;
  const surplus = Math.max(0, sp.surplus);
  const segments = [
    { name: "Fixed needs", value: s.fixed, color: "#3b82f6" },
    { name: "Variable wants", value: s.variable, color: "#8b5cf6" },
    { name: "Debt", value: s.debt, color: "#ef4444" },
    { name: "Investing", value: invest, color: "#16a34a" },
    { name: "Unallocated surplus", value: surplus, color: "#f59e0b" }
  ].filter((x) => x.value > 0);

  const head = { label: "Financial health score", value: hs.score, kind: "num" };
  const stats = [
    { label: "Grade", value: hs.grade, kind: "text" },
    { label: "Monthly surplus", value: sp.surplus, kind: "money", negative: sp.surplus < 0 },
    { label: "Savings rate", value: hs.savingsRate, kind: "pct" },
    { label: "Investment rate", value: hs.investRate, kind: "pct" },
    { label: "Emergency fund", value: hs.emergencyMonths, kind: "months" },
    { label: "Projected corpus", value: gp.projected, kind: "money" },
    { label: "Goal shortfall", value: gp.shortfall, kind: "money", negative: gp.shortfall > 0 }
  ];

  const charts = [
    gaugeModel("Financial health", { value: hs.score, max: 100, kind: "num", label: "Score / 100", caption: hs.grade }),
    hbarModel("Where the score comes from", hs.components.map((c) => ({ label: c.label, value: c.score, color: c.score >= 70 ? "#16a34a" : c.score >= 45 ? "#f59e0b" : "#ef4444", display: `${c.score}/100` }))),
    donutModel("Where each month's income goes", segments),
    areaModel("Projected wealth vs goal", proj.labels, [
      ...projectionsFrom(proj),
      { name: "Goal", points: proj.labels.map((_, i) => s.goalAmount * Math.pow(1 + s.inflationPct / 100, i)), color: "#ef4444", dashed: true }
    ])
  ];

  const tables = [
    {
      title: "Health score breakdown - how it is calculated",
      columns: [{ label: "Component", kind: "text" }, { label: "Score", kind: "text" }, { label: "Weight", kind: "text" }, { label: "Your value", kind: "text" }, { label: "Guide", kind: "text" }],
      rows: hs.components.map((c) => [c.label, `${c.score}/100`, `${c.weight}%`, valueLabel(c), targetLabel(c)]),
      note: "Provisional coaching gauge using your inputs - not a credit score or financial diagnosis."
    },
    {
      title: "Monthly cash flow",
      columns: [{ label: "Item", kind: "text" }, { label: "Amount", kind: "money" }],
      rows: [
        ["Income", s.income], ["Fixed expenses", -s.fixed], ["Variable spending", -s.variable], ["Debt payments", -s.debt],
        ["Investing (already)", -invest], ["Free surplus", sp.surplus]
      ],
      totals: ["Net after everything", s.income - spend - s.debt - invest]
    },
    milestoneTable(proj, s.inflationPct, cur)
  ];

  const actions = [
    { title: "Do this next", body: `Your financial health score is ${hs.score}/100 (${hs.grade}). Focus on the weakest area first.`, items: hs.improvements.slice(0, 3).map((i) => `${i.label}: ${i.detail}`) },
    { title: "Put the surplus to work", body: `You have about ${fmtCompactMoney(surplus, cur)} a month unallocated. Redirecting it is the fastest lever you control.`, items: ["Open the What-If Lab to test a higher SIP.", "Use the Goal Planner to target a specific number."] }
  ];
  const summary = [
    `My financial health is ${hs.score}/100 (${hs.grade}); about ${fmtCompactMoney(gp.projected, cur)} projected in ${s.goalYears} years against a ${fmtCompactMoney(gp.futureGoal, cur)} goal.`,
    `Monthly surplus: ${fmtMoney(sp.surplus, cur)}`,
    `Savings rate: ${fmtPct(hs.savingsRate)} | Investment rate: ${fmtPct(hs.investRate)}`,
    `Emergency fund: ${fmtNum(hs.emergencyMonths, 1)} months`,
    `Projected corpus in ${s.goalYears} yrs: ${fmtCompactMoney(gp.projected, cur)} (goal ${fmtCompactMoney(gp.futureGoal, cur)})`
  ].join("\n");
  return { head, stats, charts, tables, actions, note: "Estimates at your assumptions, not guarantees. Update any input to see the picture change.", summary };
}
function valueLabel(c) {
  switch (c.kind) {
    case "pct": return fmtPct(c.value, 1);
    case "months": return `${fmtNum(c.value, 1)} months`;
    default: return fmtNum(c.value, 1);
  }
}
function targetLabel(c) {
  switch (c.key) {
    case "savings": return "30% of income";
    case "emergency": return "6 months";
    case "investing": return "20% of income";
    case "debt": return "Below 40% of income";
    case "goal": return "100% funded";
    default: return "-";
  }
}

/* ---------------- goal planner ---------------- */
function goalFields(s) {
  return [
    { key: "goalType", label: "What is the goal?", type: "select", def: "wealth", options: [
      { v: "retirement", label: "Retirement corpus" }, { v: "house", label: "House / property" }, { v: "car", label: "Car" },
      { v: "education", label: "Education" }, { v: "vacation", label: "Vacation" }, { v: "emergency", label: "Emergency fund" },
      { v: "child", label: "Child's education" }, { v: "wealth", label: "Wealth target" }, { v: "custom", label: "Custom goal" }
    ] },
    { key: "goalAmount", label: "Goal amount (today's money)", type: "money", def: 5000000, min: 100000, max: 1000000000, step: 100000 },
    { key: "currentSavings", label: "Already saved for it", type: "money", def: 300000, min: 0, max: 1000000000, step: 10000 },
    { key: "years", label: "Years to the goal", type: "years", def: 15, min: 1, max: 50, step: 1 },
    { key: "inflationPct", label: "Inflation assumption", type: "pct", def: 6, min: 0, max: 15, step: 0.5 },
    { key: "returnPct", label: "Expected return", type: "pct", def: 12, min: 0, max: 20, step: 0.5 },
    { key: "monthly", label: "Current monthly contribution", type: "money", def: 10000, min: 0, max: 2000000, step: 1000 },
    { key: "stepUpPct", label: "Current annual step-up", type: "pct", def: 0, min: 0, max: 30, step: 1 }
  ];
}

function computeGoal(s, cur) {
  const gp = goalPlan(s);
  const strat = buildStrategies(s);
  const head = { label: gp.goalAchieved ? "On track - projected corpus" : "Projected corpus (short of goal)", value: gp.projected, kind: "money", negative: !gp.goalAchieved };
  const stats = [
    { label: `Goal in ${fmtNum(s.years)} yrs (future value)`, value: gp.futureGoal, kind: "money" },
    { label: "Already saved", value: s.currentSavings, kind: "money" },
    { label: "Projected corpus", value: gp.projected, kind: "money" },
    { label: gp.shortfall > 0 ? "Shortfall" : "Surplus", value: gp.shortfall > 0 ? gp.shortfall : gp.surplus, kind: "money", negative: gp.shortfall > 0 },
    { label: "Required monthly SIP", value: gp.requiredMonthly, kind: "money" },
    { label: "At today's money", value: gp.realProjected, kind: "money" }
  ];
  if (gp.requiredStepUp != null) stats.push({ label: "Required step-up", value: gp.requiredStepUp, kind: "pct" });
  if (gp.yearsToGoal != null) stats.push({ label: "Years to goal at this plan", value: gp.yearsToGoal, kind: "years" });
  stats.push({ label: "Goal progress", value: gp.progress * 100, kind: "pct" });

  const charts = [
    gaugeModel("Goal progress", { value: gp.progress * 100, max: 100, kind: "pct", label: "Funded", caption: gp.goalAchieved ? "On track" : "Shortfall remains" }),
    areaModel("Your goal plan", gp.project.labels, [
      ...projectionsFrom(gp.project),
      { name: "Goal (inflated)", points: gp.project.labels.map((_, i) => s.goalAmount * Math.pow(1 + s.inflationPct / 100, i)), color: "#ef4444", dashed: true }
    ]),
    hbarModel("Monthly contribution: current vs required", [
      { label: "Current", value: s.monthly, color: "#3b82f6", display: fmtCompactMoney(s.monthly, cur) },
      { label: "Required (no step-up)", value: gp.requiredMonthly, color: gp.requiredMonthly > s.monthly ? "#ef4444" : "#16a34a", display: fmtCompactMoney(gp.requiredMonthly, cur) }
    ])
  ];

  const recRows = strat.strategies.map((st) => [
    st.label, st.monthly, st.stepUpPct, st.years, st.projected, st.extraOutlay,
    st.goalAchieved ? "Yes" : `Short by ${fmtCompactMoney(st.shortfall, cur)}`
  ]);
  const tables = [
    {
      title: "Your options - costed strategies",
      columns: [{ label: "Strategy", kind: "text" }, { label: "Monthly SIP", kind: "money" }, { label: "Step-up", kind: "pct" }, { label: "Years", kind: "num" }, { label: "Projected corpus", kind: "money" }, { label: "Extra own money", kind: "money" }, { label: "Reaches goal?", kind: "text" }],
      rows: recRows,
      rowClass: strat.strategies.map((st) => (st.recommended ? "is-recommended" : (st.goalAchieved ? "" : "is-short"))),
      note: "Recommended is the cheapest option that still reaches the goal."
    },
    milestoneTable(gp.project, s.inflationPct, cur)
  ];

  const recommended = strat.strategies.find((x) => x.recommended);
  const typeLabel = (goalFields({}).find((f) => f.key === "goalType").options.find((o) => o.v === s.goalType) || {}).label || "goal";
  const actions = [
    { title: recommended ? (recommended.id === "current" ? "You are on track" : `Recommended: ${recommended.label}`) : "Adjust the plan",
      body: recommended && recommended.id !== "current"
        ? `${recommended.why} That takes your projected corpus to ${fmtCompactMoney(recommended.projected, cur)}.`
        : `Your current plan already reaches the ${typeLabel.toLowerCase()} target. Consider a small annual step-up to build a buffer.`,
      items: gp.shortfall > 0 && gp.requiredMonthly > s.monthly ? [`Raising the SIP to about ${fmtCompactMoney(gp.requiredMonthly, cur)} closes the gap on the same timeline.`] : [] },
    { title: "Test the trade-offs", body: "Try each strategy in the What-If Lab to see the yearly effect before you commit.", items: [] }
  ];
  const summary = [
    `Goal: ${fmtCompactMoney(gp.futureGoal, cur)} in ${fmtNum(s.years)} yrs`,
    `Projected: ${fmtCompactMoney(gp.projected, cur)} (${gp.goalAchieved ? "on track" : "shortfall " + fmtCompactMoney(gp.shortfall, cur)})`,
    `Required monthly SIP: ${fmtMoney(gp.requiredMonthly, cur)}`,
    recommended ? `Recommended: ${recommended.label}` : ""
  ].filter(Boolean).join("\n");
  return { head, stats, charts, tables, actions, note: "Projections use your return assumption; markets vary. Treat the numbers as a plan, not a promise.", summary };
}

/* ---------------- SIP comparison ---------------- */
const SCENARIO_COLORS = ["#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#ef4444"];
function compareDefaults() {
  return [
    { id: "a", name: "Scenario A", monthly: 5000, initial: 0, stepUpPct: 0, years: 20, returnPct: 12 },
    { id: "b", name: "Scenario B", monthly: 10000, initial: 0, stepUpPct: 0, years: 20, returnPct: 12 },
    { id: "c", name: "Scenario C", monthly: 5000, initial: 0, stepUpPct: 10, years: 20, returnPct: 12 }
  ];
}
function comparePresets() {
  const base = (name, over) => ({ id: name.toLowerCase(), name, monthly: 10000, initial: 0, stepUpPct: 0, years: 20, returnPct: 12, ...over });
  return [
    { label: "Flat vs step-up", scenarios: [base("Flat SIP"), base("Step-up 10%", { stepUpPct: 10 })] },
    { label: "Raise the SIP", scenarios: [base("Current"), base("25% higher", { monthly: 12500 })] },
    { label: "Start with a lump sum", scenarios: [base("SIP only"), base("SIP + 1 month", { initial: 10000 }), base("SIP + 1 year", { initial: 120000 })] },
    { label: "Short vs long", scenarios: [base("10 years", { years: 10 }), base("20 years"), base("30 years", { years: 30 })] }
  ];
}
function compareFields(s) {
  return [
    { key: "inflationPct", label: "Inflation assumption", type: "pct", def: 6, min: 0, max: 15, step: 0.5 },
    { key: "goalAmount", label: "Optional goal amount", type: "money", def: 10000000, min: 0, max: 1000000000, step: 100000, help: "Set 0 to compare without a goal." }
  ];
}
function scenarioFields(sc) {
  return [
    { key: "monthly", label: "Monthly investment", type: "money", def: 5000, min: 0, max: 2000000, step: 1000 },
    { key: "initial", label: "Initial lump sum", type: "money", def: 0, min: 0, max: 100000000, step: 10000 },
    { key: "stepUpPct", label: "Annual step-up", type: "pct", def: 0, min: 0, max: 30, step: 1 },
    { key: "years", label: "Years", type: "years", def: 20, min: 1, max: 50, step: 1 },
    { key: "returnPct", label: "Expected return", type: "pct", def: 12, min: 0, max: 20, step: 0.5 }
  ];
}
function computeCompare(s, scenarios, cur) {
  const cmp = compareScenarios(scenarios, { inflationPct: s.inflationPct, goalAmount: s.goalAmount });
  const labels = ["Today"].concat(cmp.rows[0] ? cmp.rows[0].series.slice(1).map((_, i) => `Yr ${i + 1}`) : []);
  const series = cmp.rows.map((r, i) => ({ name: r.name, points: r.series, color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }));
  const best = cmp.rows.find((r) => r.highestCorpus) || cmp.rows[0];
  const head = { label: best ? `Best corpus: ${best.name}` : "Compare plans", value: best ? best.projected : 0, kind: "money" };
  const stats = cmp.rows.slice(0, 3).map((r) => ({ label: `${r.name} corpus`, value: r.projected, kind: "money" }));
  if (cmp.goalAmount > 0) stats.push({ label: "Goal (today's money)", value: cmp.goalAmount, kind: "money" });

  const charts = [
    lineModel("Corpus growth, side by side", labels, series),
    barsModel("Invested vs gains by scenario", cmp.rows.map((r, i) => ({ label: r.name.replace("Scenario ", ""), principal: r.invested, interest: r.gains, balance: r.projected, color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] })))
  ];
  const tables = [
    {
      title: "Scenario comparison",
      columns: [{ label: "Scenario", kind: "text" }, { label: "Monthly", kind: "money" }, { label: "Initial", kind: "money" }, { label: "Step-up", kind: "pct" }, { label: "Years", kind: "num" }, { label: "Invested", kind: "money" }, { label: "Gains", kind: "money" }, { label: "Final corpus", kind: "money" }, { label: "In today's money", kind: "money" }, { label: "CAGR", kind: "pct" }],
      rows: cmp.rows.map((r) => [r.name, r.monthly, r.initial, r.stepUpPct, r.years, r.invested, r.gains, r.projected, r.realProjected, r.cagrPct]),
      rowClass: cmp.rows.map((r) => (r.highestCorpus ? "is-recommended" : ""))
    }
  ];
  if (best) {
    const bestProj = projectPlan({ monthly: best.monthly, initial: best.initial, years: best.years, returnPct: best.returnPct, stepUpPct: best.stepUpPct, inflationPct: s.inflationPct });
    tables.push(milestoneTable(bestProj, s.inflationPct, cur));
  }
  if (cmp.goalAmount > 0) {
    tables.push({
      title: "Goal achievement",
      columns: [{ label: "Scenario", kind: "text" }, { label: "Goal (future)", kind: "money" }, { label: "Projected", kind: "money" }, { label: "Status", kind: "text" }],
      rows: cmp.rows.map((r) => [r.name, r.futureGoal, r.projected, r.goalAchieved ? "Reached" : `Short by ${fmtCompactMoney(r.shortfall, cur)}`])
    });
  }
  const actions = [{ title: "How to read this", body: "A higher step-up usually beats a higher starting SIP for the same total outlay, because the larger deposits arrive later but the early ones still compound. Check the CAGR column - it normalises for how much you actually put in.", items: [] }];
  return { head, stats, charts, tables, actions, note: "CAGR here is the money-weighted growth of your contributions, not a fund return.", summary: cmp.rows.map((r) => `${r.name}: ${fmtCompactMoney(r.projected, cur)} (invested ${fmtCompactMoney(r.invested, cur)})`).join("\n") };
}

/* ---------------- What-if lab ---------------- */
function whatIfFields(s) {
  return [
    { key: "monthly", label: "Monthly investment", type: "money", def: 10000, min: 0, max: 2000000, step: 1000 },
    { key: "initial", label: "Initial lump sum", type: "money", def: 100000, min: 0, max: 100000000, step: 10000 },
    { key: "stepUpPct", label: "Current annual step-up", type: "pct", def: 0, min: 0, max: 30, step: 1 },
    { key: "years", label: "Years", type: "years", def: 15, min: 1, max: 50, step: 1 },
    { key: "returnPct", label: "Expected return", type: "pct", def: 12, min: 0, max: 20, step: 0.5 },
    { key: "inflationPct", label: "Inflation assumption", type: "pct", def: 6, min: 0, max: 15, step: 0.5 },
    { key: "goalAmount", label: "Goal amount (today's money)", type: "money", def: 5000000, min: 0, max: 1000000000, step: 100000 }
  ];
}
function computeWhatIf(s, cur) {
  const base = projectPlan({ monthly: s.monthly, initial: s.initial, years: s.years, returnPct: s.returnPct, stepUpPct: s.stepUpPct, inflationPct: s.inflationPct });
  const results = WHAT_IF_LEVERS.map((l) => whatIf(s, l.id));
  const impactOf = (r) => (r.lever.realDelta ? r.deltaReal : r.deltaCorpus);
  const focus = results[0];
  const head = { label: "Current projected corpus", value: base.final, kind: "money" };
  const stats = [
    { label: "Total invested", value: base.invested, kind: "money" },
    { label: "Gains", value: base.gains, kind: "money" },
    { label: "In today's money", value: base.real, kind: "money" }
  ];
  const charts = [
    areaModel("Current plan vs the change you are testing", base.labels, [
      { name: "Current plan", points: base.corpusSeries, color: "#3b82f6" },
      { name: focus.lever.label, points: focus.after.corpusSeries, color: "#16a34a", dashed: true },
      { name: "In today's money", points: base.realSeries, color: "#8b5cf6", dashed: true }
    ]),
    hbarModel("Impact of each lever", results.map((r) => { const v = impactOf(r); return { label: r.lever.label, value: Math.abs(v), color: v >= 0 ? "#16a34a" : "#ef4444", display: `${v >= 0 ? "+" : "-"}${fmtCompactMoney(Math.abs(v), cur)}${r.lever.realDelta ? " real" : ""}` }; }))
  ];
  const tables = [
    {
      title: "Every lever at a glance",
      columns: [{ label: "Change", kind: "text" }, { label: "Projected corpus", kind: "money" }, { label: "Change in value", kind: "text" }, { label: "Extra invested", kind: "money" }, { label: "Goal reached?", kind: "text" }],
      rows: results.map((r) => { const v = impactOf(r); return [r.lever.label, r.modified.projected, `${v >= 0 ? "+" : "-"}${fmtCompactMoney(Math.abs(v), cur)}${r.lever.realDelta ? " (today's money)" : ""}`, r.deltaInvested, r.achievedAfter == null ? "-" : (r.achievedAfter ? "Yes" : (r.achievedBefore ? "No (from yes)" : "Still short"))]; }),
      note: "Each row changes one assumption only, holding the rest at your current plan. The inflation lever is shown in today's money because it changes purchasing power, not the nominal corpus."
    },
    milestoneTable(focus.after, s.inflationPct, cur)
  ];
  const best = results.filter((r) => impactOf(r) > 0).sort((a, b) => impactOf(b) - impactOf(a))[0];
  const actions = [{ title: best ? `Biggest single lever: ${best.lever.label}` : "Try a lever", body: best ? `On its own it changes the value of your plan by ${fmtCompactMoney(impactOf(best), cur)}${best.lever.realDelta ? " in today's money" : ""}. ${best.lever.detail}` : "Adjust an input above to explore.", items: [] }];
  return { head, stats, charts, tables, actions, note: "What-if results are estimates that hold every other assumption constant. Real plans change several things at once.", summary: `${fmtMoney(s.monthly, cur)}/month could grow to about ${fmtCompactMoney(base.final, cur)} in ${s.years} years (${fmtCompactMoney(base.real, cur)} in today's money).${best ? ` Biggest lever: ${best.lever.label} (${impactOf(best) >= 0 ? "+" : "-"}${fmtCompactMoney(Math.abs(impactOf(best)), cur)}${best.lever.realDelta ? " in today's money" : ""}).` : ""}` };
}

/* ---------------- savings planner ---------------- */
function savingsFields(s) {
  return [
    { key: "income", label: "Monthly income (take-home)", type: "money", def: 100000, min: 10000, max: 5000000, step: 5000 },
    { key: "fixed", label: "Fixed monthly expenses", type: "money", def: 30000, min: 0, max: 2000000, step: 1000 },
    { key: "variable", label: "Variable monthly spending", type: "money", def: 20000, min: 0, max: 2000000, step: 1000 },
    { key: "debt", label: "Debt payments (EMIs)", type: "money", def: 10000, min: 0, max: 2000000, step: 1000 },
    { key: "monthlyInvestment", label: "Monthly investing (current)", type: "money", def: 15000, min: 0, max: 2000000, step: 1000 },
    { key: "savings", label: "Liquid savings set aside", type: "money", def: 200000, min: 0, max: 500000000, step: 10000 },
    { key: "years", label: "Years to invest", type: "years", def: 15, min: 1, max: 50, step: 1 },
    { key: "returnPct", label: "Expected return", type: "pct", def: 12, min: 0, max: 20, step: 0.5 },
    { key: "inflationPct", label: "Inflation assumption", type: "pct", def: 6, min: 0, max: 15, step: 0.5 }
  ];
}
function computeSavings(s, cur) {
  const sp = savingsPlan(s);
  const head = { label: "Money available to save or invest each month", value: sp.surplus, kind: "money", negative: sp.surplus < 0 };
  const stats = [
    { label: "Net cash flow", value: sp.cashFlow, kind: "money" },
    { label: "Savings rate", value: sp.savingsRate, kind: "pct" },
    { label: "Investment rate", value: sp.investmentRate, kind: "pct" },
    { label: "Expense ratio", value: sp.expenseRatio, kind: "pct" },
    { label: "Emergency fund target", value: sp.emergencyTarget, kind: "money" },
    { label: "Emergency gap", value: sp.emergencyGap, kind: "money", negative: sp.emergencyGap > 0 }
  ];
  const charts = [
    donutModel("Where the money goes", [
      { name: "Fixed needs", value: s.fixed, color: "#3b82f6" },
      { name: "Variable wants", value: s.variable, color: "#8b5cf6" },
      { name: "Debt", value: s.debt, color: "#ef4444" },
      { name: "Investing", value: s.monthlyInvestment, color: "#16a34a" },
      { name: "Free surplus", value: Math.max(0, sp.surplus), color: "#f59e0b" }
    ].filter((x) => x.value > 0)),
    gaugeModel("Emergency fund cover", { value: sp.emergencyMonths, max: 6, kind: "num", label: "Months covered", caption: sp.emergencyMonths >= 6 ? "Fully funded" : `${fmtNum(Math.max(0, 6 - sp.emergencyMonths), 1)} months to target` }),
    hbarModel("What saving a bit more becomes", sp.scenarios.map((sc) => ({ label: sc.extra === 0 ? "Current investing" : `Save ${fmtCompactMoney(sc.extra, cur)} more`, value: sc.projected, color: sc.extra === 0 ? "#3b82f6" : "#16a34a", display: fmtCompactMoney(sc.projected, cur) })))
  ];
  const tables = [
    {
      title: "Saving more: what it becomes",
      columns: [{ label: "Monthly plan", kind: "text" }, { label: "Monthly invested", kind: "money" }, { label: "Invested over time", kind: "money" }, { label: "Gains", kind: "money" }, { label: "Projected corpus", kind: "money" }, { label: "In today's money", kind: "money" }],
      rows: sp.scenarios.map((sc) => [sc.extra === 0 ? "Current" : `+ ${fmtCompactMoney(sc.extra, cur)}`, sc.monthly, sc.invested, sc.gains, sc.projected, sc.real]),
      note: "Assumes the extra saving is invested every month at your expected return."
    },
    {
      title: "Emergency fund",
      columns: [{ label: "Item", kind: "text" }, { label: "Value", kind: "text" }],
      rows: [["Monthly expenses + debt", fmtMoney(sp.outflow, cur)], ["Recommended cover (6 months)", fmtMoney(sp.emergencyTarget, cur)], ["You have", fmtMoney(s.savings, cur)], ["Still needed", fmtMoney(sp.emergencyGap, cur)]]
    }
  ];
  const actions = [{ title: sp.surplus > 0 ? `${fmtCompactMoney(sp.surplus, cur)} a month is within reach` : "Cash flow is tight", body: sp.surplus > 0 ? `Redirect part of your ${fmtCompactMoney(sp.surplus, cur)} surplus to investing - the table shows what each increment becomes over ${fmtNum(s.years)} years.` : "Your outflow meets or exceeds income. Prioritise cutting the largest variable expenses or consolidating debt first.", items: sp.emergencyGap > 0 ? [`Build your emergency fund first: about ${fmtCompactMoney(sp.emergencyGap, cur)} more to reach 6 months.`] : [] }];
  return { head, stats, charts, tables, actions, note: "Cash-flow figures are monthly. Projections assume a steady return, which markets do not provide year to year.", summary: `Monthly surplus: ${fmtMoney(sp.surplus, cur)}\nSavings rate: ${fmtPct(sp.savingsRate)}\nEmergency cover: ${fmtNum(sp.emergencyMonths, 1)} months` };
}

/* ---------------- retirement planner ---------------- */
function retirementFields() {
  return [
    { key: "ageNow", label: "Current age", type: "years", def: 30, min: 18, max: 75, step: 1 },
    { key: "ageRet", label: "Target retirement age", type: "years", def: 60, min: 35, max: 80, step: 1 },
    { key: "lifeExp", label: "Life expectancy", type: "years", def: 85, min: 60, max: 100, step: 1 },
    { key: "monthlyExpense", label: "Monthly expenses today", type: "money", def: 60000, min: 1000, max: 10000000, step: 1000 },
    { key: "corpusNow", label: "Retirement savings so far", type: "money", def: 500000, min: 0, max: 1000000000, step: 10000 },
    { key: "monthlySave", label: "Monthly saving now", type: "money", def: 15000, min: 0, max: 2000000, step: 500 },
    { key: "returnPct", label: "Return while saving", type: "pct", def: 11, min: 0, max: 20, step: 0.5 },
    { key: "wdReturnPct", label: "Return after retirement", type: "pct", def: 7, min: 0, max: 15, step: 0.25 },
    { key: "inflationPct", label: "Inflation assumption", type: "pct", def: 6, min: 0, max: 15, step: 0.25 }
  ];
}
function assumptionRows(s) {
  const rows = [
    ["Inflation", fmtPct(Number(s.inflationPct))],
    ["Return while saving", fmtPct(Number(s.returnPct))],
    ["Return after retirement", fmtPct(Number(s.wdReturnPct))],
    ["Expenses grow with inflation", "Yes"],
    ["Withdrawals modelled at start of year", "Yes"]
  ];
  return rows;
}
function computeRetirement(s, cur) {
  const rp = retirementPlan(s);
  const head = { label: rp.onTrack ? "On track - projected corpus at retirement" : "Projected corpus at retirement (short)", value: rp.projected, kind: "money", negative: !rp.onTrack };
  const stats = [
    { label: "Corpus needed at retirement", value: rp.corpusNeeded, kind: "money" },
    { label: "Monthly expenses then", value: rp.futureMonthlyExpense, kind: "money" },
    { label: rp.gap > 0 ? "Shortfall" : "Surplus", value: rp.gap > 0 ? rp.gap : (rp.projected - rp.corpusNeeded), kind: "money", negative: rp.gap > 0 },
    { label: "Required monthly saving", value: rp.requiredMonthly, kind: "money" },
    { label: "Years to retirement", value: rp.yearsToRetire, kind: "years" },
    { label: "Retirement years funded", value: rp.progress * 100, kind: "pct" }
  ];
  const charts = [
    areaModel("Corpus across your lifetime", rp.curve.labels, [
      { name: "Projected corpus", points: rp.curve.corpus, color: "#6366f1" },
      { name: "Corpus needed", points: rp.curve.labels.map(() => rp.curve.target), color: "#ef4444", dashed: true }
    ]),
    gaugeModel("Retirement readiness", { value: rp.progress * 100, max: 100, kind: "pct", label: "Funded", caption: rp.onTrack ? "On track" : "Shortfall remains" }),
    hbarModel("Scenarios: projected corpus", rp.scenarios.map((sc) => ({ label: sc.label, value: sc.projected, color: sc.onTrack ? "#16a34a" : "#ef4444", display: fmtCompactMoney(sc.projected, cur) })))
  ];
  const tables = [
    {
      title: "Scenarios - what changes the outcome",
      columns: [{ label: "Scenario", kind: "text" }, { label: "Retire at", kind: "num" }, { label: "Corpus needed", kind: "money" }, { label: "Projected", kind: "money" }, { label: "Gap", kind: "money" }, { label: "Required monthly", kind: "money" }, { label: "On track?", kind: "text" }],
      rows: rp.scenarios.map((sc) => [sc.label, sc.ageRet, sc.corpusNeeded, sc.projected, sc.gap, sc.requiredMonthly, sc.onTrack ? "Yes" : "No"]),
      rowClass: rp.scenarios.map((sc) => (sc.id === "current" ? "is-recommended" : "")),
      note: "Every scenario uses the same inflation and return assumptions; only the labelled change differs."
    },
    {
      title: "Assumptions (visible on purpose)",
      columns: [{ label: "Item", kind: "text" }, { label: "Value", kind: "text" }],
      rows: assumptionRows(s).concat([["Life expectancy", `${fmtNum(Number(s.lifeExp))} years`]])
    }
  ];
  const best = [...rp.scenarios].filter((x) => x.onTrack).sort((a, b) => a.requiredMonthly - b.requiredMonthly)[0];
  const actions = [
    { title: rp.onTrack ? "You are on track" : "Close the gap", body: rp.onTrack
        ? `At your current saving you reach about ${fmtCompactMoney(rp.projected, cur)} by age ${rp.ageRet}, against a target of ${fmtCompactMoney(rp.corpusNeeded, cur)}.`
        : `You are short by ${fmtCompactMoney(rp.gap, cur)}. Raising the monthly saving to about ${fmtCompactMoney(rp.requiredMonthly, cur)} closes it on the same timeline.`,
      items: best ? [`Trying to retire earlier costs more; retiring later needs less. Compare the scenarios table.`] : [] },
    { title: "Protect the plan", body: "Once invested, the sequence of returns matters. Keep the emergency fund separate from the retirement corpus.", items: [] }
  ];
  const summary = [
    `Retirement at ${rp.ageRet}: need ${fmtCompactMoney(rp.corpusNeeded, cur)}, projected ${fmtCompactMoney(rp.projected, cur)}`,
    rp.onTrack ? "On track" : `Shortfall ${fmtCompactMoney(rp.gap, cur)}`,
    `Required monthly saving ${fmtMoney(rp.requiredMonthly, cur)}`
  ].join("\n");
  return { head, stats, charts, tables, actions, note: "Estimates at your assumptions, not guarantees. Retirement outcomes depend on returns you cannot control.", summary };
}

/* ---------------- debt planner ---------------- */
function debtFields() {
  const f = [
    { key: "strategy", label: "Payoff strategy", type: "select", def: "avalanche", options: [
      { v: "avalanche", label: "Avalanche - clear the highest interest rate first" },
      { v: "snowball", label: "Snowball - clear the smallest balance first" }
    ], help: "Avalanche usually costs least; snowball gives quicker wins." }
  ];
  for (let n = 1; n <= 3; n++) {
    f.push({ key: `balance${n}`, label: `Debt ${n} balance`, type: "money", def: n === 1 ? 200000 : 0, min: 0, max: 100000000, step: 5000, help: n === 1 ? "Set a balance to 0 to ignore that debt." : undefined });
    f.push({ key: `apr${n}`, label: `Debt ${n} interest rate`, type: "pct", def: n === 1 ? 15 : (n === 2 ? 12 : 10), min: 0, max: 60, step: 0.5 });
    f.push({ key: `payment${n}`, label: `Debt ${n} monthly payment`, type: "money", def: n === 1 ? 8000 : 0, min: 0, max: 2000000, step: 500 });
  }
  f.push({ key: "extra", label: "Extra monthly payment", type: "money", def: 0, min: 0, max: 2000000, step: 500, help: "Added on top of the minimums, aimed at one debt at a time." });
  return f;
}
function computeDebt(s, cur) {
  const debts = [];
  for (let n = 1; n <= 3; n++) {
    if (Number(s[`balance${n}`]) > 0) debts.push({ id: `d${n}`, name: `Debt ${n}`, balance: s[`balance${n}`], apr: s[`apr${n}`], payment: s[`payment${n}`] });
  }
  if (!debts.length) {
    return { head: { label: "Add a debt to plan the payoff", value: "-", kind: "text" }, stats: [], charts: [], tables: [], actions: [], note: "Enter a balance for at least one debt.", summary: "No debt entered." };
  }
  const dp = debtPlan({ debts, extra: s.extra, strategy: s.strategy });
  const timeText = dp.months != null ? `${Math.floor(dp.months / 12)} yr ${dp.months % 12} mo` : "never at this payment";
  const head = { label: "Time to become debt-free", value: timeText, kind: "text" };
  const baselineTime = dp.baseline.months != null ? `${Math.floor(dp.baseline.months / 12)} yr ${dp.baseline.months % 12} mo` : "-";
  const stats = [
    { label: "Total debt", value: dp.totalBalance, kind: "money" },
    { label: "Monthly budget", value: dp.monthlyBudget, kind: "money" },
    { label: "Total interest", value: dp.totalInterest, kind: "money", negative: true },
    { label: "Interest if minimums only", value: dp.baseline.totalInterest, kind: "money" },
    { label: "Interest saved", value: Math.max(0, dp.baseline.totalInterest - dp.totalInterest), kind: "money" },
    { label: "Baseline payoff time", value: baselineTime, kind: "text" }
  ];
  const labels = dp.schedule.map((p) => (p.month % 12 === 0 ? `Yr ${p.month / 12}` : `Mo ${p.month}`));
  const points = dp.schedule.map((p) => p.balance);
  const charts = [
    areaModel("Debt payoff timeline", labels, [{ name: "Outstanding balance", points, color: "#6366f1" }]),
    hbarModel("Total interest at different extra payments", dp.scenarios.map((sc) => ({ label: sc.extra === 0 ? "Minimums only" : `+ ${fmtCompactMoney(sc.extra, cur)} extra`, value: sc.totalInterest, color: sc.extra === 0 ? "#ef4444" : "#16a34a", display: fmtCompactMoney(sc.totalInterest, cur) })))
  ];
  const tables = [
    {
      title: "What extra payments do",
      columns: [{ label: "Extra / month", kind: "text" }, { label: "Total monthly", kind: "money" }, { label: "Time to clear", kind: "text" }, { label: "Total interest", kind: "money" }, { label: "Interest saved", kind: "money" }, { label: "Months saved", kind: "num" }],
      rows: dp.scenarios.map((sc) => [sc.extra === 0 ? "None" : fmtMoney(sc.extra, cur), dp.minTotal + sc.extra, sc.months != null ? `${Math.floor(sc.months / 12)} yr ${sc.months % 12} mo` : "never", sc.totalInterest, sc.interestSaved, sc.monthsSaved]),
      note: "Interest saved is measured against paying the minimums only, using the selected strategy."
    }
  ];
  if (debts.length > 1) {
    tables.push({
      title: "Payoff order under the selected strategy",
      columns: [{ label: "Debt", kind: "text" }, { label: "Balance", kind: "money" }, { label: "Rate", kind: "pct" }, { label: "Min payment", kind: "money" }, { label: "Cleared in", kind: "text" }],
      rows: dp.debts.map((d) => {
        const m = dp.clearedAt[d.id];
        return [d.name, d.balance, d.apr, d.payment, m ? `${Math.floor(m / 12)} yr ${m % 12} mo` : "never"];
      })
    });
    tables.push({
      title: "Avalanche vs snowball",
      columns: [{ label: "Strategy", kind: "text" }, { label: "Time to clear", kind: "text" }, { label: "Total interest", kind: "money" }],
      rows: [
        ["Avalanche (highest rate first)", dp.avalanche.months != null ? `${Math.floor(dp.avalanche.months / 12)} yr ${dp.avalanche.months % 12} mo` : "never", dp.avalanche.totalInterest],
        ["Snowball (smallest balance first)", dp.snowball.months != null ? `${Math.floor(dp.snowball.months / 12)} yr ${dp.snowball.months % 12} mo` : "never", dp.snowball.totalInterest]
      ]
    });
  }
  const recExtra = dp.scenarios.find((sc) => sc.extra > 0 && sc.interestSaved > 0);
  const actions = [
    { title: dp.canClear ? `Debt-free in ${timeText}` : "This payment does not clear the debt", body: dp.canClear
        ? `Paying ${fmtMoney(dp.monthlyBudget, cur)} a month clears ${fmtCompactMoney(dp.totalBalance, cur)} of debt and costs ${fmtCompactMoney(dp.totalInterest, cur)} in interest.`
        : "Your minimums do not cover the monthly interest, so the balance would never fall. Increase the payments or consolidate.", items: [] },
    { title: recExtra ? "The extra payment is worth it" : "Try an extra payment", body: recExtra
        ? `Adding ${fmtMoney(recExtra.extra, cur)} a month saves about ${fmtCompactMoney(recExtra.interestSaved, cur)} in interest.`
        : "Use the table to price a small extra payment before committing.", items: [] }
  ];
  const summary = [
    `Debt: ${fmtCompactMoney(dp.totalBalance, cur)}`,
    `Cleared in ${timeText} paying ${fmtMoney(dp.monthlyBudget, cur)}/month`,
    `Total interest: ${fmtCompactMoney(dp.totalInterest, cur)}`
  ].join("\n");
  return { head, stats, charts, tables, actions, note: "Assumes a fixed rate and the same payment every month until cleared. Real rates and incomes vary.", summary };
}

/* ---------------- emergency fund planner ---------------- */
function emergencyFields() {
  return [
    { key: "essentialMonthly", label: "Essential monthly expenses", type: "money", def: 40000, min: 1000, max: 5000000, step: 1000, help: "Rent, food, utilities, insurance, loan payments - not discretionary spending." },
    { key: "coverMonths", label: "Months of cover to target", type: "number", def: 6, min: 1, max: 24, step: 1 },
    { key: "current", label: "Already set aside", type: "money", def: 100000, min: 0, max: 1000000000, step: 5000 },
    { key: "monthly", label: "Monthly amount you can save", type: "money", def: 10000, min: 0, max: 2000000, step: 500 },
    { key: "ratePct", label: "Return on the fund", type: "pct", def: 5, min: 0, max: 12, step: 0.25, help: "Liquid funds / savings account. Keep this money safe, not aggressive." }
  ];
}
function computeEmergency(s, cur) {
  const ep = emergencyPlan(s);
  const head = { label: "Emergency fund target", value: ep.target, kind: "money" };
  const stats = [
    { label: "Coverage today", value: ep.coverageMonths, kind: "months" },
    { label: "Already set aside", value: ep.current, kind: "money" },
    { label: "Gap to target", value: ep.gap, kind: "money", negative: ep.gap > 0 },
    { label: "Months to fill it", value: ep.monthsToFill == null ? "Not reachable" : ep.monthsToFill, kind: ep.monthsToFill == null ? "text" : "months" },
    { label: "Monthly saving", value: ep.monthly, kind: "money" }
  ];
  const charts = [
    areaModel("Growing the buffer", ep.projection.labels, [
      { name: "Projected fund", points: ep.projection.values, color: "#16a34a" },
      { name: "Target", points: ep.projection.labels.map(() => Math.round(ep.projection.target)), color: "#8b5cf6", dashed: true }
    ]),
    gaugeModel("Coverage today", { value: Math.min(ep.coverageMonths, ep.coverMonths), max: ep.coverMonths, kind: "num", label: "Months covered", caption: ep.coverageMonths >= ep.coverMonths ? "Fully funded" : `${fmtNum(Math.max(0, ep.coverMonths - ep.coverageMonths), 1)} months to go` }),
    hbarModel("Months to reach each target", ep.horizons.map((h) => ({ label: `${h.months} months cover`, value: h.monthsToFill == null ? 0 : h.monthsToFill, color: h.monthsToFill == null ? "#ef4444" : "#3b82f6", display: h.monthsToFill == null ? "not reachable" : `${fmtNum(h.monthsToFill)} mo` })))
  ];
  const tables = [
    {
      title: "Coverage options",
      columns: [{ label: "Cover", kind: "text" }, { label: "Target", kind: "money" }, { label: "Current", kind: "money" }, { label: "Gap", kind: "money" }, { label: "Months to fill", kind: "text" }],
      rows: ep.horizons.map((h) => [`${h.months} months`, h.target, ep.current, h.gap, h.monthsToFill == null ? "not reachable" : fmtNum(h.monthsToFill)]),
      note: "3 months suits stable salaried income; 6-12 months suits variable income or dependants."
    },
    {
      title: "Assumptions",
      columns: [{ label: "Item", kind: "text" }, { label: "Value", kind: "text" }],
      rows: [["Essential expenses / month", fmtMoney(ep.essentialMonthly, cur)], ["Return on the fund", fmtPct(ep.ratePct)], ["Monthly saving", fmtMoney(ep.monthly, cur)], ["Money held in cash or near-cash", "Yes"]]
    }
  ];
  const actions = [
    { title: ep.gap > 0 ? `You need ${fmtCompactMoney(ep.gap, cur)} more` : "You are fully covered", body: ep.gap > 0
        ? `At ${fmtMoney(ep.monthly, cur)} a month you reach ${ep.coverMonths} months of cover in about ${ep.monthsToFill == null ? "an unreachable timeline - raise the monthly amount" : `${fmtNum(ep.monthsToFill)} months`}.`
        : `Your fund covers ${fmtNum(ep.coverageMonths, 1)} months of essential expenses. Keep it liquid and only use it for genuine emergencies.`, items: [] },
    { title: "Where to keep it", body: "A savings account or liquid fund, not equity. The point is certainty, not return.", items: [] }
  ];
  const summary = [
    `Target ${ep.coverMonths}-month fund: ${fmtCompactMoney(ep.target, cur)}`,
    `Coverage today: ${fmtNum(ep.coverageMonths, 1)} months`,
    ep.gap > 0 ? `Gap ${fmtCompactMoney(ep.gap, cur)}` : "Fully funded"
  ].join("\n");
  return { head, stats, charts, tables, actions, note: "Keeps the fund in cash-like instruments; inflation still erodes its value, so review the target each year.", summary };
}

/* ---------------- net worth tracker (custom UI) ---------------- */
const NW_KEY = "finhub_networth_assets_v1";
function nwLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(NW_KEY));
    if (raw && Array.isArray(raw.assets) && Array.isArray(raw.liabilities)) return raw;
  } catch { /* ignore */ }
  return {
    assets: [
      { id: "a1", name: "Savings & cash", value: 300000 },
      { id: "a2", name: "Investments", value: 800000 },
      { id: "a3", name: "Property", value: 0 }
    ],
    liabilities: [
      { id: "l1", name: "Home loan", value: 1500000 },
      { id: "l2", name: "Credit card", value: 50000 }
    ]
  };
}
function nwSave(data) {
  try { localStorage.setItem(NW_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
function nwUid() { return `i_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

function renderNetWorth(mounts, currency) {
  const data = nwLoad();
  const today = new Date().toISOString().slice(0, 10);
  const formMount = mounts.form;

  const paint = () => {
    nwSave(data);
    const nw = netWorthTotals({ assets: data.assets, liabilities: data.liabilities });
    renderHead(mounts.head, { label: "Net worth", value: nw.netWorth, kind: "money", negative: nw.netWorth < 0 }, currency);
    renderStats(mounts.stats, [
      { label: "Total assets", value: nw.totalAssets, kind: "money" },
      { label: "Total liabilities", value: nw.totalLiabilities, kind: "money" },
      { label: "Debt to assets", value: nw.debtToAsset, kind: "pct" },
      { label: "Liquid assets share", value: nw.liquidsShare, kind: "pct" }
    ], currency);
    const trend = netWorthTrend(listSnapshots());
    const charts = [
      donutModel("Asset allocation", nw.allocation.length ? nw.allocation : [{ name: "No assets yet", value: 1, color: "#8b95a5" }]),
      barsModel("Assets vs liabilities", [
        { label: "Assets", principal: nw.totalAssets, interest: 0, balance: nw.totalAssets, color: "#16a34a" },
        { label: "Liabilities", principal: nw.totalLiabilities, interest: 0, balance: nw.totalLiabilities, color: "#ef4444" },
        { label: "Net worth", principal: nw.netWorth, interest: 0, balance: nw.netWorth, color: "#6366f1" }
      ])
    ];
    if (trend.values.length >= 2) {
      charts.push(areaModel("Net worth over time", trend.labels, [{ name: "Net worth", points: trend.values, color: "#6366f1" }]));
    }
    renderCharts(mounts.charts, charts, currency);

    const tableRows = data.assets.map((a) => ["Asset", a.name, a.value]).concat(data.liabilities.map((l) => ["Liability", l.name, l.value]));
    const tables = [{
      title: "Balance sheet",
      columns: [{ label: "Type", kind: "text" }, { label: "Item", kind: "text" }, { label: "Value", kind: "money" }],
      rows: tableRows,
      totals: ["Net worth", "", nw.netWorth]
    }];
    if (trend.values.length) {
      tables.push({
        title: "Saved snapshots",
        columns: [{ label: "Date", kind: "text" }, { label: "Assets", kind: "money" }, { label: "Liabilities", kind: "money" }, { label: "Net worth", kind: "money" }, { label: "Change", kind: "money" }],
        rows: trend.snapshots.map((sp, i) => [sp.date, sp.totalAssets, sp.totalLiabilities, sp.netWorth, i === 0 ? 0 : sp.netWorth - trend.snapshots[i - 1].netWorth])
      });
    }
    renderTablesInto(mounts.tables, null, currency, { tables, title: false });

    const actions = [
      { title: "Track, don't obsess", body: "Net worth moves in steps, not a straight line. Save a snapshot every quarter and judge the trend, not any single month.", items: [] },
      { title: trend.values.length >= 2 ? `Change so far: ${fmtCompactMoney(trend.change, currency)}` : "Save your first snapshot", body: trend.values.length >= 2 ? `Across ${trend.labels.length} snapshots your net worth moved ${fmtCompactMoney(trend.change, currency)} (${fmtPct(trend.changePct)}).` : "Add your assets and liabilities, then save a dated snapshot. Repeat each quarter to see progress.", items: [] }
    ];
    renderActions(mounts.actions, actions);
    if (mounts.note) mounts.note.textContent = "Your figures stay in this browser. Nothing is uploaded.";
  };

  const renderRows = () => {
    formMount.innerHTML = "";
    const intro = h("p", "field__help", "Add everything you own and owe. Values are current market values, not what you paid.");
    formMount.appendChild(intro);

    const section = (title, kind) => {
      const wrap = div("nw-section");
      const head = div("nw-section__head");
      head.appendChild(h("h3", null, title));
      const add = h("button", "btn btn--ghost btn--sm", kind === "assets" ? "+ Add asset" : "+ Add liability");
      add.type = "button";
      add.addEventListener("click", () => { data[kind].push({ id: nwUid(), name: kind === "assets" ? "New asset" : "New liability", value: 0 }); renderRows(); paint(); });
      head.appendChild(add);
      wrap.appendChild(head);
      data[kind].forEach((item) => {
        const row = div("nw-row");
        const name = h("input", "field__num nw-row__name");
        name.type = "text"; name.value = item.name; name.setAttribute("aria-label", `${title} item name`);
        name.addEventListener("input", () => { item.name = name.value; paint(); });
        const wrapIn = div("field__input");
        wrapIn.appendChild(h("span", "field__prefix", getCurrency(currency).symbol));
        const val = h("input", "field__num");
        val.type = "text"; val.inputMode = "decimal"; val.value = item.value ? fmtGrouped(item.value, currency, 0) : "";
        val.addEventListener("input", () => { const p = parseAmountText(val.value); if (Number.isFinite(p)) { item.value = p; paint(); } });
        val.addEventListener("blur", () => { val.value = item.value ? fmtGrouped(item.value, currency, 0) : ""; });
        wrapIn.appendChild(val);
        const rm = h("button", "nw-row__rm", "\u00d7");
        rm.type = "button"; rm.setAttribute("aria-label", `Remove ${item.name}`);
        rm.addEventListener("click", () => { data[kind] = data[kind].filter((x) => x.id !== item.id); renderRows(); paint(); });
        row.appendChild(name); row.appendChild(wrapIn); row.appendChild(rm);
        wrap.appendChild(row);
      });
      formMount.appendChild(wrap);
    };
    section("Assets", "assets");
    section("Liabilities", "liabilities");

    const snap = div("nw-snapshot");
    snap.appendChild(h("h3", null, "Save a snapshot"));
    const date = h("input", "field__num");
    date.type = "date"; date.value = today; date.setAttribute("aria-label", "Snapshot date");
    const btn = h("button", "btn btn--primary btn--sm", "Save snapshot");
    btn.type = "button";
    btn.addEventListener("click", () => {
      const nw = netWorthTotals({ assets: data.assets, liabilities: data.liabilities });
      saveSnapshot({ date: date.value || today, totalAssets: nw.totalAssets, totalLiabilities: nw.totalLiabilities, netWorth: nw.netWorth });
      flash(btn, "Saved");
      paint();
    });
    snap.appendChild(date); snap.appendChild(btn);
    formMount.appendChild(snap);
  };

  renderRows();
  paint();
}

/* ---------------- personalized money plan (custom UI) ---------------- */
const MP_FIELDS = [
  ["age", "Your age", 30],
  ["income", "Monthly income", 80000],
  ["expenses", "Monthly expenses", 55000],
  ["cash", "Cash / emergency savings", 120000],
  ["investments", "Current investments", 400000],
  ["debt", "Total debt", 300000],
  ["debtPayment", "Monthly loan payments", 12000],
  ["returnPct", "Expected return (%)", 12],
  ["inflationPct", "Inflation (%)", 6],
  ["ageRet", "Retirement age", 60]
];

function mpLoadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}
function mpSaveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
function mpHasData(p) {
  return Boolean(p && (Number(p.income) || Number(p.expenses) || Number(p.cash) || Number(p.investments) || Number(p.debt) || Number(p.debtPayment)));
}
function mpTone(score) { return score >= 70 ? "ok" : score >= 45 ? "warn" : "bad"; }

function mpScore(plan) {
  const box = div(`mp-score mp-score--${mpTone(plan.score)}`);
  const ring = div("mp-score__ring");
  ring.appendChild(h("span", "mp-score__num", String(plan.score)));
  ring.appendChild(h("span", "mp-score__out", "/100"));
  box.appendChild(ring);
  const right = div("mp-score__right");
  right.appendChild(h("span", "mp-score__grade", `${plan.grade} financial health`));
  right.appendChild(h("p", "mp-score__note", "From savings rate, safety net, investing rate, debt burden and goal progress."));
  if (plan.opportunities.length) {
    const ul = h("ul", "mp-opps");
    plan.opportunities.forEach((o) => ul.appendChild(h("li", null, `${o.label} - ${o.detail}`)));
    const wrap = div("mp-opps-wrap");
    wrap.appendChild(h("span", "mp-opps__label", "Biggest opportunities"));
    wrap.appendChild(ul);
    right.appendChild(wrap);
  }
  box.appendChild(right);
  return box;
}

function mpPosition(plan, money) {
  const s = plan.snapshot;
  const grid = div("mp-stats");
  const stat = (label, value, hint) => {
    const c = div("mp-stat");
    c.appendChild(h("span", "mp-stat__label", label));
    c.appendChild(h("span", "mp-stat__value", value));
    if (hint) c.appendChild(h("span", "mp-stat__hint", hint));
    grid.appendChild(c);
  };
  stat("Monthly surplus", money(plan.investable), "income minus spending and loans");
  stat("Net worth", money(s.netWorth), `${money(s.investments + s.cash)} saved, ${money(s.debt)} owed`);
  stat("Safety net", `${s.emergencyMonths.toFixed(1)} months`, s.emergencyGap > 0 ? `${money(s.emergencyGap)} short of 6 months` : "6-month buffer in place");
  stat("Debt / income", fmtPct(s.debtRatio, 0), s.debt > 0 ? `${money(s.debt)} outstanding` : "No debt recorded");
  stat("To invest", money(plan.allocation.invest), "after the safety-net and debt steps");
  return grid;
}

function mpPriorities(plan, money) {
  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "Your plan, in order"));
  wrap.appendChild(h("p", "mp-block__note", "Each step names the amount and the timeframe. Work top to bottom."));
  const list = div("mp-priorities");
  plan.priorities.forEach((p, i) => {
    const card = div(`mp-priority mp-priority--${p.tone}`);
    const num = h("span", "mp-priority__num", String(i + 1));
    card.appendChild(num);
    const body = div("mp-priority__body");
    const head = div("mp-priority__head");
    head.appendChild(h("h4", "mp-priority__title", p.title));
    if (p.amount > 0) head.appendChild(h("span", "mp-priority__amount", `${money(p.amount)}/mo`));
    body.appendChild(head);
    body.appendChild(h("p", "mp-priority__text", p.body));
    const meta = div("mp-priority__meta");
    meta.appendChild(h("span", "mp-priority__eta", p.eta));
    const a = h("a", "mp-priority__link", `${p.toLabel} \u2192`);
    a.href = `/${p.to}/`;
    meta.appendChild(a);
    body.appendChild(meta);
    card.appendChild(body);
    list.appendChild(card);
  });
  wrap.appendChild(list);
  return wrap;
}

function mpAllocation(plan, money) {
  const alloc = plan.allocation;
  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "Where this month's surplus goes"));
  wrap.appendChild(h("p", "mp-block__note", `You have ${money(alloc.total)} free each month. Here is the suggested split.`));
  const t = h("table", "mp-table");
  const thead = h("thead");
  const htr = h("tr");
  ["Step", "Amount", "Share"].forEach((x) => htr.appendChild(h("th", null, x)));
  thead.appendChild(htr); t.appendChild(thead);
  const tb = h("tbody");
  const rows = [
    ["Emergency fund", alloc.emergency, "#0ea5e9"],
    ["Debt prepayment", alloc.debt, "#ef4444"],
    ["Retirement & goals", alloc.invest, "#16a34a"]
  ];
  rows.forEach(([label, value]) => {
    const tr = h("tr");
    tr.appendChild(h("td", null, label));
    tr.appendChild(h("td", null, money(value)));
    tr.appendChild(h("td", null, alloc.total > 0 ? fmtPct(value / alloc.total * 100, 0) : "\u2014"));
    tb.appendChild(tr);
  });
  const tr = h("tr", "mp-table__total");
  tr.appendChild(h("td", null, "Total surplus"));
  tr.appendChild(h("td", null, money(alloc.total)));
  tr.appendChild(h("td", null, "100%"));
  tb.appendChild(tr);
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function mpMilestones(plan, money) {
  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "Milestones at your current pace"));
  wrap.appendChild(h("p", "mp-block__note", "Savings only - near-term returns are left out so the path is easy to read."));
  const t = h("table", "mp-table");
  const thead = h("thead");
  const htr = h("tr");
  ["Time", "Net worth", "Added", "Safety net"].forEach((x) => htr.appendChild(h("th", null, x)));
  thead.appendChild(htr); t.appendChild(thead);
  const tb = h("tbody");
  plan.milestones.forEach((m) => {
    const tr = h("tr");
    tr.appendChild(h("td", null, m.label));
    tr.appendChild(h("td", null, money(m.netWorth)));
    tr.appendChild(h("td", null, money(m.saved)));
    tr.appendChild(h("td", null, `${m.emergencyMonths.toFixed(1)} mo`));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function mpScorecard(plan, money) {
  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "Your scorecard"));
  const t = h("table", "mp-table");
  const thead = h("thead");
  const htr = h("tr");
  ["Area", "Your number", "Score", "What good looks like"].forEach((x) => htr.appendChild(h("th", null, x)));
  thead.appendChild(htr); t.appendChild(thead);
  const tb = h("tbody");
  plan.scorecard.forEach((c) => {
    const tr = h("tr");
    tr.appendChild(h("td", null, c.label));
    const shown = c.kind === "pct" ? fmtPct(c.value, c.key === "goal" ? 0 : 1)
      : c.kind === "months" ? `${fmtNum(c.value)} mo` : fmtNum(c.value);
    tr.appendChild(h("td", null, shown));
    const sc = h("td");
    const badge = h("span", `mp-badge mp-badge--${c.tone}`, `${c.score}`);
    sc.appendChild(badge);
    tr.appendChild(sc);
    tr.appendChild(h("td", "mp-table__muted", c.detail));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function mpProgress(plan, money, rerender) {
  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "Progress over time"));
  const snaps = listSnapshots();
  const trend = netWorthTrend(snaps);
  const bar = div("mp-progress-bar");
  const note = h("span", "mp-progress__note", snaps.length >= 2
    ? `${snaps.length} snapshots - last move ${money(trend.change)}`
    : "Save a snapshot each quarter to see your net worth move.");
  const saveBtn = h("button", "btn btn--primary btn--sm", "Save today's net worth");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => {
    const s = plan.snapshot;
    saveSnapshot({ date: new Date().toISOString().slice(0, 10), totalAssets: s.investments + s.cash, totalLiabilities: s.debt, netWorth: s.netWorth });
    flash(saveBtn, "Saved");
    rerender();
  });
  bar.appendChild(note); bar.appendChild(saveBtn);
  wrap.appendChild(bar);
  if (snaps.length >= 2) {
    const t = h("table", "mp-table");
    const thead = h("thead");
    const htr = h("tr");
    ["Date", "Net worth", "Change"].forEach((x) => htr.appendChild(h("th", null, x)));
    thead.appendChild(htr); t.appendChild(thead);
    const tb = h("tbody");
    trend.snapshots.slice().reverse().forEach((sp, i, arr) => {
      const idx = arr.length - 1 - i;
      const prev = idx > 0 ? trend.snapshots[idx - 1].netWorth : null;
      const tr = h("tr");
      tr.appendChild(h("td", null, sp.date));
      tr.appendChild(h("td", null, money(sp.netWorth)));
      tr.appendChild(h("td", null, prev == null ? "\u2014" : money(sp.netWorth - prev)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
  }
  return wrap;
}

function mpGoals(currency, rerender) {
  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "Your goals"));
  wrap.appendChild(h("p", "mp-block__note", "Name what you are saving for. Progress is stored in this browser."));
  const goals = listGoals();
  if (goals.length) {
    const list = div("mp-goals");
    goals.forEach((g) => {
      const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
      const card = div("mp-goal");
      const head = div("mp-goal__head");
      head.appendChild(h("strong", "mp-goal__name", g.name));
      head.appendChild(h("span", "mp-goal__nums", `${fmtMoney(g.saved, currency)} of ${fmtMoney(g.target, currency)}`));
      card.appendChild(head);
      const track = div("mp-goal__track");
      const fill = div("mp-goal__fill");
      fill.style.width = `${pct}%`;
      track.appendChild(fill);
      card.appendChild(track);
      const meta = div("mp-goal__meta");
      const remain = Math.max(0, g.target - g.saved);
      const months = g.monthly > 0 ? Math.ceil(remain / g.monthly) : 0;
      meta.appendChild(h("span", null, `${fmtPct(pct, 0)} funded`));
      meta.appendChild(h("span", null, months > 0 ? `${months} months at ${fmtMoney(g.monthly, currency)}/mo` : "Add a monthly amount"));
      card.appendChild(meta);
      const acts = div("mp-goal__actions");
      const add = h("button", "btn btn--ghost btn--sm", "Add this month");
      add.type = "button";
      add.addEventListener("click", () => { updateGoal(g.id, { saved: Math.min(g.target, g.saved + (g.monthly || 0)) }); rerender(); });
      const rm = h("button", "btn btn--ghost btn--sm", "Remove");
      rm.type = "button";
      rm.addEventListener("click", () => { deleteGoal(g.id); rerender(); });
      acts.appendChild(add); acts.appendChild(rm);
      card.appendChild(acts);
      list.appendChild(card);
    });
    wrap.appendChild(list);
  }
  const form = div("mp-goal-form");
  const mk = (label, type, inputmode) => {
    const lab = h("label", "mp-goal-field");
    lab.appendChild(h("span", "mp-goal-field__label", label));
    const inp = h("input", "mp-goal-field__input");
    inp.type = type; inp.inputMode = inputmode || "text";
    lab.appendChild(inp);
    return { lab, inp };
  };
  const name = mk("Goal name", "text");
  name.inp.placeholder = "e.g. House down payment";
  const target = mk("Target amount", "number", "numeric");
  const saved = mk("Already saved", "number", "numeric");
  const monthly = mk("Monthly saving", "number", "numeric");
  form.appendChild(name.lab); form.appendChild(target.lab); form.appendChild(saved.lab); form.appendChild(monthly.lab);
  const add = h("button", "btn btn--primary btn--sm", "Add goal");
  add.type = "button";
  add.addEventListener("click", () => {
    if (!name.inp.value.trim()) { flash(add, "Name it first"); return; }
    saveGoal({ name: name.inp.value.trim(), target: Number(target.inp.value) || 0, saved: Number(saved.inp.value) || 0, monthly: Number(monthly.inp.value) || 0 });
    rerender();
  });
  form.appendChild(add);
  wrap.appendChild(form);
  return wrap;
}

function mpForm(profile, rerender) {
  const det = h("details", "mp-update");
  det.appendChild(h("summary", "mp-update__summary", mpHasData(profile) ? "Update my numbers" : "Add my numbers"));
  if (!mpHasData(profile)) det.open = true;
  const grid = div("mp-form-grid");
  const inputs = {};
  MP_FIELDS.forEach(([key, label, def]) => {
    const lab = h("label", "mp-field");
    lab.appendChild(h("span", "mp-field__label", label));
    const inp = h("input", "mp-field__input");
    inp.type = "number"; inp.min = "0"; inp.step = "any"; inp.inputMode = "numeric";
    inp.value = profile && profile[key] != null ? profile[key] : "";
    inp.placeholder = def;
    inputs[key] = inp;
    lab.appendChild(inp);
    grid.appendChild(lab);
  });
  det.appendChild(grid);
  const actions = div("mp-form-actions");
  const build = h("button", "btn btn--primary", mpHasData(profile) ? "Update my plan" : "Build my plan");
  build.type = "button";
  build.addEventListener("click", () => {
    const next = {};
    MP_FIELDS.forEach(([key]) => { const v = Number(inputs[key].value); if (Number.isFinite(v) && v > 0) next[key] = v; });
    if (!mpHasData(next)) { flash(build, "Enter your numbers"); return; }
    mpSaveProfile(next);
    rerender();
  });
  const clear = h("button", "btn btn--ghost", "Clear");
  clear.type = "button";
  clear.addEventListener("click", () => { try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ } rerender(); });
  actions.appendChild(build); actions.appendChild(clear);
  det.appendChild(actions);
  return det;
}

function renderMoneyPlan(mounts, currency) {
  const formMount = mounts.form;
  let profile = mpLoadProfile();
  try {
    const sp = new URLSearchParams(location.search).get("p");
    const shared = sp ? decodePlanParam(sp) : null;
    if (shared) { profile = shared; mpSaveProfile(shared); }
    else {
      const pid = new URLSearchParams(location.search).get("plan");
      if (pid) { const plan = getPlan(pid); if (plan && plan.slug === "money-plan") profile = plan.state; }
    }
  } catch { /* ignore */ }
  const money = (v) => fmtMoney(Number(v) || 0, currency);

  const rerender = () => renderMoneyPlan(mounts, currency);

  formMount.innerHTML = "";
  const page = div("money-plan");

  const top = div("mp-top");
  const intro = div("mp-top__intro");
  intro.appendChild(h("h2", "mp-title", "Your personalized money plan"));
  intro.appendChild(h("p", "mp-sub", "Built from your numbers, in plain order. Nothing is uploaded - it lives in this browser."));
  top.appendChild(intro);

  const toolbar = div("mp-toolbar");
  const saveBtn = h("button", "btn btn--primary btn--sm", "Save plan");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => { savePlan("Money plan", "money-plan", { ...(profile || {}) }, null); flash(saveBtn, "Saved"); });
  const printBtn = h("button", "btn btn--ghost btn--sm", "Print / Save PDF");
  printBtn.type = "button"; printBtn.addEventListener("click", () => window.print());
  const reportBtn = h("a", "btn btn--ghost btn--sm", "Full report");
  reportBtn.href = "/plan-report/";
  const shareBtn = h("button", "btn btn--ghost btn--sm", "Share plan link");
  shareBtn.type = "button";
  shareBtn.addEventListener("click", async () => {
    const param = encodePlanParam(profile || {});
    const url = `${location.origin}/money-plan/?p=${param}`;
    if (navigator.share) { try { await navigator.share({ title: "My money plan", text: "Open my money plan:", url }); return; } catch { /* cancelled */ } }
    copyText(url); flash(shareBtn, "Link copied");
  });
  toolbar.appendChild(saveBtn); toolbar.appendChild(printBtn); toolbar.appendChild(reportBtn); toolbar.appendChild(shareBtn);
  top.appendChild(toolbar);
  page.appendChild(top);

  if (!mpHasData(profile)) {
    const empty = div("mp-empty");
    empty.appendChild(h("p", null, "Add seven numbers below and press Build my plan. It takes under a minute and needs no sign-up."));
    page.appendChild(empty);
  } else {
    const plan = moneyPlan(profile);
    page.appendChild(mpScore(plan));
    page.appendChild(mpPosition(plan, money));
    page.appendChild(mpPriorities(plan, money));
    page.appendChild(mpAllocation(plan, money));
    page.appendChild(mpMilestones(plan, money));
    page.appendChild(mpScorecard(plan, money));
    page.appendChild(mpProgress(plan, money, rerender));
  }
  page.appendChild(mpGoals(currency, rerender));
  page.appendChild(mpForm(profile, rerender));
  formMount.appendChild(page);
}

/* ---------------- decision comparisons (custom UI) ---------------- */
const COMPARE_KEY = "finhub_compare_v1";
const COMPARE_FIELDS = {
  prepay: [
    { key: "debt", label: "Loan balance", type: "money", def: 1000000, min: 0, max: 10000000, step: 50000 },
    { key: "rate", label: "Loan interest rate", type: "pct", def: 9, min: 0, max: 24, step: 0.25 },
    { key: "emi", label: "Monthly payment", type: "money", def: 20000, min: 0, max: 200000, step: 1000 },
    { key: "extra", label: "Spare money each month", type: "money", def: 10000, min: 0, max: 200000, step: 1000 },
    { key: "investReturn", label: "Assumed investment return", type: "pct", def: 12, min: 0, max: 30, step: 0.5 }
  ],
  sipfd: [
    { key: "monthly", label: "Monthly investment", type: "money", def: 10000, min: 0, max: 500000, step: 1000 },
    { key: "years", label: "Years invested", type: "years", def: 10, min: 1, max: 40, step: 1 },
    { key: "returnPct", label: "Assumed equity return", type: "pct", def: 12, min: 0, max: 30, step: 0.5 },
    { key: "fdPct", label: "Fixed deposit rate", type: "pct", def: 7, min: 0, max: 15, step: 0.25 },
    { key: "taxPct", label: "Tax on deposit interest", type: "pct", def: 30, min: 0, max: 50, step: 5 }
  ]
};
const COMPARE_NEXT = {
  prepay: [["debt-planner", "Plan the full payoff"], ["home-loan-prepay", "Model a one-off prepayment"], ["savings-planner", "Find more spare money"]],
  sipfd: [["sip", "Project a single SIP"], ["sip-compare", "Compare SIP scenarios"], ["what-if-lab", "Stress-test the return"]]
};

function compareVerdict(mode, r) {
  if (r.tie) return { label: "Too close to call", tone: "tie" };
  if (mode === "sipfd") return r.winner === "sip" ? { label: "The SIP wins", tone: "sip" } : { label: "The deposit wins", tone: "fd" };
  return r.winner === "prepay" ? { label: "Prepaying wins", tone: "prepay" } : { label: "Investing wins", tone: "invest" };
}

function renderCompareResults(mount, mode, r, currency) {
  mount.innerHTML = "";
  if (!r.ok) {
    const warn = div("compare-error");
    warn.appendChild(h("strong", null, "Cannot compare these inputs"));
    warn.appendChild(h("p", null, r.error));
    mount.appendChild(warn);
    return;
  }
  const money = (v) => fmtMoney(Number(v) || 0, currency);
  const v = compareVerdict(mode, r);
  const verdict = div(`compare-verdict compare-verdict--${v.tone}`);
  verdict.appendChild(h("span", "compare-verdict__tag", v.label));
  verdict.appendChild(h("p", "compare-verdict__headline", r.headline));
  verdict.appendChild(h("p", "compare-verdict__because", r.because));
  mount.appendChild(verdict);

  const stats = div("mp-stats");
  const stat = (label, value, hint) => {
    const c = div("mp-stat");
    c.appendChild(h("span", "mp-stat__label", label));
    c.appendChild(h("span", "mp-stat__value", value));
    if (hint) c.appendChild(h("span", "mp-stat__hint", hint));
    stats.appendChild(c);
  };
  if (mode === "prepay") {
    stat("Interest saved by prepaying", money(r.prepay.interestSaved), `clears ${r.prepay.monthsSaved} months early`);
    stat("Invest path, net", money(r.netInvest), "investment value minus interest paid");
    stat("Prepay path, net", money(r.netPrepay), "investment value minus interest paid");
    stat("Break-even return", r.breakEven.value == null ? "n/a" : fmtPct(r.breakEven.value, 1), "invest above this and investing wins");
  } else {
    stat("Total invested", money(r.sip.invested), `over ${r.horizon} years`);
    stat("SIP after tax", money(r.sip.final), "assumed equity return");
    stat("Deposit after tax", money(r.fd.final), "after tax on interest");
    stat("Difference", money(Math.abs(r.diff)), r.diff >= 0 ? "SIP ahead" : "Deposit ahead");
  }
  mount.appendChild(stats);

  const wrap = div("mp-block");
  wrap.appendChild(h("h3", "mp-block__title", "The numbers side by side"));
  const t = h("table", "mp-table");
  const tb = h("tbody");
  r.rows.forEach(([label, value]) => {
    const tr = h("tr");
    tr.appendChild(h("td", null, label));
    tr.appendChild(h("td", "mp-table__muted", value));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  if (r.breakEven && r.breakEven.note) wrap.appendChild(h("p", "mp-block__note", r.breakEven.note));
  mount.appendChild(wrap);

  const caveat = mode === "sipfd"
    ? "Equity returns are not guaranteed and can be negative over short periods; deposits are lower-risk but their real value can trail inflation. This is arithmetic, not advice."
    : "Both paths assume the same monthly outflow and the same investment return, and ignore taxes and loan fees. This is arithmetic, not advice.";
  mount.appendChild(h("p", "compare-caveat", caveat));

  const next = div("mp-block");
  next.appendChild(h("h3", "mp-block__title", "Keep going"));
  const links = div("journey-list");
  (COMPARE_NEXT[mode] || []).forEach(([slug, label]) => {
    const a = h("a", null);
    a.href = `/${slug}/`;
    a.appendChild(h("strong", null, label));
    a.appendChild(h("span", null, "Open the tool"));
    links.appendChild(a);
  });
  next.appendChild(links);
  mount.appendChild(next);
}

function renderCompare(mounts, currency) {
  const formMount = mounts.form;
  const profile = mpLoadProfile();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(COMPARE_KEY)); } catch { saved = null; }
  const mode = saved && COMPARE_FIELDS[saved.mode] ? saved.mode : "prepay";

  const state = { __currency: currency };
  Object.keys(COMPARE_FIELDS).forEach((m) => COMPARE_FIELDS[m].forEach((f) => { state[f.key] = f.def; }));
  if (profile) {
    if (Number(profile.debt) > 0) state.debt = Number(profile.debt);
    if (Number(profile.debtPayment) > 0) state.emi = Number(profile.debtPayment);
    const surplus = Math.max(0, (Number(profile.income) || 0) - (Number(profile.expenses) || 0) - (Number(profile.debtPayment) || 0));
    if (surplus > 0) { state.extra = surplus; state.monthly = surplus; }
    if (Number(profile.returnPct) > 0) { state.investReturn = Number(profile.returnPct); state.returnPct = Number(profile.returnPct); }
  }
  if (saved && saved.values) Object.assign(state, saved.values);
  let activeMode = saved && COMPARE_FIELDS[saved.mode] ? saved.mode : mode;

  const save = () => {
    const values = {};
    Object.keys(state).forEach((k) => { if (!k.startsWith("__")) values[k] = state[k]; });
    try { localStorage.setItem(COMPARE_KEY, JSON.stringify({ mode: activeMode, values })); } catch { /* ignore */ }
  };

  formMount.innerHTML = "";
  const page = div("compare-tool");
  const intro = div("mp-top__intro");
  intro.appendChild(h("h2", "mp-title", "Compare two decisions, side by side"));
  intro.appendChild(h("p", "mp-sub", "Both paths use the same money and the same years, so the only difference is the choice. Numbers come from your inputs."));
  page.appendChild(intro);

  const chips = div("preset-chips");
  chips.appendChild(h("span", "preset-chips__label", "What are you deciding?"));
  const chipEls = {};
  COMPARISON_MODES.forEach((m) => {
    const b = h("button", "preset-chip", m.label);
    b.type = "button";
    b.title = m.hint;
    b.dataset.mode = m.id;
    b.addEventListener("click", () => { activeMode = m.id; syncChips(); buildMode(); update(); });
    chipEls[m.id] = b;
    chips.appendChild(b);
  });
  page.appendChild(chips);
  const syncChips = () => Object.keys(chipEls).forEach((id) => chipEls[id].classList.toggle("is-active", id === activeMode));

  const fieldsWrap = div("compare-fields");
  page.appendChild(fieldsWrap);
  const results = div("compare-results");
  page.appendChild(results);

  const update = () => { save(); renderCompareResults(results, activeMode, compareDecision(activeMode, state), currency); };
  const buildMode = () => {
    fieldsWrap.innerHTML = "";
    COMPARE_FIELDS[activeMode].forEach((spec) => fieldsWrap.appendChild(buildField(spec, state, update).el));
  };

  syncChips();
  buildMode();
  update();
  formMount.appendChild(page);
}

/* ---------------- premium financial report (custom UI) ---------------- */
function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function planReportCsv(plan, goals, money) {
  const rows = [["Section", "Item", "Value"]];
  const add = (section, item, value) => rows.push([section, item, value]);
  add("Position", "Monthly surplus", money(plan.investable));
  add("Position", "Net worth", money(plan.snapshot.netWorth));
  add("Position", "Safety net (months)", plan.snapshot.emergencyMonths.toFixed(1));
  add("Position", "Debt to income (%)", fmtPct(plan.snapshot.debtRatio, 1));
  add("Score", "Financial health score", `${plan.score} / 100 (${plan.grade})`);
  plan.priorities.forEach((p) => add("Plan", p.title, p.amount > 0 ? `${money(p.amount)}/month` : p.eta));
  add("Allocation", "Emergency fund", money(plan.allocation.emergency));
  add("Allocation", "Debt prepayment", money(plan.allocation.debt));
  add("Allocation", "Retirement & goals", money(plan.allocation.invest));
  plan.milestones.forEach((m) => add("Milestones", m.label, `net worth ${money(m.netWorth)}`));
  plan.scorecard.forEach((c) => add("Scorecard", c.label, String(c.score)));
  goals.forEach((g) => add("Goals", g.name, `${money(g.saved)} of ${money(g.target)}`));
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

const HEALTH_NOTE = {
  ok: "Your position is solid across most areas, with a few places worth tightening.",
  warn: "Your position is stable, with several clear areas to improve.",
  bad: "Several fundamentals need attention before your position is on a stable footing."
};

const REPORT_OPP = {
  emergency: { target: "Target: 6 months of expenses held in cash.", to: "emergency-fund-planner", toLabel: "Open the emergency fund planner" },
  savings: { target: "Target: 30% of income left after spending and debt.", to: "savings-planner", toLabel: "Open the savings planner" },
  investing: { target: "Target: 20% of income invested every month.", to: "sip-compare", toLabel: "Open the SIP strategy lab" },
  debt: { target: "Target: keep loan payments under 40% of income.", to: "debt-planner", toLabel: "Plan the payoff" },
  goal: { target: "Target: every goal fully funded on time.", to: "goal-planner", toLabel: "Turn it into a goal" }
};

function svgEl(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
  return n;
}

function reportSection(title, lead) {
  const s = h("section", "report-section");
  const head = div("report-section__head");
  head.appendChild(h("h2", "report-section__title", title));
  if (lead) head.appendChild(h("p", "report-section__lead", lead));
  s.appendChild(head);
  return s;
}

function reportHeader(onPrint, onCsv) {
  const header = h("header", "report-header");
  const main = div("report-header__main");
  main.appendChild(h("p", "report-eyebrow", "Financial report"));
  main.appendChild(h("h1", "report-title", "Your personal financial report"));
  main.appendChild(h("p", "report-sub", "Your position, ordered plan and milestones, assembled from the numbers you entered - in plain language."));
  const stamp = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  main.appendChild(h("p", "report-meta", `Prepared ${stamp} \u00B7 FinHub \u00B7 Educational, not financial advice`));
  header.appendChild(main);
  const actions = div("report-actions");
  const printBtn = h("button", "btn btn--primary btn--sm", "Print / Save PDF");
  printBtn.type = "button";
  printBtn.addEventListener("click", onPrint);
  const csvBtn = h("button", "btn btn--ghost btn--sm", "Download CSV");
  csvBtn.type = "button";
  csvBtn.addEventListener("click", onCsv);
  const edit = h("a", "report-actions__tertiary", "Edit my numbers");
  edit.href = "/money-plan/";
  actions.appendChild(printBtn); actions.appendChild(csvBtn); actions.appendChild(edit);
  header.appendChild(actions);
  return header;
}

function reportHealth(plan) {
  const tone = mpTone(plan.score);
  const sec = h("section", "report-health");
  const ringWrap = div(`report-ring report-ring--${tone}`);
  const r = 52, c = 2 * Math.PI * r;
  const s = svgEl("svg", { viewBox: "0 0 120 120", class: "report-ring__svg", role: "img", "aria-label": `Financial health score ${plan.score} out of 100, ${plan.grade}` });
  s.appendChild(svgEl("circle", { cx: 60, cy: 60, r, fill: "none", stroke: "var(--border)", "stroke-width": 9 }));
  s.appendChild(svgEl("circle", {
    cx: 60, cy: 60, r, fill: "none", stroke: "currentColor", "stroke-width": 9,
    "stroke-linecap": "round", "stroke-dasharray": `${c.toFixed(1)} ${c.toFixed(1)}`,
    "stroke-dashoffset": (c * (1 - plan.score / 100)).toFixed(1), transform: "rotate(-90 60 60)"
  }));
  ringWrap.appendChild(s);
  const label = div("report-ring__label");
  label.appendChild(h("span", "report-ring__num", String(plan.score)));
  label.appendChild(h("span", "report-ring__out", "/100"));
  ringWrap.appendChild(label);
  sec.appendChild(ringWrap);

  const body = div("report-health__body");
  body.appendChild(h("p", "report-health__eyebrow", "Financial health"));
  body.appendChild(h("h2", "report-health__grade", `${plan.grade} financial health`));
  body.appendChild(h("p", "report-health__note", HEALTH_NOTE[tone]));
  const bars = div("report-bars");
  plan.scorecard.forEach((c2) => {
    const row = div("report-bar");
    row.appendChild(h("span", "report-bar__label", c2.label));
    const track = div("report-bar__track");
    const fill = div("report-bar__fill");
    fill.dataset.tone = mpTone(c2.score);
    fill.style.width = `${Math.max(0, Math.min(100, c2.score))}%`;
    track.appendChild(fill); row.appendChild(track);
    bars.appendChild(row);
  });
  body.appendChild(bars);
  sec.appendChild(body);
  return sec;
}

function reportSnapshot(plan, money) {
  const s = plan.snapshot;
  const sec = reportSection("Key financial snapshot", "The five numbers that describe where you stand today.");
  const grid = div("report-snapshot");
  const stat = (label, value, hint, tone) => {
    const c = div("report-stat");
    if (tone) c.dataset.tone = tone;
    c.appendChild(h("span", "report-stat__label", label));
    c.appendChild(h("span", "report-stat__value", value));
    if (hint) c.appendChild(h("span", "report-stat__hint", hint));
    grid.appendChild(c);
  };
  stat("Monthly surplus", money(plan.investable), "income minus spending and loans", plan.investable > 0 ? "ok" : "bad");
  stat("Net worth", money(s.netWorth), `${money(s.investments + s.cash)} saved \u00B7 ${money(s.debt)} owed`);
  stat("Safety net", `${fmtNum(s.emergencyMonths, 1)} months`, s.emergencyGap > 0 ? `${money(s.emergencyGap)} short of 6 months` : "6-month buffer in place", s.emergencyMonths >= 6 ? "ok" : s.emergencyMonths >= 3 ? "warn" : "bad");
  stat("Debt / income", fmtPct(s.debtRatio, 0), s.debt > 0 ? `${money(s.debtPayment)} a month to loans` : "No debt recorded", s.debt === 0 ? "ok" : s.debtRatio <= 40 ? "warn" : "bad");
  stat("To invest", money(plan.allocation.invest), "after safety-net and debt steps");
  sec.appendChild(grid);
  return sec;
}

function reportOpps(plan, money) {
  const sec = reportSection("Biggest opportunities", "The areas where a small change moves your score the most.");
  const list = plan.opportunities || [];
  if (!list.length) {
    const win = div("report-empty report-empty--inline");
    win.appendChild(h("p", null, "No weak areas right now - every component scores 85 or above. Keep the plan running."));
    sec.appendChild(win);
    return sec;
  }
  const grid = div("report-opps");
  list.forEach((o, i) => {
    const meta = REPORT_OPP[o.key] || {};
    const card = div("report-opp");
    card.appendChild(h("span", "report-opp__num", String(i + 1)));
    card.appendChild(h("h3", "report-opp__title", o.label));
    const sc = plan.scorecard.find((x) => x.key === o.key);
    if (sc) {
      const now = sc.kind === "pct" ? `You're at ${fmtPct(sc.value, sc.key === "goal" ? 0 : 1)}.`
        : sc.kind === "months" ? `You're at ${fmtNum(sc.value, 1)} months.` : `You're at ${fmtNum(sc.value)}.`;
      card.appendChild(h("p", "report-opp__now", now));
    }
    card.appendChild(h("p", "report-opp__target", meta.target || o.detail || ""));
    if (o.key === "emergency" && plan.snapshot.emergencyGap > 0) {
      card.appendChild(h("p", "report-opp__gap", `${money(plan.snapshot.emergencyGap)} short of target.`));
    }
    if (meta.to) {
      const a = h("a", "report-opp__link", `${meta.toLabel} \u2192`);
      a.href = `/${meta.to}/`;
      card.appendChild(a);
    }
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

function reportStatus(p) {
  const e = (p.eta || "").toLowerCase();
  if (e.includes("on track") || e.includes("complete")) return "On track";
  if (e.includes("ongoing")) return "Ongoing";
  if (e.includes("long-term")) return "Long-term";
  if (e.includes("action needed")) return "Action needed";
  return "Priority";
}

function reportPlan(plan, money) {
  const sec = reportSection("Your plan, in order", "Work top to bottom. Each step names the amount, the timeframe and the next tool.");
  const ol = h("ol", "report-plan");
  plan.priorities.forEach((p, i) => {
    const li = h("li", `report-step report-step--${p.tone}`);
    const marker = div("report-step__marker");
    marker.appendChild(h("span", "report-step__num", String(i + 1)));
    li.appendChild(marker);
    const body = div("report-step__body");
    const head = div("report-step__head");
    head.appendChild(h("h3", "report-step__title", p.title));
    head.appendChild(h("span", `report-step__status report-step__status--${p.tone}`, reportStatus(p)));
    body.appendChild(head);
    if (p.amount > 0) body.appendChild(h("p", "report-step__amount", `${money(p.amount)} / month`));
    body.appendChild(h("p", "report-step__text", p.body));
    const meta = div("report-step__meta");
    meta.appendChild(h("span", "report-step__eta", p.eta));
    const a = h("a", "report-step__link", `${p.toLabel} \u2192`);
    a.href = `/${p.to}/`;
    meta.appendChild(a);
    body.appendChild(meta);
    li.appendChild(body);
    ol.appendChild(li);
  });
  sec.appendChild(ol);
  return sec;
}

function reportAllocation(plan, money) {
  const a = plan.allocation;
  const sec = reportSection("Where this month's surplus goes", `You have ${money(a.total)} free to allocate each month after living costs and loan payments.`);
  if (a.total <= 0) {
    const e = div("report-empty report-empty--inline");
    e.appendChild(h("p", null, "There is no surplus to allocate yet. Growing income or trimming the largest expense line unblocks this step."));
    sec.appendChild(e);
    return sec;
  }
  const rows = [
    { label: "Emergency fund", value: a.emergency, color: "var(--accent)" },
    { label: "Debt prepayment", value: a.debt, color: "var(--coral)" },
    { label: "Retirement & goals", value: a.invest, color: "var(--accent-2)" }
  ];
  const bar = div("report-alloc__bar");
  rows.forEach((r) => {
    const share = a.total > 0 ? (r.value / a.total) * 100 : 0;
    if (share <= 0) return;
    const seg = div("report-alloc__seg");
    seg.style.width = `${share}%`;
    seg.style.background = r.color;
    seg.title = `${r.label} - ${fmtPct(share, 0)}`;
    bar.appendChild(seg);
  });
  sec.appendChild(bar);
  const list = div("report-alloc__rows");
  rows.forEach((r) => {
    const row = div("report-alloc__row");
    const swatch = div("report-alloc__swatch");
    swatch.style.background = r.color;
    row.appendChild(swatch);
    row.appendChild(h("span", "report-alloc__label", r.label));
    row.appendChild(h("span", "report-alloc__value", money(r.value)));
    row.appendChild(h("span", "report-alloc__share", a.total > 0 ? fmtPct((r.value / a.total) * 100, 0) : "\u2014"));
    list.appendChild(row);
  });
  sec.appendChild(list);
  return sec;
}

function reportMilestones(plan, money) {
  const sec = reportSection("Milestones at your current pace", "Savings only - near-term investment returns are left out so the path stays easy to read.");
  const grid = div("report-milestones");
  plan.milestones.forEach((m) => {
    const card = div("report-milestone");
    card.appendChild(h("span", "report-milestone__when", m.label));
    card.appendChild(h("span", "report-milestone__worth", money(m.netWorth)));
    card.appendChild(h("span", "report-milestone__added", `+${money(m.saved)} accumulated`));
    card.appendChild(h("span", "report-milestone__safety", `Safety net ${fmtNum(m.emergencyMonths, 1)} mo`));
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

function reportScorecard(plan) {
  const sec = reportSection("Your scorecard", "How each part of your position scores against a plain target.");
  const t = h("table", "report-table");
  const thead = h("thead");
  const htr = h("tr");
  ["Area", "Your number", "Score", "What good looks like"].forEach((x) => htr.appendChild(h("th", null, x)));
  thead.appendChild(htr); t.appendChild(thead);
  const tb = h("tbody");
  plan.scorecard.forEach((c) => {
    const tr = h("tr");
    tr.appendChild(h("td", "report-table__area", c.label));
    const shown = c.kind === "pct" ? fmtPct(c.value, c.key === "goal" ? 0 : 1)
      : c.kind === "months" ? `${fmtNum(c.value, 1)} mo` : fmtNum(c.value);
    tr.appendChild(h("td", "report-table__num", shown));
    const sc = h("td", "report-table__score");
    sc.appendChild(h("span", "report-score__val", String(c.score)));
    sc.appendChild(h("span", `report-score__dot report-score__dot--${c.tone}`));
    tr.appendChild(sc);
    tr.appendChild(h("td", "report-table__muted", c.detail));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const wrap = div("report-table-wrap");
  wrap.appendChild(t);
  sec.appendChild(wrap);
  return sec;
}

function reportGoals(goals, money) {
  const sec = reportSection("Goals", "Tracked goals, connected to your monthly plan.");
  if (!goals.length) {
    const e = div("report-empty");
    e.appendChild(h("h3", "report-empty__title", "You haven't added any financial goals yet."));
    e.appendChild(h("p", "report-empty__text", "Add goals to track milestones and connect them to your monthly plan."));
    const a = h("a", "btn btn--ghost btn--sm", "Add a goal");
    a.href = "/goal-planner/";
    e.appendChild(a);
    sec.appendChild(e);
    return sec;
  }
  const t = h("table", "report-table");
  const thead = h("thead");
  const htr = h("tr");
  ["Goal", "Target", "Saved", "Progress", "Monthly"].forEach((x) => htr.appendChild(h("th", null, x)));
  thead.appendChild(htr); t.appendChild(thead);
  const tb = h("tbody");
  goals.forEach((g) => {
    const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
    const tr = h("tr");
    tr.appendChild(h("td", "report-table__area", g.name));
    tr.appendChild(h("td", "report-table__num", money(g.target)));
    tr.appendChild(h("td", "report-table__num", money(g.saved)));
    const pc = h("td", "report-table__progress");
    const track = div("report-mini-track");
    const fill = div("report-mini-track__fill");
    fill.style.width = `${pct}%`;
    track.appendChild(fill); pc.appendChild(track);
    pc.appendChild(h("span", "report-table__pct", fmtPct(pct, 0)));
    tr.appendChild(pc);
    tr.appendChild(h("td", "report-table__num", `${money(g.monthly)}/mo`));
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  const wrap = div("report-table-wrap");
  wrap.appendChild(t);
  sec.appendChild(wrap);
  return sec;
}

function reportAssumptions(plan) {
  const a = h("aside", "report-assumptions");
  const head = div("report-assumptions__head");
  head.appendChild(h("span", "report-assumptions__icon", "i"));
  head.appendChild(h("h2", "report-assumptions__title", "Assumptions & disclaimer"));
  a.appendChild(head);
  a.appendChild(h("p", null, `Figures assume ${fmtPct(plan.profile.returnPct, 0)} returns and ${fmtPct(plan.profile.inflationPct, 0)} inflation over the periods shown, and ignore taxes, fees and loan charges unless stated. Every amount is an estimate computed from the numbers you entered.`));
  a.appendChild(h("p", null, "This report is educational and does not constitute financial, investment, tax or legal advice, and does not account for your full circumstances. Verify figures before acting and consider a licensed professional."));
  return a;
}

function reportEmpty() {
  const wrap = div("report plan-report");
  const e = div("report-empty report-empty--hero");
  e.appendChild(h("span", "report-empty__mark", "FH"));
  e.appendChild(h("h1", "report-empty__title", "Your report is one step away"));
  e.appendChild(h("p", "report-empty__text", "Build your money plan first, then this report fills itself in with your numbers."));
  const a = h("a", "btn btn--primary", "Build my money plan");
  a.href = "/money-plan/";
  e.appendChild(a);
  wrap.appendChild(e);
  return wrap;
}

function renderPlanReport(mounts, currency) {
  const formMount = mounts.form;
  const profile = mpLoadProfile();
  const money = (v) => fmtMoney(Number(v) || 0, currency);
  formMount.innerHTML = "";

  /* The report is a full-width document, so it escapes the two-column
     calculator shell and owns a stable host beside it. */
  const grid = formMount.closest(".calc-grid");
  const host = grid ? grid.parentElement : formMount;
  if (grid) grid.style.display = "none";
  /* The report carries its own strong editorial header, so retire the
     generic tool hero to avoid a duplicated title. */
  const hero = document.querySelector(".page-hero--tool");
  if (hero) hero.style.display = "none";
  let reportHost = grid ? Array.from(host.children).find((n) => n.classList && n.classList.contains("report-host")) : null;
  if (!reportHost) {
    reportHost = div("report-host");
    if (grid) host.insertBefore(reportHost, grid);
    else formMount.appendChild(reportHost);
  }
  reportHost.innerHTML = "";

  if (!mpHasData(profile)) {
    reportHost.appendChild(reportEmpty());
    return;
  }

  const plan = moneyPlan(profile);
  const goals = listGoals();
  const page = div("report plan-report");
  page.appendChild(reportHeader(
    () => window.print(),
    (ev) => { downloadCsv("finhub-financial-report.csv", planReportCsv(plan, goals, money)); flash(ev.currentTarget, "Downloaded"); }
  ));
  page.appendChild(reportHealth(plan));
  page.appendChild(reportSnapshot(plan, money));
  page.appendChild(reportOpps(plan, money));
  page.appendChild(reportPlan(plan, money));
  page.appendChild(reportAllocation(plan, money));
  page.appendChild(reportMilestones(plan, money));
  page.appendChild(reportScorecard(plan));
  page.appendChild(reportGoals(goals, money));
  page.appendChild(reportAssumptions(plan));
  reportHost.appendChild(page);
}

/* ---------------- monthly review (custom UI) ---------------- */
const REVIEW_CHECKS = [
  "I saved or invested this month",
  "My emergency fund is on track",
  "I reviewed my spending",
  "My debt payments are up to date"
];

function renderMonthlyReview(mounts, currency) {
  const formMount = mounts.form;
  const money = (v) => fmtMoney(Number(v) || 0, currency);
  const today = new Date().toISOString().slice(0, 10);

  const render = () => {
    const profile = mpLoadProfile();
    formMount.innerHTML = "";
    const page = div("review-tool");

    if (!mpHasData(profile)) {
      const empty = div("mp-empty");
      empty.appendChild(h("p", null, "Add your numbers first, then come back each month to log progress."));
      const a = h("a", "btn btn--primary btn--sm", "Build my money plan");
      a.href = "/money-plan/";
      empty.appendChild(a);
      page.appendChild(empty);
      formMount.appendChild(page);
      return;
    }

    const plan = moneyPlan(profile);
    const reviews = listReviews();
    const last = reviews.length ? reviews[reviews.length - 1] : null;

    const intro = div("mp-top__intro");
    intro.appendChild(h("h2", "mp-title", "Monthly review"));
    intro.appendChild(h("p", "mp-sub", "A five-minute check-in beats a perfect plan you never look at. Log the month and watch the trend."));
    page.appendChild(intro);

    const stats = div("mp-stats");
    const stat = (label, value, hint) => {
      const c = div("mp-stat");
      c.appendChild(h("span", "mp-stat__label", label));
      c.appendChild(h("span", "mp-stat__value", value));
      if (hint) c.appendChild(h("span", "mp-stat__hint", hint));
      stats.appendChild(c);
    };
    stat("Net worth today", money(plan.snapshot.netWorth));
    stat("Monthly surplus", money(plan.investable));
    stat("Safety net", `${plan.snapshot.emergencyMonths.toFixed(1)} months`);
    if (last) {
      const delta = plan.snapshot.netWorth - last.netWorth;
      const c = div(`mp-stat mp-stat--${delta >= 0 ? "ok" : "warn"}`);
      c.appendChild(h("span", "mp-stat__label", "Since last review"));
      c.appendChild(h("span", "mp-stat__value", `${delta >= 0 ? "+" : ""}${money(delta)}`));
      c.appendChild(h("span", "mp-stat__hint", last.date));
      stats.appendChild(c);
    }
    page.appendChild(stats);

    const form = div("mp-block review-form");
    form.appendChild(h("h3", "mp-block__title", `Review for ${today}`));
    const list = div("review-checklist");
    const boxes = REVIEW_CHECKS.map((label) => {
      const lab = h("label", "review-check");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      lab.appendChild(cb);
      lab.appendChild(h("span", null, label));
      list.appendChild(lab);
      return cb;
    });
    form.appendChild(list);
    const note = document.createElement("textarea");
    note.className = "review-note";
    note.rows = 3;
    note.placeholder = "What changed this month? Anything you want to remember?";
    form.appendChild(note);
    const save = h("button", "btn btn--primary btn--sm", "Save review");
    save.type = "button";
    save.addEventListener("click", () => {
      saveReview({ date: today, netWorth: plan.snapshot.netWorth, savingsRate: plan.snapshot.savingsRate, note: note.value, checks: boxes.map((b) => b.checked) });
      saveSnapshot({ date: today, totalAssets: plan.snapshot.investments + plan.snapshot.cash, totalLiabilities: plan.snapshot.debt, netWorth: plan.snapshot.netWorth });
      flash(save, "Saved");
      render();
    });
    form.appendChild(save);
    page.appendChild(form);

    if (reviews.length) {
      const hist = div("mp-block");
      hist.appendChild(h("h3", "mp-block__title", "Review history"));
      const t = h("table", "mp-table");
      const thead = h("thead");
      const htr = h("tr");
      ["Date", "Net worth", "Change", "Note", ""].forEach((x) => htr.appendChild(h("th", null, x)));
      thead.appendChild(htr); t.appendChild(thead);
      const tb = h("tbody");
      reviews.slice().reverse().forEach((r, i, arr) => {
        const idx = arr.length - 1 - i;
        const prev = idx > 0 ? reviews[idx - 1].netWorth : null;
        const tr = h("tr");
        tr.appendChild(h("td", null, r.date));
        tr.appendChild(h("td", null, money(r.netWorth)));
        tr.appendChild(h("td", null, prev == null ? "\u2014" : money(r.netWorth - prev)));
        tr.appendChild(h("td", "mp-table__muted", r.note || "\u2014"));
        const td = h("td");
        const rm = h("button", "snapshot-list__rm", "\u00d7");
        rm.type = "button"; rm.setAttribute("aria-label", `Delete review ${r.date}`);
        rm.addEventListener("click", () => { deleteReview(r.id); render(); });
        td.appendChild(rm);
        tr.appendChild(td);
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      hist.appendChild(t);
      page.appendChild(hist);
    }

    formMount.appendChild(page);
  };

  render();
}

/* ---------------- my plans (custom UI) ---------------- */
function toolName(slug) {
  const names = {
    dashboard: "Financial Health Dashboard", "goal-planner": "Goal Planner", "retirement-planner": "Retirement Planner",
    "sip-compare": "SIP Strategy Lab", "what-if-lab": "What-If Lab", "debt-planner": "Debt Payoff Planner",
    "emergency-fund-planner": "Emergency Fund Planner", "net-worth-tracker": "Net Worth Tracker", "savings-planner": "Savings Planner"
  };
  return names[slug] || slug;
}
function renderMyPlans(mounts, currency) {
  mounts.form.innerHTML = "";
  const wrap = div("plans-page");
  const toolbar = div("plans-toolbar");
  const exportBtn = h("button", "btn btn--ghost btn--sm", "Export all");
  exportBtn.type = "button";
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([exportPlans()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "finhub-plans.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const importLabel = h("label", "btn btn--ghost btn--sm", "Import");
  importLabel.setAttribute("role", "button");
  const importInput = document.createElement("input");
  importInput.type = "file"; importInput.accept = "application/json"; importInput.style.display = "none";
  importInput.addEventListener("change", () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const res = importPlans(String(reader.result)); flash(importLabel, res.ok ? `Imported ${res.added}` : "Failed"); renderMyPlans(mounts, currency); };
    reader.readAsText(file);
  });
  importLabel.appendChild(importInput);
  toolbar.appendChild(exportBtn); toolbar.appendChild(importLabel);
  wrap.appendChild(toolbar);

  const plans = listPlans();
  if (!plans.length) {
    const empty = div("plans-empty");
    empty.appendChild(h("p", null, "No saved plans yet. Open any tool, set your numbers, and press Save plan."));
    const links = div("plans-empty__links");
    ["dashboard", "goal-planner", "retirement-planner", "net-worth-tracker"].forEach((s) => {
      const a = h("a", "btn btn--ghost btn--sm", toolName(s));
      a.href = `/${s}/`;
      links.appendChild(a);
    });
    empty.appendChild(links);
    wrap.appendChild(empty);
  } else {
    const list = div("plans-list");
    plans.forEach((p) => {
      const card = div("plan-card");
      const top = div("plan-card__top");
      top.appendChild(h("strong", "plan-card__name", p.name));
      top.appendChild(h("span", "plan-card__tool", toolName(p.slug)));
      const dateText = new Date(p.savedAt || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      top.appendChild(h("span", "plan-card__date", dateText));
      card.appendChild(top);
      const meta = div("plan-card__meta");
      const keys = Object.keys(p.state || {}).filter((k) => !k.startsWith("__")).slice(0, 3);
      keys.forEach((k) => {
        const v = p.state[k];
        meta.appendChild(h("span", "plan-card__chip", `${k}: ${typeof v === "number" ? fmtNum(v) : String(v)}`));
      });
      if (p.scenarios && p.scenarios.length) meta.appendChild(h("span", "plan-card__chip", `${p.scenarios.length} scenarios`));
      card.appendChild(meta);
      const acts = div("plan-card__actions");
      const resume = h("a", "btn btn--primary btn--sm", "Resume");
      resume.href = `/${p.slug}/?plan=${encodeURIComponent(p.id)}`;
      const ren = h("button", "btn btn--ghost btn--sm", "Rename");
      ren.type = "button";
      ren.addEventListener("click", () => { const name = window.prompt("Plan name", p.name); if (name) { renamePlan(p.id, name); renderMyPlans(mounts, currency); } });
      const del = h("button", "btn btn--ghost btn--sm", "Delete");
      del.type = "button";
      del.addEventListener("click", () => { deletePlan(p.id); renderMyPlans(mounts, currency); });
      acts.appendChild(resume); acts.appendChild(ren); acts.appendChild(del);
      card.appendChild(acts);
      list.appendChild(card);
    });
    wrap.appendChild(list);
  }

  const snaps = listSnapshots();
  if (snaps.length) {
    const s = div("plans-snapshots");
    s.appendChild(h("h3", null, "Net worth snapshots"));
    const trend = netWorthTrend(snaps);
    const ul = h("ul", "snapshot-list");
    trend.snapshots.slice().reverse().forEach((sp) => {
      const li = h("li");
      li.appendChild(h("span", null, sp.date));
      li.appendChild(h("strong", null, fmtCompactMoney(sp.netWorth, currency)));
      const rm = h("button", "snapshot-list__rm", "\u00d7");
      rm.type = "button"; rm.setAttribute("aria-label", `Delete snapshot ${sp.date}`);
      rm.addEventListener("click", () => { deleteSnapshot(sp.id); renderMyPlans(mounts, currency); });
      li.appendChild(rm);
      ul.appendChild(li);
    });
    s.appendChild(ul);
    wrap.appendChild(s);
  }

  mounts.form.appendChild(wrap);
}

/* ============================================================
   TOOL REGISTRY (client-side wiring)
   ============================================================ */
const TOOL_DEFS = {
  "money-plan": { custom: renderMoneyPlan },
  "compare-decisions": { custom: renderCompare },
  "plan-report": { custom: renderPlanReport },
  "monthly-review": { custom: renderMonthlyReview },
  dashboard: { fields: dashboardFields, compute: computeDashboard, scenarios: null },
  "goal-planner": { fields: goalFields, compute: computeGoal, scenarios: null },
  "retirement-planner": { fields: retirementFields, compute: computeRetirement, scenarios: null, assumptions: true },
  "sip-compare": { fields: compareFields, compute: null, scenarios: compareDefaults, presets: comparePresets },
  "what-if-lab": { fields: whatIfFields, compute: computeWhatIf, scenarios: null, assumptions: true },
  "debt-planner": { fields: debtFields, compute: computeDebt, scenarios: null, assumptions: true },
  "emergency-fund-planner": { fields: emergencyFields, compute: computeEmergency, scenarios: null, assumptions: true },
  "net-worth-tracker": { custom: renderNetWorth, assumptions: true },
  "savings-planner": { fields: savingsFields, compute: computeSavings, scenarios: null, assumptions: true },
  "my-plans": { custom: renderMyPlans }
};

/* ============================================================
   RENDERING
   ============================================================ */
function renderHead(mount, head, cur) {
  mount.innerHTML = "";
  if (!head) return;
  const card = div("result-head");
  card.appendChild(h("span", "result-head__label", head.label));
  card.appendChild(h("span", "result-head__money", head.kind === "text" ? String(head.value) : fmtValue(head.kind, head.value, cur)));
  if (head.negative) card.classList.add("result-head--warn");
  mount.appendChild(card);
}
function renderStats(mount, stats, cur) {
  mount.innerHTML = "";
  if (!stats || !stats.length) return;
  const grid = div("stat-grid");
  stats.forEach((s) => {
    const c = div("stat");
    if (s.negative) c.classList.add("stat--warn");
    c.appendChild(h("span", "stat__label", s.label));
    c.appendChild(h("span", "stat__value", fmtValue(s.kind, s.value, cur)));
    grid.appendChild(c);
  });
  mount.appendChild(grid);
}
function renderCharts(mount, charts, cur) {
  mount.innerHTML = "";
  (charts || []).forEach((m) => renderChart(m, mount, cur));
}
function renderActions(mount, actions) {
  mount.innerHTML = "";
  if (!actions || !actions.length) return;
  const box = div("advisory");
  box.appendChild(h("h3", "advisory__title", "What to do next"));
  actions.forEach((a) => {
    const card = div("advisory__card");
    card.appendChild(h("h4", null, a.title));
    card.appendChild(h("p", null, a.body));
    if (a.items && a.items.length) {
      const ul = h("ul");
      a.items.forEach((i) => ul.appendChild(h("li", null, i)));
      card.appendChild(ul);
    }
    box.appendChild(card);
  });
  mount.appendChild(box);
}

function mountFor(sel) { return document.querySelector(sel); }

/* Visible, plain-language assumptions panel shown under every tool result. */
function renderAssumptions(mount, def, state, cur) {
  if (!mount) return;
  mount.innerHTML = "";
  if (!def.fields) return;
  const fields = def.fields(state).filter((f) => f.type !== "select");
  if (!fields.length) return;
  const det = h("details", "assumptions");
  det.appendChild(h("summary", null, "Assumptions used in this calculation"));
  const ul = h("ul", "assumptions__list");
  fields.forEach((f) => {
    const v = Number(state[f.key]);
    const disp = f.type === "money" ? fmtMoney(v, cur)
      : f.type === "pct" ? fmtPct(v)
      : f.type === "years" ? `${fmtNum(v)} years`
      : f.type === "months" ? `${fmtNum(v)} months`
      : fmtNum(v);
    ul.appendChild(h("li", null, `${f.label}: ${disp}`));
  });
  det.appendChild(ul);
  det.appendChild(h("p", "assumptions__note", "Every figure above is an estimate computed from these assumptions with published formulas. Change any input and the whole calculation updates."));
  mount.appendChild(det);
}

/* "How was this calculated?" trace: inputs -> breakdown -> result, downloadable. */
function toolFieldShown(f, state, cur) {
  const v = state[f.key];
  if (f.options) {
    const o = f.options.find((x) => String(x.v) === String(v));
    return o ? o.label : String(v);
  }
  return fmtValue(f.type, v, cur);
}

function renderToolWork(mount, slug, def, state, last, cur) {
  if (!mount || !last || !def.fields) return;
  mount.innerHTML = "";
  const details = h("details", "calc-work");
  details.appendChild(h("summary", "calc-work__summary", "How was this calculated?"));
  const body = div("calc-work__body");
  details.appendChild(body);

  const inputsSec = div("calc-work__sec");
  inputsSec.appendChild(h("h3", "calc-work__h", "Inputs you provided"));
  const it = h("table", "work-table");
  def.fields(state).forEach((f) => {
    const tr = h("tr");
    tr.appendChild(h("th", null, f.label || f.key));
    tr.appendChild(h("td", null, toolFieldShown(f, state, cur)));
    it.appendChild(tr);
  });
  inputsSec.appendChild(it);
  body.appendChild(inputsSec);

  const donuts = (last.charts || []).filter((c) => c.type === "donut" && c.data && (c.data.segments || []).length);
  const rows = donuts.length
    ? donuts[0].data.segments.map((s) => ({ name: s.name, value: Number(s.value), money: true }))
    : (last.stats || []).map((s) => ({ name: s.label, value: Number(s.value), kind: s.kind }));
  if (rows.length) {
    const bSec = div("calc-work__sec");
    bSec.appendChild(h("h3", "calc-work__h", `Breakdown: ${donuts.length ? (donuts[0].title || "components") : "result components"}`));
    const total = rows.reduce((a, r) => a + (Number.isFinite(r.value) ? r.value : 0), 0);
    const t = h("table", "work-table work-table--grid");
    const thead = h("thead");
    const htr = h("tr");
    ["Component", "Amount", "Share"].forEach((x) => htr.appendChild(h("th", null, x)));
    thead.appendChild(htr);
    t.appendChild(thead);
    const tb = h("tbody");
    rows.forEach((r) => {
      const tr = h("tr");
      tr.appendChild(h("td", null, r.name));
      tr.appendChild(h("td", null, r.money ? fmtMoney(r.value, cur) : fmtValue(r.kind, r.value, cur)));
      tr.appendChild(h("td", null, donuts.length && total > 0 ? fmtPct(r.value / total * 100, 1) : "\u2014"));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    bSec.appendChild(t);
    body.appendChild(bSec);
  }

  if (last.head) {
    const rSec = div("calc-work__sec");
    rSec.appendChild(h("h3", "calc-work__h", "Result"));
    const p = h("p", "calc-work__result");
    p.appendChild(h("strong", null, `${last.head.label}: `));
    p.appendChild(document.createTextNode(fmtValue(last.head.kind, last.head.value, cur)));
    rSec.appendChild(p);
    body.appendChild(rSec);
  }

  const foot = div("calc-work__foot");
  const dl = h("button", "tool-btn", "Download calculation");
  dl.type = "button";
  dl.addEventListener("click", () => {
    const out = [["Section", "Item", "Value"]];
    def.fields(state).forEach((f) => out.push(["Input", f.label || f.key, toolFieldShown(f, state, cur)]));
    rows.forEach((r) => out.push(["Breakdown", r.name, r.money ? fmtMoney(r.value, cur) : fmtValue(r.kind, r.value, cur)]));
    if (last.head) out.push(["Result", last.head.label, fmtValue(last.head.kind, last.head.value, cur)]);
    const csv = out.map((row) => row.map((cell) => {
      const s = String(cell == null ? "" : cell);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\r\n");
    downloadCsv(`finhub-${slug}-calculation.csv`, csv);
    flash(dl, "Downloaded");
  });
  foot.appendChild(dl);
  foot.appendChild(h("span", "calc-work__hint", "CSV of inputs, breakdown and result"));
  body.appendChild(foot);
  mount.appendChild(details);
}

/* Inline "save / resume" bar for standard tools. */
function attachPlanBar(mount, slug, state, getScenarios) {
  if (!mount) return;
  const bar = div("plan-bar");
  const input = h("input", "field__num plan-bar__name");
  input.type = "text";
  input.placeholder = "Name this plan (e.g. House 2028)";
  input.setAttribute("aria-label", "Plan name");
  const save = h("button", "btn btn--primary btn--sm", "Save plan");
  save.type = "button";
  const savedMsg = h("span", "plan-bar__saved", "");
  save.addEventListener("click", () => {
    const entry = savePlan(input.value.trim() || "Untitled plan", slug, state, getScenarios());
    input.value = "";
    savedMsg.textContent = "";
    const a = h("a", "plan-bar__resume", "Saved \u2014 open it");
    a.href = `/${slug}/?plan=${encodeURIComponent(entry.id)}`;
    savedMsg.appendChild(a);
    setTimeout(() => { savedMsg.textContent = ""; }, 6000);
  });
  const my = h("a", "plan-bar__link", "My plans");
  my.href = "/my-plans/";
  bar.append(input, save, savedMsg, my);
  mount.appendChild(bar);
}

function renderTool(slug) {
  const def = TOOL_DEFS[slug];
  if (!def) return;
  const formMount = mountFor("[data-tool-form]");
  const headMount = mountFor("[data-tool-head]");
  const statsMount = mountFor("[data-tool-stats]");
  const chartsMount = mountFor("[data-tool-charts]");
  const tablesMount = mountFor("[data-tool-tables]");
  const actionsMount = mountFor("[data-tool-actions]");
  const noteMount = mountFor("[data-tool-note]");
  const assumptionsMount = mountFor("[data-tool-assumptions]");
  const workMount = mountFor("[data-tool-work]");
  if (!formMount) return;

  const state = { __currency: readState() || "INR" };

  /* custom-rendered tools own their own state + storage */
  if (def.custom) {
    const resultsCard = formMount.closest(".calc-grid") ? formMount.closest(".calc-grid").querySelector(".results-card") : null;
    if (resultsCard && !def.fields) resultsCard.style.display = "none";
    def.custom({
      form: formMount, head: headMount, stats: statsMount, charts: chartsMount,
      tables: tablesMount, actions: actionsMount, note: noteMount, assumptions: assumptionsMount
    }, state.__currency);
    const curSel = mountFor("[data-currency]");
    if (curSel) {
      curSel.value = state.__currency;
      curSel.addEventListener("change", () => {
        state.__currency = CURRENCIES[curSel.value] ? curSel.value : "INR";
        try { localStorage.setItem("finhub_currency", JSON.stringify(state.__currency)); } catch { /* ignore */ }
        renderTool(slug);
      });
    }
    return;
  }

  const storeKey = `finhub_tool_${slug}`;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(storeKey)); } catch { return null; } })();
  if (saved && typeof saved === "object") Object.assign(state, saved);

  let scenarios = def.scenarios ? def.scenarios() : null;
  if (saved && Array.isArray(saved.__scenarios) && scenarios) scenarios = saved.__scenarios;

  /* resume a named plan via ?plan=<id> */
  let planId = null;
  try { planId = new URLSearchParams(location.search).get("plan"); } catch { planId = null; }
  if (planId) {
    const plan = getPlan(planId);
    if (plan && plan.slug === slug) {
      Object.assign(state, plan.state);
      if (plan.scenarios && scenarios) scenarios = plan.scenarios;
    }
  }

  /* First visit (no saved state, no resumed plan): carry the numbers the user
     already typed into the homepage snapshot, so nothing is re-entered. */
  let prefilled = false;
  if (!saved && !planId) {
    let profile = null;
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { profile = null; }
    const pf = profile ? profileToState(slug, profile) : null;
    if (pf) { Object.assign(state, pf); prefilled = true; }
  }

  const persist = () => {
    try {
      const clone = { ...state };
      if (scenarios) clone.__scenarios = scenarios;
      localStorage.setItem(storeKey, JSON.stringify(clone));
    } catch { /* ignore */ }
    try {
      const p = new URLSearchParams();
      Object.keys(state).forEach((k) => { if (k !== "__currency" && !k.startsWith("__")) p.set(k, state[k]); });
      history.replaceState(null, "", `?${p.toString()}`);
    } catch { /* ignore */ }
  };

  let last = null;
  const paint = () => {
    persist();
    if (slug === "sip-compare") { last = def.compute ? def.compute(state, scenarios, state.__currency) : computeCompare(state, scenarios, state.__currency); }
    else last = def.compute(state, state.__currency);
    renderHead(headMount, last.head, state.__currency);
    renderStats(statsMount, last.stats, state.__currency);
    renderCharts(chartsMount, last.charts, state.__currency);
    renderTablesInto(tablesMount, null, state.__currency, { tables: last.tables || [], title: false });
    renderActions(actionsMount, last.actions);
    renderAssumptions(assumptionsMount, def, state, state.__currency);
    renderToolWork(workMount, slug, def, state, last, state.__currency);
    if (noteMount) noteMount.textContent = last.note || "";
  };
  const onChange = () => paint();

  const form = document.createDocumentFragment();
  def.fields(state).forEach((spec) => form.appendChild(buildField(spec, state, onChange).el));

  if (def.scenarios) {
    const list = div("scenario-list");
    const rebuild = () => {
      list.innerHTML = "";
      scenarios.forEach((sc, i) => {
        const card = div("scenario-card");
        const header = div("scenario-card__head");
        header.appendChild(h("h3", null, sc.name));
        if (scenarios.length > 2) {
          const rm = h("button", "scenario-card__rm", "\u00d7");
          rm.type = "button";
          rm.setAttribute("aria-label", `Remove ${sc.name}`);
          rm.addEventListener("click", () => { scenarios.splice(i, 1); scenarios.forEach((x, k) => { x.name = `Scenario ${String.fromCharCode(65 + k)}`; }); rebuild(); paint(); });
          header.appendChild(rm);
        }
        card.appendChild(header);
        scenarioFields(sc).forEach((spec) => card.appendChild(buildField(spec, sc, onChange).el));
        list.appendChild(card);
      });
      const add = h("button", "btn btn--ghost btn--sm", "+ Add a scenario");
      add.type = "button";
      add.disabled = scenarios.length >= 5;
      add.addEventListener("click", () => {
        if (scenarios.length >= 5) return;
        scenarios.push({ id: `s${scenarios.length + 1}`, name: `Scenario ${String.fromCharCode(65 + scenarios.length)}`, monthly: 10000, initial: 0, stepUpPct: 0, years: 20, returnPct: 12 });
        rebuild(); paint();
      });
      list.appendChild(add);
    };

    if (def.presets) {
      const chips = div("preset-chips");
      chips.appendChild(h("span", "preset-chips__label", "Quick presets"));
      def.presets().forEach((p) => {
        const b = h("button", "preset-chip", p.label);
        b.type = "button";
        b.addEventListener("click", () => {
          scenarios = p.scenarios.map((x) => ({ ...x }));
          rebuild(); paint();
        });
        chips.appendChild(b);
      });
      form.appendChild(chips);
    }

    rebuild();
    form.appendChild(list);
  }
  formMount.innerHTML = "";
  formMount.appendChild(form);
  attachPlanBar(formMount, slug, state, () => scenarios);
  if (prefilled) {
    const note = div("prefill-note");
    note.appendChild(h("span", "prefill-note__text", "Pre-filled from the numbers you entered on the homepage."));
    const reset = h("button", "prefill-note__reset", "Reset to defaults");
    reset.type = "button";
    reset.addEventListener("click", () => {
      const defaults = { __currency: state.__currency };
      def.fields(state).forEach((f) => { defaults[f.key] = f.def; });
      try { localStorage.setItem(storeKey, JSON.stringify(defaults)); } catch { /* ignore */ }
      renderTool(slug);
    });
    note.appendChild(reset);
    formMount.appendChild(note);
  }

  /* toolbar */
  const curSel = mountFor("[data-currency]");
  if (curSel) {
    curSel.value = state.__currency;
    curSel.addEventListener("change", () => { state.__currency = CURRENCIES[curSel.value] ? curSel.value : "INR"; localStorage.setItem("finhub_currency", JSON.stringify(state.__currency)); paint(); });
  }
  const shareBtn = mountFor("[data-share]");
  if (shareBtn) shareBtn.addEventListener("click", async () => {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title: document.title, text: last ? last.summary : "", url }); return; } catch { /* cancelled */ } }
    copyText(url); flash(shareBtn, "Link copied");
  });
  const copyBtn = mountFor("[data-copy]");
  if (copyBtn) copyBtn.addEventListener("click", () => { copyText((last ? last.summary : "") + "\n\n" + location.href); flash(copyBtn, "Copied"); });
  const csvBtn = mountFor("[data-csv]");
  if (csvBtn) csvBtn.addEventListener("click", () => {
    const csv = last && last.tables && last.tables.length ? last.tablesToCsv || null : null;
    if (csv) { downloadCsv(`finhub-${slug}.csv`, csv); flash(csvBtn, "Downloaded"); return; }
    // fall back: build CSV from the rendered tables
    const rows = [];
    (last && last.tables || []).forEach((t) => {
      rows.push(t.title);
      rows.push(t.columns.map((c) => c.label).join(","));
      t.rows.forEach((r) => rows.push(r.map((x) => (typeof x === "string" && /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(",")));
      rows.push("");
    });
    if (!rows.length) { flash(csvBtn, "No table to export"); return; }
    downloadCsv(`finhub-${slug}.csv`, rows.join("\n")); flash(csvBtn, "Downloaded");
  });
  const printBtn = mountFor("[data-print]");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
  const resetBtn = mountFor("[data-reset]");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
    Object.keys(state).forEach((k) => delete state[k]);
    state.__currency = readState() || "INR";
    if (def.scenarios) scenarios = def.scenarios();
    renderTool(slug);
  });

  paint();
}

/* ---------------- public ---------------- */
export function initTool(slug) {
  if (!TOOL_DEFS[slug]) return;
  renderTool(slug);
  const recent = (() => { try { return JSON.parse(localStorage.getItem("finhub_recent")) || []; } catch { return []; } })();
  const arr = recent.filter((s) => s !== slug);
  arr.unshift(slug);
  try { localStorage.setItem("finhub_recent", JSON.stringify(arr.slice(0, 6))); } catch { /* ignore */ }
}

export { TOOL_DEFS };
