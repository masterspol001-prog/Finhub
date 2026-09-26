/*
  FinHub plans + snapshots
  ------------------------
  Small localStorage layer that lets a visitor save a named plan from any
  tool, resume it later (optionally through ?plan=<id>), and keep dated net
  worth snapshots. No account, no server, no personal data leaves the device.
*/

const PLAN_KEY = "finhub_plans_v1";
const SNAP_KEY = "finhub_networth_snapshots_v1";
const MAX_PLANS = 100;
const MAX_SNAPS = 240;

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/* Scalar-only clone so DOM nodes and functions never reach storage. */
function cleanState(state) {
  const out = {};
  Object.keys(state || {}).forEach((k) => {
    const v = state[k];
    if (v == null) return;
    if (typeof v === "object") return; // scenarios handled separately
    out[k] = v;
  });
  return out;
}

export function listPlans() {
  const plans = read(PLAN_KEY, []);
  if (!Array.isArray(plans)) return [];
  return plans
    .filter((p) => p && p.id && p.slug)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export function plansForTool(slug) {
  return listPlans().filter((p) => p.slug === slug);
}

export function getPlan(id) {
  return listPlans().find((p) => p.id === id) || null;
}

/* Saved scenario arrays (sip-compare uses them) are kept verbatim. */
export function savePlan(name, slug, state, scenarios) {
  const plans = listPlans();
  const entry = {
    id: uid(),
    name: (name || "Untitled plan").slice(0, 60),
    slug,
    savedAt: Date.now(),
    state: cleanState(state),
    scenarios: Array.isArray(scenarios) ? JSON.parse(JSON.stringify(scenarios)) : null
  };
  plans.unshift(entry);
  write(PLAN_KEY, plans.slice(0, MAX_PLANS));
  return entry;
}

export function updatePlan(id, patch) {
  const plans = listPlans().map((p) => (p.id === id ? { ...p, ...patch, id: p.id, savedAt: Date.now() } : p));
  write(PLAN_KEY, plans);
}

export function renamePlan(id, name) {
  updatePlan(id, { name: (name || "Untitled plan").slice(0, 60) });
}

export function deletePlan(id) {
  write(PLAN_KEY, listPlans().filter((p) => p.id !== id));
}

export function clearPlans() {
  write(PLAN_KEY, []);
}

export function exportPlans() {
  return JSON.stringify({ version: 1, plans: listPlans(), snapshots: listSnapshots() }, null, 2);
}

/* Merge an export back in; ids are regenerated to avoid collisions. */
export function importPlans(json) {
  let data;
  try { data = JSON.parse(json); } catch { return { ok: false, error: "Not valid JSON." }; }
  const incoming = Array.isArray(data) ? data : (data.plans || []);
  if (!Array.isArray(incoming)) return { ok: false, error: "No plans found in that file." };
  const plans = listPlans();
  let added = 0;
  incoming.forEach((p) => {
    if (!p || !p.slug || typeof p.state !== "object") return;
    plans.unshift({ id: uid(), name: String(p.name || "Imported plan").slice(0, 60), slug: p.slug, savedAt: Date.now(), state: cleanState(p.state), scenarios: p.scenarios || null });
    added++;
  });
  write(PLAN_KEY, plans.slice(0, MAX_PLANS));
  const snaps = Array.isArray(data.snapshots) ? data.snapshots : [];
  if (snaps.length) {
    const merged = snaps.concat(listSnapshots());
    write(SNAP_KEY, merged.slice(0, MAX_SNAPS));
  }
  return { ok: true, added };
}

/* ---------------- net worth snapshots ---------------- */
export function listSnapshots() {
  const snaps = read(SNAP_KEY, []);
  if (!Array.isArray(snaps)) return [];
  return snaps
    .filter((s) => s && s.date && Number.isFinite(Number(s.netWorth)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function saveSnapshot(entry) {
  const snaps = listSnapshots().filter((s) => s.date !== entry.date); // one per date
  snaps.push({
    id: entry.id || uid(),
    date: String(entry.date),
    totalAssets: Number(entry.totalAssets) || 0,
    totalLiabilities: Number(entry.totalLiabilities) || 0,
    netWorth: Number(entry.netWorth) || 0
  });
  snaps.sort((a, b) => (a.date < b.date ? -1 : 1));
  write(SNAP_KEY, snaps.slice(-MAX_SNAPS));
}

export function deleteSnapshot(id) {
  write(SNAP_KEY, listSnapshots().filter((s) => s.id !== id));
}

export function clearSnapshots() {
  write(SNAP_KEY, []);
}
