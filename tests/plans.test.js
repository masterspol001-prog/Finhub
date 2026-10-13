import { test } from "node:test";
import assert from "node:assert/strict";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
    _dump: () => Object.fromEntries(data)
  };
}

globalThis.localStorage = memoryStorage();

const {
  listPlans, plansForTool, getPlan, savePlan, updatePlan, renamePlan,
  deletePlan, clearPlans, exportPlans, importPlans,
  listSnapshots, saveSnapshot, deleteSnapshot, clearSnapshots,
  listGoals, saveGoal, updateGoal, deleteGoal, clearGoals,
  listReviews, saveReview, deleteReview, clearReviews
} = await import("../assets/js/plans.js");

test.beforeEach(() => {
  globalThis.localStorage.clear();
});

/* ---------------- plans ---------------- */
test("savePlan stores a scalar-only state and lists newest first", () => {
  const a = savePlan("First", "goal-planner", { target: 1000000, monthly: 5000, junk: null, nested: { keep: 1 } });
  const b = savePlan("Second", "sip-compare", { monthly: 8000 }, [{ id: "s1", projected: 1 }]);
  assert.ok(a.id && b.id && a.id !== b.id);
  assert.equal(a.state.target, 1000000);
  assert.equal(a.state.nested, undefined, "object fields are dropped");
  assert.deepEqual(a.scenarios, null);
  assert.deepEqual(b.scenarios, [{ id: "s1", projected: 1 }]);
  const all = listPlans();
  assert.equal(all.length, 2);
  assert.equal(all[0].id, b.id, "most recently saved first");
});

test("plansForTool and getPlan filter correctly", () => {
  const a = savePlan("Goal", "goal-planner", { target: 1 });
  savePlan("SIP", "sip-compare", { monthly: 1 });
  assert.equal(plansForTool("goal-planner").length, 1);
  assert.equal(plansForTool("goal-planner")[0].id, a.id);
  assert.equal(getPlan(a.id).name, "Goal");
  assert.equal(getPlan("nope"), null);
});

test("renamePlan and updatePlan persist the new values", () => {
  const a = savePlan("Old", "goal-planner", { target: 1 });
  renamePlan(a.id, "New name");
  assert.equal(getPlan(a.id).name, "New name");
  updatePlan(a.id, { state: { target: 99 } });
  assert.equal(getPlan(a.id).state.target, 99);
  assert.equal(getPlan(a.id).id, a.id);
});

test("deletePlan removes only the target and clearPlans empties everything", () => {
  const a = savePlan("A", "goal-planner", {});
  const b = savePlan("B", "goal-planner", {});
  deletePlan(a.id);
  assert.deepEqual(listPlans().map((p) => p.id), [b.id]);
  clearPlans();
  assert.equal(listPlans().length, 0);
});

test("exportPlans then importPlans round-trips and regenerates ids", () => {
  const a = savePlan("Goal", "goal-planner", { target: 500000 });
  saveSnapshot({ date: "2025-01-31", totalAssets: 100, totalLiabilities: 40, netWorth: 60 });
  const json = exportPlans();
  clearPlans();
  clearSnapshots();
  const res = importPlans(json);
  assert.equal(res.ok, true);
  assert.equal(res.added, 1);
  const imported = listPlans();
  assert.equal(imported.length, 1);
  assert.notEqual(imported[0].id, a.id, "ids are fresh on import");
  assert.equal(imported[0].state.target, 500000);
  assert.equal(listSnapshots().length, 1);
});

test("importPlans rejects malformed input without throwing", () => {
  assert.equal(importPlans("not json").ok, false);
  assert.equal(importPlans(JSON.stringify({ plans: "nope" })).ok, false);
  const empty = importPlans(JSON.stringify({ plans: [] }));
  assert.equal(empty.ok, true);
  assert.equal(empty.added, 0);
});

/* ---------------- snapshots ---------------- */
test("saveSnapshot keeps one entry per date and sorts ascending", () => {
  saveSnapshot({ date: "2025-06-30", totalAssets: 900, totalLiabilities: 500, netWorth: 400 });
  saveSnapshot({ date: "2025-01-31", totalAssets: 800, totalLiabilities: 500, netWorth: 300 });
  saveSnapshot({ date: "2025-06-30", totalAssets: 900, totalLiabilities: 400, netWorth: 500 });
  const snaps = listSnapshots();
  assert.equal(snaps.length, 2, "same date overwrites");
  assert.deepEqual(snaps.map((s) => s.date), ["2025-01-31", "2025-06-30"]);
  assert.equal(snaps[1].netWorth, 500);
  assert.ok(snaps[0].id && snaps[1].id);
});

test("deleteSnapshot and clearSnapshots remove entries", () => {
  saveSnapshot({ date: "2025-01-31", netWorth: 1 });
  const [s] = listSnapshots();
  deleteSnapshot(s.id);
  assert.equal(listSnapshots().length, 0);
  saveSnapshot({ date: "2025-02-28", netWorth: 2 });
  clearSnapshots();
  assert.equal(listSnapshots().length, 0);
});

test("listSnapshots ignores rows without a date or a numeric net worth", () => {
  globalThis.localStorage.setItem("finhub_networth_snapshots_v1", JSON.stringify([
    { date: "2025-01-31", netWorth: 100 },
    { date: "", netWorth: 100 },
    { date: "2025-02-28", netWorth: "abc" },
    { date: "2025-03-31" }
  ]));
  assert.equal(listSnapshots().length, 1);
});

test("corrupt storage degrades to empty instead of throwing", () => {
  globalThis.localStorage.setItem("finhub_plans_v1", "{broken");
  globalThis.localStorage.setItem("finhub_networth_snapshots_v1", "null");
  assert.deepEqual(listPlans(), []);
  assert.deepEqual(listSnapshots(), []);
});

/* ---------------- goals ---------------- */
test("saveGoal adds, edits and sanitises, newest first", () => {
  const a = saveGoal({ name: "  House  ", target: 5000000, saved: 100000, monthly: 20000 });
  const b = saveGoal({ name: "Car", target: 800000, saved: 0, monthly: 15000 });
  assert.ok(a.id && b.id && a.id !== b.id);
  assert.equal(b.name, "Car");
  const goals = listGoals();
  assert.equal(goals.length, 2);
  assert.equal(goals[0].id, b.id, "most recently added first");
  const edited = saveGoal({ id: a.id, name: "House", target: 6000000, saved: -5, monthly: 0 });
  assert.equal(edited.target, 6000000);
  assert.equal(edited.saved, 0, "negatives clamp to zero");
  assert.equal(listGoals().length, 2, "editing does not duplicate");
});

test("updateGoal and deleteGoal target a single goal", () => {
  const a = saveGoal({ name: "Trip", target: 200000, saved: 50000, monthly: 10000 });
  saveGoal({ name: "Bike", target: 100000 });
  const updated = updateGoal(a.id, { saved: 100000 });
  assert.equal(updated.saved, 100000);
  assert.equal(updateGoal("missing", { saved: 1 }), null);
  deleteGoal(a.id);
  assert.deepEqual(listGoals().map((g) => g.name), ["Bike"]);
  clearGoals();
  assert.equal(listGoals().length, 0);
});

test("listGoals ignores rows with no id or name", () => {
  globalThis.localStorage.setItem("finhub_goals_v1", JSON.stringify([
    { id: "g1", name: "Valid", target: 1 },
    { id: "", name: "No id" },
    { id: "g3" }
  ]));
  assert.equal(listGoals().length, 1);
});

/* ---------------- monthly reviews ---------------- */
test("saveReview keeps one entry per date and sorts oldest first", () => {
  saveReview({ date: "2026-02-28", netWorth: 300, savingsRate: 25, note: "b", checks: [true, false] });
  saveReview({ date: "2026-01-31", netWorth: 250, savingsRate: 20, note: "a", checks: [true] });
  saveReview({ date: "2026-02-28", netWorth: 320, savingsRate: 28, note: "b2", checks: [true, true] });
  const reviews = listReviews();
  assert.equal(reviews.length, 2, "same date overwrites");
  assert.deepEqual(reviews.map((r) => r.date), ["2026-01-31", "2026-02-28"]);
  assert.equal(reviews[1].netWorth, 320);
  assert.equal(reviews[1].note, "b2");
  assert.deepEqual(reviews[1].checks, [true, true]);
});

test("deleteReview and listReviews tolerate junk", () => {
  const r = saveReview({ date: "2026-03-31", netWorth: 400 });
  assert.equal(listReviews().length, 1);
  deleteReview(r.id);
  assert.equal(listReviews().length, 0);
  globalThis.localStorage.setItem("finhub_reviews_v1", JSON.stringify([{ id: "", date: "x" }, { id: "r", date: "" }]));
  assert.deepEqual(listReviews(), []);
  clearReviews();
});
