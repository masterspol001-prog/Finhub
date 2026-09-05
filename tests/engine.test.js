import { test } from "node:test";
import assert from "node:assert/strict";
import { tvm, computeCalc, CALC_LIST, fmtMoney } from "../assets/js/engine.js";

/* ---------------- time-value math ---------------- */
test("fv and pv are inverse operations", () => {
  const fv = tvm.fv(1000, 10, 5);
  assert.ok(Math.abs(tvm.pv(fv, 10, 5) - 1000) < 1e-6);
});

test("cagr known value: 1L to 2L over 5 years is 14.87%", () => {
  const c = tvm.cagr(100000, 200000, 5) * 100;
  assert.ok(Math.abs(c - 14.87) < 0.01);
});

test("sipFV equals brute-force month loop (annuity due)", () => {
  const p = 10000, n = 120, rate = 12, i = rate / 100 / 12;
  let sum = 0;
  for (let m = 1; m <= n; m++) sum += p * Math.pow(1 + i, n - m + 1);
  assert.ok(Math.abs(tvm.sipFV(p, n, rate) - sum) < 1e-6);
});

test("sipStepUpFV with 0% step-up equals sipFV", () => {
  assert.ok(Math.abs(tvm.sipStepUpFV(10000, 120, 12, 0) - tvm.sipFV(10000, 120, 12)) < 1e-6);
});

test("sipStepUpFV matches independent reference for arbitrary inputs", () => {
  const ref = (p, n, rate, gPct) => {
    const i = rate / 100 / 12, g = gPct / 100;
    let fv = 0;
    for (let m = 1; m <= n; m++) fv += p * Math.pow(1 + g, Math.floor((m - 1) / 12)) * Math.pow(1 + i, n - m + 1);
    return fv;
  };
  for (const args of [[5000, 25, 10, 5], [1000, 36, 15, 10], [20000, 480, 8, 0], [7777, 13, 9.5, 3]]) {
    assert.ok(Math.abs(tvm.sipStepUpFV(...args) - ref(...args)) < 1e-6, `mismatch ${args}`);
  }
});

test("sipFactor recovers monthly deposit from future value", () => {
  const fv = tvm.sipFV(5000, 200, 11);
  const p = fv / tvm.sipFactor(200, 11);
  assert.ok(Math.abs(p - 5000) < 1e-6);
});

test("emi known: 10L at 8.5% for 5 years", () => {
  const e = tvm.emi(1000000, 8.5, 60);
  assert.ok(Math.abs(e - 20517) < 5);
  assert.ok(e > 0);
});

test("compound: quarterly vs monthly vs yearly ordering", () => {
  const p = 1000000, r = 8, y = 10;
  const annual = tvm.compound(p, r, y, 1);
  const qtr = tvm.compound(p, r, y, 4);
  const monthly = tvm.compound(p, r, y, 12);
  assert.ok(annual < qtr && qtr < monthly);
  assert.ok(Math.abs(annual - p * Math.pow(1.08, 10)) < 1);
});

/* ---------------- calculators ---------------- */
function defaults(c, over = {}) {
  const inp = { ...over };
  for (const f of c.fields) if (inp[f.key] === undefined) inp[f.key] = f.def;
  if (c.slug === "net-worth") {
    inp.assets = [{ name: "A", value: 1000000 }, { name: "B", value: 500000 }];
    inp.liabilities = [{ name: "L", value: 300000 }];
  }
  return inp;
}

test("every calculator runs with defaults and produces finite, consistent output", () => {
  for (const c of CALC_LIST) {
    const r = computeCalc(c.slug, defaults(c));
    assert.ok(r, `${c.slug} returned null`);
    assert.ok(r.head && r.head.label, `${c.slug} missing head`);
    for (const s of r.stats) {
      assert.ok(s.label && s.kind, `${c.slug} stat missing meta`);
      if (typeof s.value === "number") assert.ok(Number.isFinite(s.value), `${c.slug} stat ${s.label} NaN`);
    }
    for (const ch of r.charts) assert.ok(ch.type && ch.data, `${c.slug} malformed chart`);
  }
});

test("sip: invested + returns = projected", () => {
  const r = computeCalc("sip", defaults(CALC_LIST.find((c) => c.slug === "sip"), { monthly: 10000, rate: 12, years: 10 }));
  assert.ok(Math.round(r.head.value) === 2323391);
  assert.equal(r.stats[0].value, 10000 * 120);
});

test("compound interest: principal + contributions + interest = total", () => {
  const r = computeCalc("compound-interest", defaults(CALC_LIST.find((c) => c.slug === "compound-interest"), { principal: 500000, rate: 8, years: 10, monthlyAdd: 10000 }));
  const total = r.head.value;
  const sum = 500000 + (10000 * 120) + r.stats[r.stats.length - 1].value;
  assert.ok(Math.abs(total - sum) < 1);
});

test("emi: year principal sums to loan and amortizes to zero", () => {
  const r = computeCalc("emi-loan", defaults(CALC_LIST.find((c) => c.slug === "emi-loan"), { amount: 1000000, rate: 8.5, years: 5 }));
  const items = r.charts[0].data.items;
  const lastBal = items[items.length - 1].balance;
  assert.ok(lastBal < 100, `remaining balance ${lastBal} not amortized`);
  assert.ok(items.every((y) => y.principal + y.interest > 0));
});

test("retirement: gap closes when saving the suggested monthly amount", () => {
  const base = defaults(CALC_LIST.find((c) => c.slug === "retirement"), { save: 0 });
  const before = computeCalc("retirement", base);
  assert.ok(before.stats[2].value > 0, "expected a gap with no saving");
  const need = before.stats[3].value;
  const after = computeCalc("retirement", { ...base, save: need });
  assert.ok(Math.abs(after.stats[2].value) < 1, `gap not closed: ${after.stats[2].value}`);
  const curve = after.charts[0].data.series[0].points;
  assert.equal(curve[curve.length - 1], 0, "fully funded corpus should drain to zero at life expectancy");
});

test("inflation: future mode grows money, past mode discounts it", () => {
  const amount = 100000, rate = 6, years = 20;
  const f = computeCalc("inflation", defaults(CALC_LIST.find((c) => c.slug === "inflation"), { amount, rate, years, direction: "future" }));
  assert.ok(Math.abs(f.head.value - tvm.fv(amount, rate, years)) < 1);
  const p = computeCalc("inflation", defaults(CALC_LIST.find((c) => c.slug === "inflation"), { amount, rate, years, direction: "past" }));
  assert.ok(Math.abs(p.head.value - tvm.pv(amount, rate, years)) < 1);
});

test("savings-goal: months returned actually reach the target", () => {
  const r = computeCalc("savings-goal", defaults(CALC_LIST.find((c) => c.slug === "savings-goal"), { target: 1000000, current: 100000, monthly: 20000, rate: 8 }));
  const months = Math.round(r.head.value * 12);
  assert.ok(months > 0);
  const i = 8 / 100 / 12, A = 1 + i;
  const achieved = 100000 * Math.pow(A, months) + 20000 * (Math.pow(A, months) - 1) / i * A;
  assert.ok(achieved >= 1000000, "projected value below goal");
});

test("savings-goal: unreachable when nothing is saved toward it", () => {
  const r = computeCalc("savings-goal", defaults(CALC_LIST.find((c) => c.slug === "savings-goal"), { target: 1000000, current: 0, monthly: 0, rate: 8 }));
  assert.equal(r.head.kind, "text");
  assert.ok(r.stats[2].value === null);
});

test("gst roundtrip: inclusive back-out recovers the exclusive net", () => {
  const net = 10000, rate = 18;
  const excl = computeCalc("gst-tax", defaults(CALC_LIST.find((c) => c.slug === "gst-tax"), { amount: net, rate, mode: "exclusive" }));
  const gross = excl.head.value;
  const incl = computeCalc("gst-tax", defaults(CALC_LIST.find((c) => c.slug === "gst-tax"), { amount: gross, rate, mode: "inclusive" }));
  assert.ok(Math.abs(incl.head.value - net) < 1e-6);
});

test("position-size: floor of risk money / risk per share", () => {
  const r = computeCalc("position-size", defaults(CALC_LIST.find((c) => c.slug === "position-size"), { balance: 500000, riskPct: 1, entry: 250, stop: 230 }));
  assert.equal(r.head.value, Math.floor((500000 * 0.01) / 20));
  assert.equal(r.stats[0].value, 5000);
});

test("net-worth: value = assets - liabilities, negative handled", () => {
  const def = defaults(CALC_LIST.find((c) => c.slug === "net-worth"));
  const r = computeCalc("net-worth", def);
  assert.ok(Math.abs(r.head.value - (1500000 - 300000)) < 1);
  const neg = computeCalc("net-worth", {
    assets: [{ name: "A", value: 1000 }],
    liabilities: [{ name: "L", value: 5000 }]
  });
  assert.ok(neg.head.value < 0);
  assert.equal(fmtMoney(neg.head.value, "INR").startsWith("-"), true);
});

test("risk-reward ratio is reward / risk", () => {
  const r = computeCalc("risk-reward", defaults(CALC_LIST.find((c) => c.slug === "risk-reward"), { entry: 250, stop: 240, target: 270, qty: 100 }));
  assert.ok(Math.abs(r.head.value - 2) < 1e-9);
});

test("all heads/stats use valid numeric kinds", () => {
  const kinds = new Set(["money", "pct", "num", "years", "months", "ratio", "text"]);
  for (const c of CALC_LIST) {
    const r = computeCalc(c.slug, defaults(c));
    assert.ok(kinds.has(r.head.kind), `${c.slug} head kind ${r.head.kind}`);
    for (const s of r.stats) assert.ok(kinds.has(s.kind), `${c.slug} stat kind ${s.kind}`);
  }
});
