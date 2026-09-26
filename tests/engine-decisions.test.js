import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tvm, projectPlan, inflate, sipInvested, requiredMonthly, solveStepUp, solveYears,
  goalPlan, buildStrategies, compareScenarios, savingsPlan, healthScore,
  whatIf, WHAT_IF_LEVERS, TOOLS, getTool, nextSteps, JOURNEYS, CALC_LIST
} from "../assets/js/engine.js";

const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const finite = (v) => typeof v === "number" && Number.isFinite(v);

/* ---------------- projectPlan ---------------- */
test("projectPlan: no step-up matches the annuity-due SIP formula", () => {
  const p = 10000, years = 10, r = 12;
  const proj = projectPlan({ monthly: p, years, returnPct: r });
  assert.ok(close(proj.final, tvm.sipFV(p, years * 12, r), 1e-9));
  assert.equal(proj.invested, p * years * 12);
  assert.equal(proj.gains, proj.final - proj.invested);
});

test("projectPlan: step-up matches the engine step-up formula", () => {
  const p = 8000, years = 12, r = 11, step = 9;
  const proj = projectPlan({ monthly: p, years, returnPct: r, stepUpPct: step });
  assert.ok(close(proj.final, tvm.sipStepUpFV(p, years * 12, r, step), 1e-9));
  assert.ok(close(proj.invested, sipInvested(p, years * 12, step), 1e-9));
});

test("projectPlan: initial capital grows at the monthly rate", () => {
  const proj = projectPlan({ initial: 100000, monthly: 0, years: 5, returnPct: 10 });
  assert.ok(close(proj.final, 100000 * Math.pow(1 + 0.10 / 12, 60), 1e-9));
  assert.equal(proj.invested, 100000);
});

test("projectPlan: a one-year pause reduces the final corpus but never below the invested floor logic", () => {
  const base = projectPlan({ monthly: 10000, years: 10, returnPct: 12 });
  const paused = projectPlan({ monthly: 10000, years: 10, returnPct: 12, skipStartMonth: 24, skipMonths: 12 });
  assert.ok(paused.final < base.final);
  assert.ok(paused.invested < base.invested);
  assert.equal(base.labels.length, 11);
  assert.equal(base.corpusSeries[base.corpusSeries.length - 1], base.final);
});

test("projectPlan: inflation series is the real (today's-money) value", () => {
  const proj = projectPlan({ monthly: 5000, years: 10, returnPct: 12, inflationPct: 6 });
  assert.ok(close(proj.real, proj.final / Math.pow(1.06, 10), 1e-9));
  assert.ok(proj.real < proj.final);
});

/* ---------------- helpers ---------------- */
test("inflate compounds at the given rate", () => {
  assert.ok(close(inflate(1000000, 6, 10), 1000000 * Math.pow(1.06, 10)));
  assert.equal(inflate(1000000, 6, 0), 1000000);
});

test("requiredMonthly is the exact inverse of the annuity-due factor", () => {
  const gap = 5000000, n = 180, r = 11;
  const m = requiredMonthly(gap, n, r);
  assert.ok(close(tvm.sipFV(m, n, r), gap, 1e-9));
});

test("solveStepUp finds a step-up that reaches the target (and 0 when already met)", () => {
  const target = tvm.sipStepUpFV(10000, 180, 12, 0) * 1.5;
  const step = solveStepUp(10000, 15, 12, target);
  assert.ok(step > 0 && step <= 40);
  assert.ok(tvm.sipStepUpFV(10000, 180, 12, step) >= target - 1);
  assert.equal(solveStepUp(10000, 15, 12, 0), 0);
  assert.equal(solveStepUp(0, 15, 12, target), 0);
});

test("solveYears returns the earliest half-year reaching an inflating goal", () => {
  const y = solveYears({ monthly: 20000, initial: 0, returnPct: 12, stepUpPct: 0, inflationPct: 6, goalAmount: 10000000 }, 60);
  assert.ok(y != null && y > 0);
  const atTarget = projectPlan({ monthly: 20000, years: y, returnPct: 12, stepUpPct: 0 });
  assert.ok(atTarget.final >= inflate(10000000, 6, y) - 1);
});

/* ---------------- goalPlan ---------------- */
test("goalPlan: accounting identities hold", () => {
  const g = goalPlan({ goalAmount: 5000000, years: 15, inflationPct: 6, returnPct: 12, currentSavings: 500000, monthly: 10000, stepUpPct: 0 });
  assert.ok(close(g.futureGoal, inflate(5000000, 6, 15)));
  assert.equal(g.goalAchieved, g.futureGoal <= g.projected);
  assert.ok(close(g.shortfall - g.surplus, g.futureGoal - g.projected, 1e-6));
  assert.ok(g.progress >= 0 && g.progress <= 1);
  assert.ok(g.requiredMonthly >= 0);
  assert.ok(g.projected > 0);
});

test("goalPlan: a large enough SIP is flagged achieved with zero shortfall", () => {
  const g = goalPlan({ goalAmount: 1000000, years: 10, inflationPct: 0, returnPct: 10, currentSavings: 0, monthly: 20000, stepUpPct: 0 });
  assert.equal(g.goalAchieved, true);
  assert.equal(g.shortfall, 0);
  assert.ok(g.surplus > 0);
});

test("goalPlan: requiredMonthly actually reaches the goal when invested", () => {
  const g = goalPlan({ goalAmount: 5000000, years: 15, inflationPct: 6, returnPct: 12, currentSavings: 0, monthly: 0, stepUpPct: 0 });
  const proj = projectPlan({ monthly: g.requiredMonthly, years: 15, returnPct: 12 });
  assert.ok(proj.final >= g.futureGoal - 1);
});

/* ---------------- buildStrategies ---------------- */
test("buildStrategies: produces costed options and one recommendation", () => {
  const res = buildStrategies({ goalAmount: 5000000, years: 15, inflationPct: 6, returnPct: 12, currentSavings: 500000, monthly: 10000, stepUpPct: 0 });
  assert.ok(res.strategies.length >= 3);
  res.strategies.forEach((s) => {
    ["projected", "invested", "gains", "realProjected", "shortfall"].forEach((k) => assert.ok(finite(s[k]), `${s.id}.${k} not finite`));
    assert.equal(typeof s.goalAchieved, "boolean");
    assert.equal(s.recommended, s.id === res.recommendedId);
  });
  assert.ok(res.strategies.find((s) => s.id === "current"));
  assert.ok(res.strategies.filter((s) => s.goalAchieved).length >= 1, "at least one strategy should reach the goal");
});

test("buildStrategies: recommends a goal-achieving strategy, not the baseline, when off track", () => {
  const res = buildStrategies({ goalAmount: 10000000, years: 15, inflationPct: 6, returnPct: 12, currentSavings: 0, monthly: 5000, stepUpPct: 0 });
  const rec = res.strategies.find((s) => s.recommended);
  assert.ok(rec);
  assert.notEqual(rec.id, "current");
  assert.equal(rec.goalAchieved, true);
});

/* ---------------- compareScenarios ---------------- */
test("compareScenarios: metrics are correct and comparable", () => {
  const cmp = compareScenarios([
    { name: "A", monthly: 5000, initial: 0, stepUpPct: 0, years: 20, returnPct: 12 },
    { name: "B", monthly: 10000, initial: 0, stepUpPct: 0, years: 20, returnPct: 12 },
    { name: "C", monthly: 5000, initial: 0, stepUpPct: 10, years: 20, returnPct: 12 }
  ], { inflationPct: 6, goalAmount: 10000000 });
  assert.equal(cmp.rows.length, 3);
  const [a, b, c] = cmp.rows;
  assert.ok(b.projected > a.projected);
  assert.ok(c.projected > a.projected); // step-up beats flat
  assert.ok(c.invested > a.invested);
  assert.equal(b.highestCorpus, true);
  assert.ok(close(a.gains, a.projected - a.invested));
  assert.ok(a.cagrPct > 0 && a.cagrPct < a.returnPct);
  assert.equal(a.series.length, 21);
  a.perYear.forEach((r) => assert.ok(finite(r.principal) && finite(r.interest) && finite(r.balance)));
});

test("compareScenarios: handles zero-return and zero-year inputs without NaN", () => {
  const cmp = compareScenarios([{ monthly: 0, initial: 0, years: 0, returnPct: 0 }]);
  const r = cmp.rows[0];
  assert.equal(r.projected, 0);
  assert.equal(r.invested, 0);
  assert.equal(r.gains, 0);
  assert.ok(finite(r.cagrPct));
});

/* ---------------- savingsPlan ---------------- */
test("savingsPlan: rates, emergency fund and scenarios behave", () => {
  const s = savingsPlan({ income: 100000, fixed: 30000, variable: 20000, debt: 15000, monthlyInvestment: 15000, savings: 200000, years: 15, returnPct: 12, inflationPct: 6 });
  assert.equal(s.expenses, 50000);
  assert.equal(s.outflow, 65000);
  assert.equal(s.cashFlow, 35000);
  assert.equal(s.surplus, 20000);
  assert.ok(close(s.savingsRate, 35));
  assert.ok(close(s.investmentRate, 15));
  assert.ok(close(s.expenseRatio, 65));
  assert.ok(close(s.debtRatio, 15));
  assert.equal(s.emergencyTarget, 6 * 65000);
  assert.equal(s.emergencyGap, 6 * 65000 - 200000);
  assert.equal(s.extraInvestable, 20000);
  assert.equal(s.scenarios.length, 4);
  assert.ok(s.scenarios[3].projected > s.scenarios[0].projected);
});

test("savingsPlan: zero income is safe", () => {
  const s = savingsPlan({ income: 0, fixed: 1000, variable: 0, debt: 0 });
  assert.equal(s.savingsRate, 0);
  assert.equal(s.investmentRate, 0);
  assert.ok(finite(s.surplus));
});

/* ---------------- healthScore ---------------- */
test("healthScore: bounded, weighted, transparent", () => {
  const h = healthScore({ income: 100000, fixed: 30000, variable: 20000, debt: 10000, monthlyInvestment: 20000, savings: 400000, goalProgress: 0.7 });
  assert.ok(h.score >= 0 && h.score <= 100);
  assert.equal(h.components.length, 5);
  assert.equal(h.components.reduce((a, c) => a + c.weight, 0), 100);
  h.components.forEach((c) => assert.ok(c.score >= 0 && c.score <= 100));
  assert.equal(h.grade === "Excellent" || h.grade === "Strong" || h.grade === "Fair" || h.grade === "Needs work" || h.grade === "At risk", true);
  for (let i = 1; i < h.improvements.length; i++) assert.ok(h.improvements[i].score >= h.improvements[i - 1].score);
});

test("healthScore: a strong balance sheet outranks a fragile one", () => {
  const strong = healthScore({ income: 200000, fixed: 40000, variable: 20000, debt: 0, monthlyInvestment: 60000, savings: 1200000, goalProgress: 1 });
  const weak = healthScore({ income: 50000, fixed: 35000, variable: 15000, debt: 20000, monthlyInvestment: 0, savings: 10000, goalProgress: 0.05 });
  assert.ok(strong.score > weak.score);
  assert.ok(weak.improvements.length > 0);
});

/* ---------------- whatIf ---------------- */
test("whatIf: each lever moves the corpus in the expected direction", () => {
  const base = { monthly: 10000, initial: 100000, years: 15, returnPct: 12, stepUpPct: 0, inflationPct: 6, goalAmount: 5000000 };
  const expect = { raise_sip: 1, step_up: 1, extend: 1, lump_sum: 1, lower_return: -1, inflation: 0, pause: -1, retire_early: -1 };
  WHAT_IF_LEVERS.forEach((l) => {
    const r = whatIf(base, l.id);
    assert.ok(finite(r.modified.projected) && finite(r.deltaCorpus), `${l.id} not finite`);
    if (expect[l.id] > 0) assert.ok(r.deltaCorpus > 0, `${l.id} should increase corpus`);
    if (expect[l.id] < 0) assert.ok(r.deltaCorpus < 0, `${l.id} should decrease corpus`);
    if (expect[l.id] === 0) assert.ok(Math.abs(r.deltaCorpus) < 1e-6, `${l.id} should not move the nominal corpus`);
  });
});

test("whatIf: the inflation lever cuts the real value without moving the nominal corpus", () => {
  const base = { monthly: 10000, initial: 100000, years: 15, returnPct: 12, stepUpPct: 0, inflationPct: 6, goalAmount: 5000000 };
  const r = whatIf(base, "inflation");
  assert.equal(r.lever.realDelta, true);
  assert.ok(Math.abs(r.deltaCorpus) < 1e-6);
  assert.ok(r.deltaReal < 0, "higher inflation should reduce real corpus");
  assert.ok(finite(r.deltaReal));
});

/* ---------------- registry + journeys ---------------- */
test("TOOLS registry and getTool", () => {
  assert.ok(TOOLS.length >= 5);
  TOOLS.forEach((t) => { assert.ok(t.slug && t.name && t.tagline); assert.equal(getTool(t.slug).slug, t.slug); });
  assert.equal(getTool("nope"), null);
});

test("nextSteps resolves to real calculators or tools", () => {
  const s = nextSteps("sip");
  assert.ok(s.length >= 2);
  s.forEach((x) => {
    assert.ok(x.kind === "calc" || x.kind === "tool");
    assert.ok(x.name && x.why);
    if (x.kind === "calc") assert.ok(CALC_LIST.some((c) => c.slug === x.slug));
    else assert.ok(getTool(x.slug));
  });
  assert.deepEqual(nextSteps("unknown-slug"), []);
});

test("every journey target resolves to a real page", () => {
  Object.keys(JOURNEYS).forEach((slug) => {
    assert.ok(CALC_LIST.some((c) => c.slug === slug) || getTool(slug), `journey source ${slug} is not a page`);
    nextSteps(slug).forEach((x) => assert.ok(x.slug, `unresolved target in ${slug}`));
  });
});
