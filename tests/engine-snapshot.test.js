import { test } from "node:test";
import assert from "node:assert/strict";
import { financialSnapshot } from "../assets/js/engine.js";

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
