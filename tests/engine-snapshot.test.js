import { test } from "node:test";
import assert from "node:assert/strict";
import { financialSnapshot, moneyPlan, encodePlanParam, decodePlanParam } from "../assets/js/engine.js";

const base = {
  age: 30, income: 80000, expenses: 55000, cash: 120000,
  investments: 400000, debt: 300000, debtPayment: 12000
};

test("financialSnapshot returns the headline numbers", () => {
  const s = financialSnapshot(base);
  assert.equal(s.surplus, 25000);
  assert.equal(Math.round(s.savingsRate), 31);
  assert.equal(s.netWorth, 220000);
  assert.equal(s.emergencyTarget, 330000);
  assert.equal(Math.round(s.emergencyMonths * 10) / 10, 2.2);
  assert.equal(s.emergencyGap, 210000);
});

test("financialSnapshot yields six insight cards with links", () => {
  const s = financialSnapshot(base);
  assert.equal(s.insights.length, 6);
  for (const i of s.insights) {
    assert.ok(i.key && i.label && i.tone, "insight needs key/label/tone");
    assert.ok(i.to && i.toLabel, "insight needs a destination tool");
    assert.ok(["ok", "warn", "bad"].includes(i.tone), "tone must be known");
    assert.ok(i.kind === "money" || i.value !== undefined || i.text, "insight needs a value or text");
  }
});

test("financialSnapshot flags a deficit as bad", () => {
  const s = financialSnapshot({ ...base, income: 40000, expenses: 55000, debtPayment: 0 });
  assert.ok(s.surplus < 0);
  const surplusCard = s.insights.find((i) => i.key === "surplus");
  assert.equal(surplusCard.tone, "bad");
});

test("financialSnapshot reports debt-free state cleanly", () => {
  const s = financialSnapshot({ ...base, debt: 0, debtPayment: 0 });
  const debtCard = s.insights.find((i) => i.key === "debt");
  assert.equal(debtCard.tone, "ok");
  assert.equal(debtCard.value, 0);
});

test("financialSnapshot formats amounts in the requested currency", () => {
  const inr = financialSnapshot(base);
  const usd = financialSnapshot({ ...base, currency: "USD" });
  const inrCard = inr.insights.find((i) => i.key === "networth");
  const usdCard = usd.insights.find((i) => i.key === "networth");
  assert.match(inrCard.hint, /\u20B9/);
  assert.match(usdCard.hint, /\$/);
});

test("financialSnapshot never emits NaN and keeps a health score in range", () => {
  const s = financialSnapshot({});
  assert.ok(Number.isFinite(s.surplus));
  assert.ok(s.health.score >= 0 && s.health.score <= 100);
  assert.ok(s.insights.every((i) => !/NaN/.test(i.text || "") && !/NaN/.test(i.hint || "")));
});

/* ---------------- personalized money plan ---------------- */
test("moneyPlan flags empty input and stays finite", () => {
  const p = moneyPlan({});
  assert.equal(p.hasData, false);
  assert.ok(Number.isFinite(p.investable));
  assert.ok(p.priorities.length >= 3);
  assert.equal(p.scorecard.length, 5);
  assert.equal(p.milestones.length, 3);
  assert.ok(p.priorities.every((x) => !/NaN/.test(x.body + x.eta)));
});

test("moneyPlan fills the safety net first from the investable surplus", () => {
  const p = moneyPlan(base);
  // income 80k - expenses 55k - debt payment 12k = 13k free
  assert.equal(p.investable, 13000);
  assert.equal(p.priorities.length, 4, "safety net, debt, retirement, growth");
  assert.equal(p.allocation.total, 13000);
  assert.equal(p.allocation.emergency, 13000, "all free cash to the safety net while the gap is open");
  assert.equal(p.allocation.debt, 0);
  assert.equal(p.allocation.invest, 0);
  assert.equal(p.priorities.find((x) => x.key === "emergency").amount, 13000);
});

test("moneyPlan directs surplus to investing once the safety net is filled", () => {
  const p = moneyPlan({ ...base, cash: 400000, debt: 0, debtPayment: 0 });
  assert.equal(p.allocation.emergency, 0, "6-month buffer already in place");
  assert.equal(p.allocation.debt, 0);
  assert.equal(p.allocation.invest, 25000, "full surplus now funds retirement and goals");
});

test("moneyPlan marks an on-track retirement as ok", () => {
  const p = moneyPlan({ ...base, investments: 9000000, cash: 400000, debt: 0, debtPayment: 0, age: 25, ageRet: 60 });
  const retire = p.priorities.find((x) => x.key === "retirement");
  assert.equal(retire.tone, "ok");
  assert.match(retire.title, /on track/i);
});

test("moneyPlan never allocates more than the surplus", () => {
  const p = moneyPlan(base);
  const { emergency, debt, invest, total } = p.allocation;
  assert.ok(emergency + debt + invest === total);
  assert.ok(emergency >= 0 && debt >= 0 && invest >= 0);
  assert.ok(total <= p.investable);
});

/* ---------------- shareable plan links ---------------- */
test("encodePlanParam / decodePlanParam round-trip the profile", () => {
  const param = encodePlanParam({ ...base, ageRet: 58 });
  assert.ok(param && !/[+/=]/.test(param), "url-safe base64 without padding");
  const decoded = decodePlanParam(param);
  assert.equal(decoded.income, base.income);
  assert.equal(decoded.debt, base.debt);
  assert.equal(decoded.ageRet, 58);
});

test("encodePlanParam omits ageRet when absent and decodePlanParam rejects junk", () => {
  const decoded = decodePlanParam(encodePlanParam(base));
  assert.equal(decoded.ageRet, undefined, "retirement age left to the plan default");
  assert.equal(decodePlanParam("not-a-valid-param"), null);
  assert.equal(decodePlanParam(""), null);
  assert.equal(decodePlanParam("e30"), null, "empty object has no real numbers");
});
