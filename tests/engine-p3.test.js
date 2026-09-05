import { test } from "node:test";
import assert from "node:assert/strict";
import { tvm, computeCalc, CALC_LIST } from "../assets/js/engine.js";

const bySlug = (s) => CALC_LIST.find((c) => c.slug === s);
function defaults(c, over = {}) {
  const inp = { ...over };
  for (const f of c.fields) if (inp[f.key] === undefined) inp[f.key] = f.def;
  return inp;
}

test("xirr recovers the known input rate", () => {
  const pmt = 10000, years = 5, rate = 12;
  const final = tvm.sipFV(pmt, years * 12, rate);
  const r = computeCalc("xirr", defaults(bySlug("xirr"), { monthly: pmt, years, final }));
  assert.ok(Math.abs(r.head.value - rate) < 0.1, `got ${r.head.value}`);
});

test("xirr handles final below invested (0% floor, no negative)", () => {
  const r = computeCalc("xirr", defaults(bySlug("xirr"), { monthly: 10000, years: 5, final: 500000 }));
  assert.ok(r.head.value >= 0);
  assert.ok(r.head.value < 5);
});

test("real return follows the Fisher identity", () => {
  const r = computeCalc("real-return", defaults(bySlug("real-return"), { nominal: 10, inflation: 6 }));
  const expected = (1.10 / 1.06 - 1) * 100;
  assert.ok(Math.abs(r.head.value - expected) < 1e-9);
});

test("expense ratio lowers the end value", () => {
  const noFee = computeCalc("expense-ratio", defaults(bySlug("expense-ratio"), { expense: 0 }));
  const withFee = computeCalc("expense-ratio", defaults(bySlug("expense-ratio"), { expense: 2 }));
  assert.ok(withFee.head.value < noFee.head.value, "2% fee must beat 0% fee on final value");
});

test("SWP year-1 monthly income lets corpus survive the full period", () => {
  const corpus = 20000000, rate = 8, years = 25, growth = 6;
  const r = computeCalc("swp", defaults(bySlug("swp"), { corpus, rate, years, growth }));
  assert.ok(r.head.value > 0);
  const last = r.charts[0].data.series[0].points[r.charts[0].data.series[0].points.length - 1];
  assert.ok(last > 0 && last < corpus, `final balance ${last}`);
});

test("home loan prepayment cuts total interest and shortens tenure", () => {
  const base = computeCalc("home-loan-prepay", defaults(bySlug("home-loan-prepay"), { prepay: 0, atYear: 5 }));
  const done = computeCalc("home-loan-prepay", defaults(bySlug("home-loan-prepay"), { prepay: 500000, atYear: 5 }));
  assert.ok(done.head.value > 0, "should save interest");
  assert.ok(done.stats[1].value > base.stats[1].value, "prepay shortens tenure");
});

test("loan comparison reports EMI and interest for both loans", () => {
  const r = computeCalc("loan-compare", defaults(bySlug("loan-compare")));
  assert.ok(r.head.value > 0);
  assert.ok(r.stats[1].value < r.stats[2].value, "higher-rate/tenure loan costs more interest");
});

test("debt payoff clears in finite months with positive interest", () => {
  const r = computeCalc("debt-payoff", defaults(bySlug("debt-payoff")));
  assert.ok(Number.isFinite(r.head.value));
  assert.ok(r.head.value > 0);
  assert.ok(r.stats[0].value > 0, "total interest should be positive");
});

test("debt payoff flags unpayable payments (payment <= interest)", () => {
  const r = computeCalc("debt-payoff", defaults(bySlug("debt-payoff"), { balance: 200000, apr: 30, payment: 1000, extra: 0 }));
  assert.equal(r.head.value, null);
  assert.match(r.note, /never clear/i);
});

test("recurring deposit maturity exceeds deposits", () => {
  const r = computeCalc("rd", defaults(bySlug("rd"), { monthly: 5000, rate: 6.5, years: 5 }));
  assert.ok(r.head.value > r.stats[0].value);
  assert.ok(r.stats[1].value > 0);
});

test("emergency fund target equals expenses x coverage months", () => {
  const r = computeCalc("emergency-fund", defaults(bySlug("emergency-fund"), { expenses: 30000, months: 6 }));
  assert.equal(r.head.value, 180000);
  assert.ok(Number.isFinite(r.stats[0].value));
});

test("FIRE projects a reachable path at defaults", () => {
  const r = computeCalc("fire", defaults(bySlug("fire")));
  assert.ok(r.head.value > 0);
  assert.ok(Number.isFinite(r.stats[1].value), "years to FI finite");
});

test("Coast FIRE age matches log-growth formula", () => {
  const age = 30, corpus = 500000, rate = 8, target = 30000000;
  const years = Math.log(target / corpus) / Math.log(1 + rate / 100);
  const r = computeCalc("coast-fire", defaults(bySlug("coast-fire"), { age, corpus, rate, target }));
  assert.ok(Math.abs(r.head.value - (age + years)) < 0.01);
});

test("income tax new regime 12L estimate", () => {
  const r = computeCalc("income-tax", defaults(bySlug("income-tax"), { income: 1200000, regime: "new" }));
  assert.ok(Math.abs(r.head.value - 71500) < 1, `got ${r.head.value}`);
  assert.equal(r.stats[0].value, 1125000);
});

test("income tax old regime > new regime at 12L", () => {
  const n = computeCalc("income-tax", defaults(bySlug("income-tax"), { income: 1200000, regime: "new" }));
  const o = computeCalc("income-tax", defaults(bySlug("income-tax"), { income: 1200000, regime: "old" }));
  assert.ok(o.head.value > n.head.value);
});

test("capital gains: LTCG exemption of 1.25L then 12.5%", () => {
  const r = computeCalc("capital-gains", defaults(bySlug("capital-gains"), { gain: 300000, type: "ltcg" }));
  assert.ok(Math.abs(r.head.value - (300000 - 125000) * 0.125) < 1e-6);
  const s = computeCalc("capital-gains", defaults(bySlug("capital-gains"), { gain: 300000, type: "stcg" }));
  assert.ok(Math.abs(s.head.value - 300000 * 0.20) < 1e-6);
});
