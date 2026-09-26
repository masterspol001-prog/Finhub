import { test } from "node:test";
import assert from "node:assert/strict";
import { askIntent, profileToState, normalizeProfile } from "../assets/js/engine.js";

test("askIntent maps plain questions to the right destination", () => {
  const top = (q) => (askIntent(q)[0] || {}).slug;
  assert.equal(top("How much SIP to reach 1 crore?"), "sip");
  assert.equal(top("when can I retire"), "retirement-planner");
  assert.equal(top("home loan emi"), "emi-loan");
  assert.match(top("how big should my emergency fund be"), /emergency/);
  assert.equal(top("gst on 50000"), "gst-tax");
  assert.equal(top("what is my net worth"), "net-worth");
});

test("askIntent handles empty and unmatched queries", () => {
  assert.deepEqual(askIntent(""), []);
  assert.deepEqual(askIntent("   "), []);
  assert.deepEqual(askIntent("zzz qqq"), []);
  assert.deepEqual(askIntent("the and to"), []);
});

test("askIntent results carry usable hrefs and types", () => {
  const res = askIntent("sip");
  assert.ok(res.length >= 1);
  res.forEach((r) => {
    assert.ok(r.href.startsWith("/"));
    assert.ok(["calc", "tool"].includes(r.type));
    assert.ok(r.title);
  });
});

const profile = {
  age: 32, income: 100000, expenses: 60000, cash: 200000,
  investments: 500000, debt: 200000, debtPayment: 15000, returnPct: 12, inflationPct: 6
};

test("profileToState maps snapshot numbers into planner keys", () => {
  const d = profileToState("dashboard", profile);
  assert.equal(d.income, 100000);
  assert.equal(d.savings, 700000);
  assert.equal(d.debt, 15000);
  assert.equal(d.monthlyInvestment, 25000);

  const r = profileToState("retirement-planner", profile);
  assert.equal(r.ageNow, 32);
  assert.equal(r.monthlyExpense, 60000);
  assert.equal(r.monthlySave, 25000);

  const debt = profileToState("debt-planner", profile);
  assert.equal(debt.balance1, 200000);
  assert.equal(debt.payment1, 15000);

  const em = profileToState("emergency-fund-planner", profile);
  assert.equal(em.essentialMonthly, 60000);
  assert.equal(em.current, 200000);
  assert.equal(em.monthly, 25000);
});

test("profileToState returns null when there is nothing to carry", () => {
  assert.equal(profileToState("dashboard", { age: 30 }), null);
  assert.equal(profileToState("unknown-tool", { income: 50000 }), null);
  assert.equal(profileToState("net-worth-tracker", { income: 50000 }), null);
});

test("normalizeProfile fills safe defaults", () => {
  const n = normalizeProfile({ income: "80000", returnPct: "" });
  assert.equal(n.income, 80000);
  assert.equal(n.returnPct, 12);
  assert.equal(n.inflationPct, 6);
  assert.equal(n.age, 30);
  assert.equal(n.debt, 0);
});
