import { test } from "node:test";
import assert from "node:assert/strict";
import {
  retirementPlan, simulateDebts, debtPlan, emergencyPlan,
  netWorthTotals, netWorthTrend, sipStrategies,
  TOOLS, getTool, JOURNEYS, nextSteps, CALC_LIST
} from "../assets/js/engine.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const finites = (a) => a.every(finite);

/* ---------------- registry ---------------- */
test("TOOLS: slugs are unique and resolvable", () => {
  const slugs = TOOLS.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  slugs.forEach((s) => assert.ok(getTool(s), `getTool(${s})`));
});

test("nextSteps: journeys resolve to real calcs or tools", () => {
  for (const slug of Object.keys(JOURNEYS)) {
    const steps = nextSteps(slug);
    assert.ok(steps.length >= 1, `${slug} should have at least one step`);
    steps.forEach((s) => assert.ok(s.slug && s.name && s.kind, `${slug} step shape`));
  }
});

test("JOURNEYS: every calculator is cross-linked into a journey", () => {
  CALC_LIST.forEach((c) => {
    assert.ok(JOURNEYS[c.slug], `missing JOURNEYS entry for ${c.slug}`);
    assert.ok(nextSteps(c.slug).length >= 1, `${c.slug} resolves to zero steps`);
    assert.equal(nextSteps(c.slug).length, JOURNEYS[c.slug].length, `${c.slug} has a broken journey target`);
  });
});

test("JOURNEYS: every decision tool is cross-linked into a journey", () => {
  TOOLS.forEach((t) => {
    assert.ok(JOURNEYS[t.slug], `missing JOURNEYS entry for ${t.slug}`);
    assert.ok(nextSteps(t.slug).length >= 1, `${t.slug} resolves to zero steps`);
  });
});

/* ---------------- retirementPlan ---------------- */
const RETIRE_IN = {
  ageNow: 30, ageRet: 60, lifeExp: 85, monthlyExpense: 60000,
  inflationPct: 6, returnPct: 11, wdReturnPct: 7, corpusNow: 500000, monthlySave: 15000
};

test("retirementPlan: shape and invariants on the current plan", () => {
  const r = retirementPlan(RETIRE_IN);
  assert.equal(r.ageNow, 30);
  assert.equal(r.ageRet, 60);
  assert.ok(r.corpusNeeded > 0);
  assert.ok(finite(r.projected) && finite(r.requiredMonthly));
  assert.ok(r.requiredMonthly >= 0);
  assert.equal(r.onTrack, r.projected >= r.corpusNeeded);
  assert.ok(r.progress >= 0 && r.progress <= 1);
  assert.equal(r.scenarios.length, 5);
  assert.equal(r.curve.labels.length, 85 - 30 + 1);
  assert.ok(finites(r.curve.corpus));
  assert.equal(r.curve.retireAge, 60);
});

test("retirementPlan: saving more always projects more, never less than required gap", () => {
  const r = retirementPlan(RETIRE_IN);
  const saveMore = r.scenarios.find((s) => s.id === "save-more");
  const current = r.scenarios.find((s) => s.id === "current");
  assert.ok(saveMore.projected > current.projected);
  assert.ok(saveMore.requiredMonthly <= current.requiredMonthly);
  assert.ok(saveMore.gap <= current.gap);
});

test("retirementPlan: an on-track plan needs no extra monthly saving", () => {
  const r = retirementPlan({ ...RETIRE_IN, monthlySave: 500000 });
  assert.ok(r.onTrack);
  assert.equal(r.gap, 0);
  assert.equal(r.requiredMonthly, 0);
  assert.equal(r.progress, 1);
});

test("retirementPlan: retiring earlier raises the required monthly saving", () => {
  const r = retirementPlan(RETIRE_IN);
  const earlier = r.scenarios.find((s) => s.id === "earlier");
  const current = r.scenarios.find((s) => s.id === "current");
  assert.ok(earlier.yearsToRetire < current.yearsToRetire);
  assert.ok(earlier.requiredMonthly > current.requiredMonthly);
});

/* ---------------- debtPlanner ---------------- */
const DEBTS = [
  { id: "card", name: "Card", balance: 200000, apr: 15, payment: 8000 },
  { id: "loan", name: "Loan", balance: 50000, apr: 24, payment: 2000 }
];

test("simulateDebts: extra payment clears sooner and costs less interest", () => {
  const base = simulateDebts(DEBTS, 0, "avalanche");
  const extra = simulateDebts(DEBTS, 5000, "avalanche");
  assert.equal(base.months != null, true);
  assert.ok(extra.months <= base.months);
  assert.ok(extra.totalInterest <= base.totalInterest);
  assert.ok(extra.pmtTotal > base.pmtTotal);
});

test("simulateDebts: avalanche never costs more interest than snowball", () => {
  const av = simulateDebts(DEBTS, 5000, "avalanche");
  const sn = simulateDebts(DEBTS, 5000, "snowball");
  assert.ok(av.totalInterest <= sn.totalInterest + 1e-6);
});

test("simulateDebts: order follows the chosen strategy", () => {
  const av = simulateDebts(DEBTS, 0, "avalanche").order.map((d) => d.id);
  const sn = simulateDebts(DEBTS, 0, "snowball").order.map((d) => d.id);
  assert.deepEqual(av, ["loan", "card"]);
  assert.deepEqual(sn, ["loan", "card"]);
});

test("simulateDebts: a payment below monthly interest never clears", () => {
  const stuck = simulateDebts([{ id: "x", balance: 100000, apr: 36, payment: 1000 }], 0, "avalanche");
  assert.equal(stuck.months, null);
  assert.equal(stuck.clearedAt.x, undefined);
});

test("debtPlan: scenario list is monotonic in extra payment", () => {
  const dp = debtPlan({ debts: DEBTS, extra: 5000, strategy: "avalanche" });
  assert.equal(dp.strategy, "avalanche");
  assert.equal(dp.canClear, true);
  assert.ok(dp.monthlyBudget >= dp.minTotal);
  assert.equal(dp.scenarios.length, 4);
  assert.ok(dp.scenarios[3].extra > dp.scenarios[0].extra);
  assert.ok(dp.scenarios[3].totalInterest <= dp.scenarios[0].totalInterest);
  assert.ok(dp.scenarios[3].interestSaved >= dp.scenarios[0].interestSaved);
  assert.ok(finite(dp.avalanche.totalInterest) && finite(dp.snowball.totalInterest));
});

/* ---------------- emergencyPlan ---------------- */
test("emergencyPlan: target, coverage and gap are consistent", () => {
  const e = emergencyPlan({ essentialMonthly: 40000, coverMonths: 6, current: 100000, monthly: 10000, ratePct: 5 });
  assert.equal(e.target, 240000);
  assert.equal(e.coverageMonths, 2.5);
  assert.equal(e.gap, 140000);
  assert.ok(e.reachable);
  assert.ok(e.monthsToFill > 0 && e.monthsToFill < 12 * 5);
  assert.equal(e.horizons.map((h) => h.months).join(","), "3,6,9,12");
  assert.equal(e.projection.values.length, e.projection.labels.length);
});

test("emergencyPlan: a funded plan has no gap and no fill time", () => {
  const e = emergencyPlan({ essentialMonthly: 40000, coverMonths: 6, current: 300000, monthly: 0, ratePct: 0 });
  assert.equal(e.gap, 0);
  assert.equal(e.monthsToFill, 0);
  assert.equal(e.coverageMonths, 7.5);
});

test("emergencyPlan: no monthly saving and a gap is unreachable", () => {
  const e = emergencyPlan({ essentialMonthly: 40000, coverMonths: 6, current: 0, monthly: 0, ratePct: 5 });
  assert.equal(e.gap, 240000);
  assert.equal(e.reachable, false);
  assert.equal(e.monthsToFill, null);
});

/* ---------------- net worth ---------------- */
test("netWorthTotals: net worth and debt-to-asset ratio", () => {
  const n = netWorthTotals({
    assets: [{ name: "Cash", value: 200000 }, { name: "Equity", value: 800000 }],
    liabilities: [{ name: "Home loan", value: 300000 }]
  });
  assert.equal(n.totalAssets, 1000000);
  assert.equal(n.totalLiabilities, 300000);
  assert.equal(n.netWorth, 700000);
  assert.equal(n.debtToAsset, 30);
  assert.equal(n.allocation.length, 2);
  assert.ok(n.liquidsShare > 0 && n.liquidsShare <= 100);
});

test("netWorthTotals: zero assets does not divide by zero", () => {
  const n = netWorthTotals({ assets: [], liabilities: [{ name: "Card", value: 50000 }] });
  assert.equal(n.netWorth, -50000);
  assert.equal(n.debtToAsset, 100);
  assert.equal(n.liquidsShare, 0);
});

test("netWorthTrend: sorts snapshots and reports change", () => {
  const t = netWorthTrend([
    { date: "2025-06-30", netWorth: 400000, totalAssets: 900000, totalLiabilities: 500000 },
    { date: "2025-01-31", netWorth: 300000, totalAssets: 800000, totalLiabilities: 500000 },
    { date: "2025-12-31", netWorth: 550000, totalAssets: 1050000, totalLiabilities: 500000 }
  ]);
  assert.deepEqual(t.labels, ["2025-01-31", "2025-06-30", "2025-12-31"]);
  assert.equal(t.first, 300000);
  assert.equal(t.latest, 550000);
  assert.equal(t.change, 250000);
  assert.ok(Math.abs(t.changePct - 83.333333) < 0.01);
  assert.equal(t.high, 550000);
  assert.equal(t.low, 300000);
});

test("netWorthTrend: ignores malformed rows and handles empty input", () => {
  const t = netWorthTrend([null, { date: "", netWorth: 100 }, { date: "2025-01-01" }]);
  assert.equal(t.snapshots.length, 0);
  assert.equal(t.change, 0);
  assert.equal(t.changePct, 0);
});

/* ---------------- sipStrategies ---------------- */
test("sipStrategies: five presets, with step-up and lump variants", () => {
  const s = sipStrategies({ monthly: 10000, years: 20, returnPct: 12, inflationPct: 6, goalAmount: 10000000 });
  assert.equal(s.rows.length, 5);
  assert.equal(s.rows[0].id, "flat");
  const ids = s.rows.map((r) => r.id);
  ["step5", "step10", "higher", "lump"].forEach((id) => assert.ok(ids.includes(id)));
  assert.ok(ids.includes(s.bestId));
  assert.ok(ids.includes(s.recommendedId));
  s.rows.forEach((r) => assert.ok(finite(r.projected) && finite(r.invested)));
});

test("sipStrategies: step-up invests more and projects more than flat", () => {
  const s = sipStrategies({ monthly: 10000, years: 20, returnPct: 12, inflationPct: 6 });
  const flat = s.rows.find((r) => r.id === "flat");
  const step10 = s.rows.find((r) => r.id === "step10");
  assert.ok(step10.invested > flat.invested);
  assert.ok(step10.projected > flat.projected);
  assert.equal(step10.extraOutlay, step10.invested - flat.invested);
  assert.equal(s.bestId, "step10");
});

test("sipStrategies: recommended is the cheapest strategy that reaches the goal", () => {
  const s = sipStrategies({ monthly: 10000, years: 20, returnPct: 12, inflationPct: 6, goalAmount: 4000000 });
  assert.equal(s.reachedGoal, true);
  const rec = s.rows.find((r) => r.id === s.recommendedId);
  assert.equal(rec.goalAchieved, true);
  s.rows.forEach((r) => {
    if (r.extraOutlay < rec.extraOutlay) assert.notEqual(r.goalAchieved, true, `${r.id} cheaper and reached goal`);
  });
});

test("sipStrategies: when no strategy reaches the goal it recommends the strongest", () => {
  const s = sipStrategies({ monthly: 10000, years: 20, returnPct: 12, inflationPct: 6, goalAmount: 50000000 });
  assert.equal(s.reachedGoal, false);
  assert.equal(s.recommendedId, s.bestId);
  const rec = s.rows.find((r) => r.id === s.recommendedId);
  assert.ok(rec.projected > 0);
});

test("sipStrategies: goal left at zero falls back to the cheapest preset", () => {
  const s = sipStrategies({ monthly: 10000, years: 20, returnPct: 12, inflationPct: 6, goalAmount: 0 });
  assert.equal(s.reachedGoal, false);
  assert.equal(s.recommendedId, "flat");
  assert.ok(s.rows.every((r) => finite(r.projected) && finite(r.invested)));
});
