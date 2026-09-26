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
  profileToState, PROFILE_KEY
} from "./engine.js";
import {
  listPlans, getPlan, savePlan, deletePlan, renamePlan,
  exportPlans, importPlans, listSnapshots, saveSnapshot, deleteSnapshot
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
