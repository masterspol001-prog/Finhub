import { test } from "node:test";
import assert from "node:assert/strict";
import { CALC_LIST, computeCalc, deriveTables } from "../assets/js/engine.js";

const KINDS = new Set(["money", "pct", "num", "years", "text"]);

function defaultInputs(calc) {
  const o = {};
  (calc.fields || []).forEach((f) => { o[f.key] = f.def; });
  return o;
}

function computeAll() {
  return CALC_LIST.map((calc) => ({ calc, result: computeCalc(calc.slug, defaultInputs(calc)) }));
}

function inputsFor(slug) {
  const calc = CALC_LIST.find((c) => c.slug === slug);
  return defaultInputs(calc || { fields: [] });
}

test("deriveTables: every calculator produces at least one detailed table", () => {
  const missing = computeAll()
    .filter(({ result }) => deriveTables(result).length === 0)
    .map(({ calc }) => calc.slug);
  assert.deepEqual(missing, [], `calculators without a table: ${missing.join(", ")}`);
});

test("deriveTables: tables are well-formed (columns, rows, consistent width)", () => {
  computeAll().forEach(({ calc, result }) => {
    deriveTables(result).forEach((t) => {
      assert.ok(t.title && typeof t.title === "string", `${calc.slug}: table needs a title`);
      assert.ok(Array.isArray(t.columns) && t.columns.length >= 2, `${calc.slug}: needs >=2 columns`);
      assert.ok(Array.isArray(t.rows) && t.rows.length > 0, `${calc.slug}: needs rows`);
      t.columns.forEach((c) => assert.ok(KINDS.has(c.kind), `${calc.slug}: bad kind ${c.kind}`));
      t.rows.forEach((r, i) => {
        assert.equal(r.length, t.columns.length, `${calc.slug}: row ${i} width mismatch`);
        r.forEach((v, ci) => {
          const kind = t.columns[ci].kind;
          if (kind === "text") return;
          assert.ok(v === null || Number.isFinite(Number(v)), `${calc.slug}: row ${i} col ${ci} not numeric (${v})`);
        });
      });
      if (t.totals) assert.equal(t.totals.length, t.columns.length, `${calc.slug}: totals width mismatch`);
    });
  });
});

test("deriveTables: amortization schedules reconcile (principal + interest totals)", () => {
  ["emi-loan", "mortgage", "home-loan-prepay"].forEach((slug) => {
    const t = deriveTables(computeCalc(slug, inputsFor(slug))).find((x) => x.totals && x.columns.some((c) => c.label === "Balance"));
    assert.ok(t, `${slug}: expected a totals row`);
    const [pTotal, iTotal, combined] = [t.totals[1], t.totals[2], t.totals[3]];
    assert.ok(Math.abs(pTotal + iTotal - combined) < 1, `${slug}: principal + interest != combined`);
  });
});

test("deriveTables: donut breakdown shares sum to 100%", () => {
  ["gst-tax", "income-tax", "capital-gains"].forEach((slug) => {
    const donuts = deriveTables(computeCalc(slug, inputsFor(slug))).filter((t) => t.totals && t.columns.some((c) => c.label === "Share"));
    assert.ok(donuts.length >= 1, `${slug}: expected a share table`);
    donuts.forEach((t) => {
      const shareIdx = t.columns.findIndex((c) => c.label === "Share");
      t.totals.forEach(() => {});
      assert.equal(t.totals[shareIdx], 100, `${slug}: shares should total 100`);
    });
  });
});

test("deriveTables: waterfall running balance ends at the total step", () => {
  ["gst-tax", "investment-return", "profit-loss", "income-tax", "capital-gains"].forEach((slug) => {
    const t = deriveTables(computeCalc(slug, inputsFor(slug))).find((x) => /breakdown/.test(x.title) && x.columns.some((c) => c.label === "Running"));
    assert.ok(t, `${slug}: expected a waterfall table`);
    const last = t.rows[t.rows.length - 1];
    assert.equal(last[2], last[1], `${slug}: final running value should equal the total`);
  });
});

test("deriveTables: empty/missing inputs are handled defensively", () => {
  assert.deepEqual(deriveTables(null), []);
  assert.deepEqual(deriveTables({}), []);
  assert.deepEqual(deriveTables({ charts: [] }), []);
});
