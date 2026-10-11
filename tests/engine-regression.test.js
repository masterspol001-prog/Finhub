import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALC_LIST, computeCalc, parseAmountText, fmtGrouped, fmtCompactMoney,
  fmtMoney, curPrefix, getCurrency
} from "../assets/js/engine.js";

const bySlug = (s) => CALC_LIST.find((c) => c.slug === s);
function defaults(c, over = {}) {
  const inp = { ...over };
  for (const f of c.fields) if (inp[f.key] === undefined) inp[f.key] = f.def;
  return inp;
}

/* ---- money input parsing (regression for the typed-amount path) ---- */
test("amount-input sequence: INR grouping scales to crores without caret loss", () => {
  const seq = [["1,000", 1000], ["10,000", 10000], ["1,00,000", 100000], ["10,00,000", 1000000], ["1,00,00,000", 10000000], ["1,00,00,00,000", 1000000000]];
  for (const [raw, want] of seq) assert.equal(parseAmountText(raw), want, raw);
});

test("parseAmountText: symbols, codes, suffixes, decimals, negatives", () => {
  const cases = {
    "1000": 1000,
    "₹1,00,000": 100000,
    "$2,500": 2500,
    "AED 1,000": 1000,
    "INR 50,000": 50000,
    "10k": 10000,
    "1.5L": 150000,
    "2Cr": 20000000,
    "1 crore": 10000000,
    "500 m": 500000000,
    "1,00,000.50": 100000.5,
    "-5000": -5000,
    "  1 lakh  ": 100000,
    "7.5%": 7.5
  };
  for (const [raw, want] of Object.entries(cases)) {
    assert.equal(parseAmountText(raw), want, `raw=${raw}`);
  }
  for (const bad of ["abc", "", "₹", "one", "1e5"]) {
    assert.ok(Number.isNaN(parseAmountText(bad)), `should reject ${bad}`);
  }
});

/* ---- shared formatting ---- */
test("fmtGrouped honours Indian vs Western grouping", () => {
  assert.equal(fmtGrouped(1000000, "INR"), "10,00,000");
  assert.equal(fmtGrouped(1000000, "USD"), "1,000,000");
  assert.equal(fmtGrouped(1000000, "GBP"), "1,000,000");
  assert.equal(fmtGrouped(1000000.5, "INR", 1), "10,00,000.5");
});

test("fmtCompactMoney + curPrefix render cleanly for all 7 currencies", () => {
  assert.equal(fmtCompactMoney(10000000, "INR"), "₹1 Cr");
  assert.equal(fmtCompactMoney(250000, "INR"), "₹2.5 L");
  assert.equal(fmtCompactMoney(1200000000, "USD"), "$1.2B");
  assert.equal(fmtCompactMoney(5000000000, "AED"), "AED 5B");
  assert.equal(fmtMoney(-50000, "INR"), "-₹50,000");
  assert.equal(curPrefix("AED"), "AED ");
  assert.equal(curPrefix("USD"), "$");
  assert.equal(getCurrency("XX").code, "INR");
});

/* ---- every calculator: defaults compute without NaN / Infinity ---- */
test("all 32 calculators compute finite results at defaults", () => {
  assert.equal(CALC_LIST.length, 32);
  for (const c of CALC_LIST) {
    const r = computeCalc(c.slug, defaults(c));
    assert.ok(r, `no result for ${c.slug}`);
    assert.ok(r.head, `no head for ${c.slug}`);
    const scan = (x, where) => {
      if (typeof x === "number") {
        assert.ok(Number.isFinite(x) === false ? false : true, `non-finite ${where}`);
      } else if (Array.isArray(x)) x.forEach((v, i) => scan(v, `${where}[${i}]`));
      else if (x && typeof x === "object") Object.entries(x).forEach(([k, v]) => scan(v, `${where}.${k}`));
    };
    const body = { head: r.head, stats: r.stats, charts: r.charts, note: r.note };
    scan(body, c.slug);
  }
});

test("every calculator survives extreme typed amounts above slider max", () => {
  for (const c of CALC_LIST) {
    const over = {};
    for (const f of c.fields) {
      if (["money", "number", "pct"].includes(f.type)) over[f.key] = 1e9;
    }
    let r;
    try { r = computeCalc(c.slug, defaults(c, over)); } catch { r = null; }
    assert.ok(r, `${c.slug} threw on large values`);
    assert.ok(r.head, `${c.slug} head missing`);
  }
});

/* ---- coast fire guards (regression: rate 0 used to produce Infinity chart) ---- */
test("coast fire at 0% return is graceful, not infinite", () => {
  const r = computeCalc("coast-fire", defaults(bySlug("coast-fire"), { rate: 0, corpus: 500000, target: 30000000 }));
  assert.ok(r, "0% coast fire must not throw");
  assert.equal(r.head.value, null);
  assert.ok(/raise the expected return|zero/i.test(r.note), r.note);
});

test("coast fire with empty corpus explains itself", () => {
  const r = computeCalc("coast-fire", defaults(bySlug("coast-fire"), { corpus: 0 }));
  assert.ok(/starting corpus greater than zero/i.test(r.note), r.note);
});

test("coast fire already-past case reads clearly", () => {
  const r = computeCalc("coast-fire", defaults(bySlug("coast-fire"), { corpus: 40000000, target: 30000000 }));
  assert.equal(r.head.value, null);
  assert.ok(/past coast-FIRE/i.test(r.note), r.note);
});

/* ---- registry integrity ---- */
test("registry: unique slugs, keys, and field ranges are sane", () => {
  const slugs = new Set(), keys = new Set();
  for (const c of CALC_LIST) {
    assert.ok(!slugs.has(c.slug), `dup slug ${c.slug}`);
    slugs.add(c.slug);
    if (!c.dynamic) assert.ok((c.fields || []).length > 0, `${c.slug} has no fields`);
    for (const f of c.fields || []) {
      const id = `${c.slug}.${f.key}`;
      assert.ok(!keys.has(id), `dup key ${id}`);
      keys.add(id);
      if (["money", "number", "pct", "years", "months"].includes(f.type)) {
        assert.ok(Number.isFinite(f.def), `${id} def`);
        if (typeof f.min === "number" && typeof f.max === "number") {
          assert.ok(f.max > f.min, `${id} range reversed`);
          assert.ok(f.def >= f.min && f.def <= f.max, `${id} def outside range`);
        }
      }
    }
  }
});

/* ---- format round-trips are lossless for grouped inputs ---- */
test("round-trip: fmtGrouped(n) reparses to the same number", () => {
  for (const [code, vals] of [["INR", [0, 1, 999, 1000, 123456, 1000000, 99999999.25]], ["USD", [1, 9999, 1234567, 1e8]], ["AED", [1, 123456789]]]) {
    for (const n of vals) {
      const shown = fmtGrouped(n, code, n % 1 ? 2 : 0);
      assert.equal(parseAmountText(shown), n, `${code} ${n} -> ${shown}`);
    }
  }
});
