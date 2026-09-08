/*
  FinHub app shell
  ----------------
  Hydrates the server-generated pages:
   - home: live search/filter over calculator cards
   - calc: builds the form from engine.js field definitions (single source
     of truth), computes instantly, renders headline/stats/charts/note,
     and provides currency switch, history, share/copy/print, reset.
  No duplicated calculation logic - everything comes from engine.js.
*/
import { getCalc, computeCalc, fmtMoney, fmtCompactMoney, fmtPct, fmtNum, clamp, getCurrency, isCurrency, parseAmountText, fmtGrouped } from "./engine.js";
import { renderChart } from "./charts.js";

const page = window.FINHUB_PAGE || { type: "calc", slug: "sip" };
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const state = {
  slug: page.slug || "sip",
  defs: [],
  values: {},
  currency: store.get("finhub_currency", "INR"),
  lastResult: null,
  dirty: false,
  calcEls: {}
};

/* ---------------- formatting helpers ---------------- */
function fmtValue(kind, value, cur) {
  if (value === null || value === undefined) return "\u2014";
  if (kind === "text") return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return "\u2014";
  switch (kind) {
    case "money": return fmtMoney(n, cur);
    case "pct": return fmtPct(n, 2);
    case "num": return fmtNum(n);
    case "years": return `${fmtNum(n, n % 1 ? 2 : 0)} yr${n === 1 ? "" : "s"}`;
    case "months": return `${fmtNum(n)} mo`;
    case "ratio": return `1 : ${fmtNum(n, 2)}`;
    default: return `${n}`;
  }
}

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = store.get("finhub_theme", null);
  const theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  });
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set("finhub_theme", t);
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    const label = t === "dark" ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  });
}

/* ============================ HOME ============================ */
function renderRecent() {
  const sec = document.querySelector("[data-recent-section]");
  if (!sec) return;
  const ul = document.querySelector("[data-recent]");
  if (!ul) return;
  const seen = store.get("finhub_recent", []).filter((s) => getCalc(s));
  ul.innerHTML = "";
  if (!seen.length) { sec.hidden = true; return; }
  seen.slice(0, 6).forEach((slug) => {
    const c = getCalc(slug);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `/${slug}/`;
    a.textContent = c.name;
    li.appendChild(a);
    ul.appendChild(li);
  });
  sec.hidden = false;
}
function initHelper() {
  const form = document.querySelector("[data-helper-form]");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const sel = form.querySelector("[data-helper-goal]");
    if (sel && sel.value) location.href = `/${sel.value}/`;
  });
}
function initHome() {
  const input = document.querySelector("[data-home-search]");
  if (input) {
    const cards = Array.from(document.querySelectorAll("[data-calc-card]"));
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      let any = false;
      cards.forEach((card) => {
        const hay = `${card.dataset.name || ""} ${card.dataset.desc || ""} ${card.dataset.tags || ""}`.toLowerCase();
        const show = !q || hay.includes(q);
        card.hidden = !show;
        if (show) any = true;
      });
      document.querySelectorAll("[data-calc-group]").forEach((g) => {
        const visible = Array.from(g.querySelectorAll("[data-calc-card]")).some((c) => !c.hidden);
        g.hidden = !visible;
      });
      const empty = document.querySelector("[data-search-empty]");
      if (empty) empty.hidden = any;
    });
  }
  renderRecent();
  initHelper();
}
function noteVisit() {
  if (!state.slug) return;
  const arr = store.get("finhub_recent", []).filter((s) => s !== state.slug);
  arr.unshift(state.slug);
  store.set("finhub_recent", arr.slice(0, 6));
}

/* ============================ CALC ============================ */
function fieldEl(key) { return state.calcEls[key] || {}; }

/* floor a committed value to the field minimum but never to its max: the
   user may type past the slider range (only the slider pins at the max). */
function unclampVal(v, f) {
  const n = Number(v);
  if (!Number.isFinite(n)) return f ? f.min : v;
  const lo = Number(f && f.min);
  return Number.isFinite(lo) ? Math.max(lo, n) : n;
}

function buildForm() {
  const calc = getCalc(state.slug);
  const mount = document.querySelector("[data-app-form]");
  if (!mount) return;
  const frag = document.createDocumentFragment();
  state.defs.forEach((f) => {
    if (f.type === "select") {
      const box = div("field");
      const label = tag("label", "field__label", null, f.label);
      label.htmlFor = `f-${f.key}`;
      const sel = tag("select", "field__select");
      sel.id = `f-${f.key}`;
      (f.options || []).forEach((o) => {
        const op = tag("option", null, null, o.label);
        op.value = o.v;
        sel.appendChild(op);
      });
      box.append(label, sel);
      frag.appendChild(box);
      state.calcEls[f.key] = { el: sel, def: f };
      sel.value = state.values[f.key] ?? f.def;
      sel.addEventListener("change", () => { state.values[f.key] = sel.value; userRender(); });
      return;
    }
    const numeric = ["money", "number", "pct", "years", "months"].includes(f.type);
    if (!numeric) return;

    const prefix = f.type === "money" ? tag("span", "field__prefix", null, curSymbol()) : null;
    const suffix = f.type === "pct" ? tag("span", "field__suffix", null, "%")
      : f.type === "years" ? tag("span", "field__suffix", null, "yrs")
        : f.type === "months" ? tag("span", "field__suffix", null, "mo")
          : null;

    const box = div("field");
    const label = tag("label", "field__label", null, f.label);
    label.htmlFor = `f-${f.key}`;
    const ctl = div("field__ctl");
    const inputwrap = div("field__input");
    const input = tag("input", "field__num");
    input.id = `f-${f.key}`;
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.setAttribute("aria-describedby", `h-${f.key}`);
    const hint = tag("span", "sr-only", null, `Type a number${f.type === "money" ? " - you can use 10k, 1.5L, 2Cr or grouped digits" : ""}.`);
    hint.id = `h-${f.key}`;
    const range = tag("input", "field__range");
    range.type = "range";
    range.min = f.min; range.max = f.max; range.step = f.step;
    range.setAttribute("aria-label", `${f.label} slider`);
    if (prefix) inputwrap.appendChild(prefix);
    inputwrap.appendChild(input);
    if (suffix) inputwrap.appendChild(suffix);
    ctl.appendChild(inputwrap);
    if (f.max - f.min > 0) ctl.appendChild(range);
    box.append(label, hint, ctl);
    frag.appendChild(box);

    /* decimals used for grouped display: honour the step, never drop the
       fractional part the user actually typed (capped at 4 places). */
    const decOf = (n) => String(n).split(".")[1] ? String(n).split(".")[1].length : 0;
    const stepDec = decOf(f.step);
    const dispDec = (value) => Math.min(4, Math.max(stepDec, value % 1 ? decOf(value) : 0));

    const display = (n) => {
      if (!Number.isFinite(n)) return "";
      if (f.type === "money") return fmtGrouped(n, state.currency, dispDec(n));
      return n.toLocaleString("en-US", { maximumFractionDigits: dispDec(n) });
    };
    /* numeric is the single source of truth for calculations. `input.value`
       is only ever the raw text the user typed - never rewritten while they
       are editing - which keeps the caret exactly where they left it. */
    const numericOf = () => (Number.isFinite(state.values[f.key]) ? state.values[f.key] : f.def);
    const syncSlider = () => { if (range) range.value = clamp(numericOf(), f.min, f.max); };
    const setInput = (n) => { input.value = display(n); };

    input.value = display(numericOf());
    syncSlider();

    input.addEventListener("input", () => {
      const parsed = parseAmountText(input.value);
      if (Number.isFinite(parsed)) {
        state.values[f.key] = parsed;
        if (range) range.value = clamp(parsed, f.min, f.max);
      }
      scheduleRender();
    });
    input.addEventListener("blur", () => {
      const parsed = parseAmountText(input.value);
      if (Number.isFinite(parsed)) {
        state.values[f.key] = parsed;
        setInput(parsed);
        if (range) range.value = clamp(parsed, f.min, f.max);
      } else {
        /* empty / half-typed text: fall back to the committed numeric */
        setInput(numericOf());
      }
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
    range.addEventListener("input", () => {
      state.values[f.key] = Number(range.value);
      setInput(state.values[f.key]);
      userRender();
    });
    state.calcEls[f.key] = { el: input, def: f, range, setVal: (v) => { state.values[f.key] = unclampVal(v, f); setInput(state.values[f.key]); syncSlider(); } };
  });
  mount.innerHTML = "";
  mount.appendChild(frag);
}

function curSymbol() {
  return getCurrency(state.currency).symbol;
}

function div(cls) { return tag("div", cls); }
function tag(t, cls, parent, text) {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

/* ---- dynamic net-worth form ---- */
function buildDynamicForm() {
  const mount = document.querySelector("[data-app-form]");
  if (!mount) return;
  const saved = store.get(`finhub_last_${state.slug}`, null);
  const defaults = {
    assets: [
      { name: "Cash & bank", value: 500000 }, { name: "Investments", value: 2000000 },
      { name: "Property", value: 6000000 }, { name: "Fixed deposits", value: 1000000 },
      { name: "Retirement funds", value: 800000 }
    ],
    liabilities: [
      { name: "Home loan", value: 2000000 }, { name: "Car loan", value: 400000 },
      { name: "Credit card dues", value: 80000 }
    ]
  };
  state.values.assets = saved ? saved.inputs.assets : defaults.assets;
  state.values.liabilities = saved ? saved.inputs.liabilities : defaults.liabilities;
  mount.innerHTML = "";
  mount.appendChild(dynGroup("assets", "Your assets (what you own)", "#16a34a"));
  mount.appendChild(dynGroup("liabilities", "Your liabilities (what you owe)", "#ef4444"));
  wireDynMount();
}

function dynRow(listKey, item) {
  const row = div("dyn-row");
  const nameIn = tag("input", "dyn-row__name");
  nameIn.type = "text";
  nameIn.placeholder = "Label";
  nameIn.value = item.name || "";
  nameIn.setAttribute("aria-label", `${listKey === "assets" ? "Asset" : "Liability"} name`);
  const valIn = tag("input", "dyn-row__val");
  valIn.type = "number"; valIn.inputMode = "decimal"; valIn.min = "0"; valIn.step = "100";
  valIn.value = item.value;
  valIn.setAttribute("aria-label", `${listKey === "assets" ? "Asset" : "Liability"} value`);
  const rm = tag("button", "dyn-row__rm");
  rm.type = "button"; rm.textContent = "\u00d7";
  rm.setAttribute("aria-label", "Remove row");
  rm.addEventListener("click", () => {
    row.remove();
    collectDyn();
    userRender();
  });
  row.append(nameIn, valIn, rm);
  [nameIn, valIn].forEach((el2) => el2.addEventListener("input", debounce(() => { collectDyn(); userRender(); }, 80)));
  return row;
}

function dynGroup(listKey, title, color) {
  const g = div("dyn-group");
  tag("h3", "dyn-group__title", g, title);
  const rows = div("dyn-rows");
  rows.dataset.dynList = listKey;
  (state.values[listKey] || []).forEach((it) => rows.appendChild(dynRow(listKey, it)));
  g.appendChild(rows);
  const add = tag("button", "btn btn--ghost btn--sm", g, `+ Add ${listKey === "assets" ? "asset" : "liability"}`);
  add.type = "button";
  add.addEventListener("click", () => {
    const r = dynRow(listKey, { name: "", value: 0 });
    rows.appendChild(r);
    collectDyn();
    userRender();
  });
  return g;
}

function collectDyn() {
  document.querySelectorAll("[data-dyn-list]").forEach((rowsEl) => {
    const listKey = rowsEl.dataset.dynList;
    const arr = [];
    rowsEl.querySelectorAll(".dyn-row").forEach((r) => {
      const name = r.querySelector(".dyn-row__name").value.trim() || (listKey === "assets" ? "Asset" : "Liability");
      const value = Number(r.querySelector(".dyn-row__val").value) || 0;
      arr.push({ name, value });
    });
    state.values[listKey] = arr;
  });
}
function wireDynMount() {
  const el1 = document.querySelectorAll("[data-dyn-list]");
  if (!el1.length) document.addEventListener("input", (e) => {
    if (e.target.classList && e.target.classList.contains("dyn-row__name")) { collectDyn(); render(); }
  }, true);
}

/* ---- result rendering ---- */
function render() {
  const calc = getCalc(state.slug);
  if (calc.dynamic) collectDyn();
  const inputs = { ...state.values };
  let result;
  try {
    result = computeCalc(state.slug, state.values);
  } catch (err) {
    result = null;
  }
  if (!result) {
    renderCalcError(calc);
    return;
  }
  state.lastResult = result;
  renderHead(result.head);
  renderStats(result.stats);
  renderCharts(result.charts);
  renderTable(result);
  const noteEl = document.querySelector("[data-app-note]");
  if (noteEl) noteEl.textContent = result.note || "";
  if (state.dirty) saveRecent(inputs, result.head);
}

/* one broken input set must not blank the page: show a gentle fallback. */
function renderCalcError(calc) {
  const name = calc ? calc.name : "this calculator";
  document.querySelectorAll("[data-app-head], [data-app-stats], [data-app-charts]").forEach((m) => { m.innerHTML = ""; });
  const noteEl = document.querySelector("[data-app-note]");
  if (noteEl) noteEl.textContent = `Could not run ${name} with those values. Please check the inputs and try again.`;
}
function userRender() {
  state.dirty = true;
  render();
}
const scheduleRender = debounce(userRender, 80);

function renderHead(head) {
  const m = document.querySelector("[data-app-head]");
  if (!m || !head) return;
  m.innerHTML = "";
  const card = div("result-head");
  tag("span", "result-head__label", card, head.label);
  const v = head.value === null || head.value === undefined ? null : Number(head.value);
  if (v === null || !Number.isFinite(v)) {
    tag("span", "result-head__money is-empty", card, "\u2014");
  } else if (head.kind === "years") {
    tag("span", "result-head__years", card, `${fmtNum(v, 2)} years`);
  } else if (head.kind === "money") {
    if (v < 0 || head.negative) card.classList.add("is-neg");
    tag("span", "result-head__money", card, fmtMoney(v, state.currency));
  } else if (head.kind === "pct") {
    tag("span", "result-head__money", card, fmtPct(v, 2));
  } else if (head.kind === "ratio") {
    tag("span", "result-head__money", card, `1 : ${fmtNum(v, 2)}`);
  } else {
    tag("span", "result-head__money", card, fmtNum(v));
  }
  m.appendChild(card);
}

function renderStats(stats) {
  const m = document.querySelector("[data-app-stats]");
  if (!m) return;
  m.innerHTML = "";
  const grid = div("stat-grid");
  (stats || []).forEach((s) => {
    const c = div("stat");
    if (s.negative || (Number(s.value) < 0 && ["money", "pct", "num"].includes(s.kind))) c.classList.add("stat--neg");
    tag("span", "stat__label", c, s.label);
    tag("span", "stat__value", c, fmtValue(s.kind, s.value, state.currency));
    grid.appendChild(c);
  });
  m.appendChild(grid);
}

function renderCharts(models) {
  const m = document.querySelector("[data-app-charts]");
  if (!m) return;
  m.innerHTML = "";
  (models || []).forEach((model) => renderChart(model, m, state.currency));
}

/* ---- year-by-year table + CSV export (from the first area chart) ---- */
function tableModel(result) {
  if (!result || !result.charts) return null;
  const ch = result.charts.find((x) => x.type === "area" && x.data && Array.isArray(x.data.labels) && x.data.labels.length > 1);
  if (!ch) return null;
  return { title: ch.title || "Year by year", labels: ch.data.labels, series: ch.data.series };
}
function renderTable(result) {
  const m = document.querySelector("[data-app-table]");
  if (!m) return;
  m.innerHTML = "";
  const t = tableModel(result);
  if (!t) return;
  const det = document.createElement("details");
  det.className = "table-block";
  const sum = document.createElement("summary");
  sum.textContent = `Year-by-year table \u2014 ${t.title}`;
  det.appendChild(sum);
  const wrap = div("table-scroll");
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  tag("th", "", hr, "Period");
  t.series.forEach((s) => tag("th", "", hr, s.name));
  head.appendChild(hr);
  table.appendChild(head);
  const body = document.createElement("tbody");
  t.labels.forEach((lab, i) => {
    const tr = document.createElement("tr");
    tag("td", "td--period", tr, lab);
    t.series.forEach((s) => {
      const raw = Number(s.points[i]);
      tag("td", "", tr, Number.isFinite(raw) ? fmtCompactMoney(raw, state.currency) : "\u2014");
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  wrap.appendChild(table);
  det.appendChild(wrap);
  m.appendChild(det);
}
function csvString(result) {
  const t = tableModel(result);
  if (!t) return null;
  const esc = (s) => /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
  const lines = [[esc(t.title)].join(""), ["Period"].concat(t.series.map((s) => esc(s.name))).join(",")];
  t.labels.forEach((lab, i) => {
    const row = [esc(lab)].concat(t.series.map((s) => { const raw = s.points[i]; return Number.isFinite(raw) ? raw : ""; }));
    lines.push(row.join(","));
  });
  return lines.join("\n");
}
function exportCsv(btn) {
  const csv = csvString(state.lastResult);
  if (!csv) { flash(btn, "No table to export"); return; }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finhub-${state.slug}-table.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash(btn, "Downloaded");
}

function renderAll() {
  if (getCalc(state.slug).dynamic) { collectDyn(); }
  render();
}

/* ---- history ---- */
function historyKey() { return `finhub_history_${state.slug}`; }
function saveRecent(inputs, head) {
  const rec = { slug: state.slug, t: Date.now(), inputs: JSON.parse(JSON.stringify(inputs)), head };
  const hist = store.get(historyKey(), []).filter((x) => x.slug === state.slug);
  hist.unshift(rec);
  store.set(historyKey(), hist.slice(0, 30));
  store.set(`finhub_last_${state.slug}`, rec);
  renderHistory();
}
function renderHistory() {
  const mount = document.querySelector("[data-app-history]");
  if (!mount) return;
  const list = store.get(historyKey(), []).filter((x) => x.slug === state.slug);
  mount.innerHTML = "";
  if (!list.length) {
    tag("p", "history-empty", mount, "No saved runs yet. Every calculation is remembered here so you can compare scenarios.");
    return;
  }
  const wrap = div("history");
  list.forEach((rec) => {
    const row = div("history__row");
    const d = new Date(rec.t);
    const when = d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    tag("span", "history__time", row, when);
    tag("span", "history__head", row, `${rec.head ? rec.head.label : ""}: ${fmtValue(rec.head ? rec.head.kind : "money", rec.head ? rec.head.value : 0, state.currency)}`);
    const load = tag("button", "history__load", row, "Load");
    load.type = "button";
    load.addEventListener("click", () => {
      if (getCalc(state.slug).dynamic) {
        state.values.assets = JSON.parse(JSON.stringify(rec.inputs.assets || []));
        state.values.liabilities = JSON.parse(JSON.stringify(rec.inputs.liabilities || []));
        buildDynamicForm();
        collectDyn();
        render();
      } else {
        state.defs.forEach((f) => {
          const v = rec.inputs[f.key];
          if (v !== undefined) {
            const ce = fieldEl(f.key);
            state.values[f.key] = f.type === "select" ? v : unclampVal(v, f);
            if (ce.setVal) ce.setVal(state.values[f.key]);
            else if (ce.el) ce.el.value = v;
          }
        });
        render();
      }
    });
    wrap.appendChild(row);
  });
  const clear = tag("button", "btn btn--ghost btn--sm", mount, "Clear history");
  clear.type = "button";
  clear.addEventListener("click", () => { store.set(historyKey(), []); renderHistory(); });
  mount.appendChild(wrap);
}

/* ---- share / copy / print ---- */
function shareUrl() {
  const calc = getCalc(state.slug);
  if (calc.dynamic) return null;
  const p = new URLSearchParams();
  state.defs.forEach((f) => {
    const v = state.values[f.key];
    if (v === undefined) return;
    if (f.type === "select") p.set(f.key, String(v));
    else p.set(f.key, String(Number(v)));
  });
  p.set("c", state.currency);
  return `${location.origin}${location.pathname}?${p.toString()}`;
}
function restoreFromQuery() {
  const q = new URLSearchParams(location.search);
  const c = q.get("c");
  if (c && isCurrency(c)) setCurrency(c, true);
  let hit = false;
  state.defs.forEach((f) => {
    const v = q.get(f.key);
    if (v === null || v === undefined || v === "") return;
    hit = true;
    if (f.type === "select") state.values[f.key] = v;
    else {
      const n = Number(v);
      if (Number.isFinite(n)) state.values[f.key] = unclampVal(n, f);
    }
  });
  return hit;
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch { /* ignore */ }
  ta.remove();
}
function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1400);
}

function summaryText(result) {
  const calc = getCalc(state.slug);
  const lines = [];
  lines.push(`${calc.name} | FinHub`);
  lines.push("");
  if (!calc.dynamic) {
    state.defs.forEach((f) => {
      const v = state.values[f.key];
      if (v === undefined) return;
      const shown = f.type === "select"
        ? ((f.options || []).find((o) => o.v === v) || {}).label || v
        : f.type === "pct" ? `${fmtNum(Number(v), 2)}%`
          : f.type === "money" ? fmtMoney(Number(v), state.currency)
            : f.type === "years" ? `${fmtNum(Number(v))} yrs`
              : f.type === "months" ? `${fmtNum(Number(v))} mo`
                : fmtNum(Number(v));
      lines.push(`${f.label}: ${shown}`);
    });
    lines.push("");
  }
  if (result.head) lines.push(`${result.head.label}: ${fmtValue(result.head.kind, result.head.value, state.currency)}`);
  (result.stats || []).forEach((s) => lines.push(`${s.label}: ${fmtValue(s.kind, s.value, state.currency)}`));
  lines.push("");
  lines.push("Made with FinHub. Educational estimate - not financial advice.");
  return lines.join("\n");
}

function initToolbar() {
  document.querySelectorAll("[data-currency]").forEach((sel) => {
    sel.value = state.currency;
    sel.addEventListener("change", () => setCurrency(sel.value));
  });
  const shareBtn = document.querySelector("[data-share]");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const url = shareUrl();
      if (url && navigator.share) {
        try { await navigator.share({ title: getCalc(state.slug).name, text: summaryText(state.lastResult), url }); return; } catch { /* cancelled */ }
      }
      if (url) { copyText(url); flash(shareBtn, "Link copied"); }
      else flash(shareBtn, "Nothing to share");
    });
  }
  const copyBtn = document.querySelector("[data-copy]");
  if (copyBtn) copyBtn.addEventListener("click", () => { copyText(summaryText(state.lastResult)); flash(copyBtn, "Copied"); });
  const csvBtn = document.querySelector("[data-csv]");
  if (csvBtn) csvBtn.addEventListener("click", () => exportCsv(csvBtn));
  const printBtn = document.querySelector("[data-print]");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
  const resetBtn = document.querySelector("[data-reset]");
  if (resetBtn) resetBtn.addEventListener("click", resetForm);
  const histBtn = document.querySelector("[data-history-toggle]");
  const histPanel = document.querySelector("[data-history]");
  if (histBtn && histPanel) {
    histBtn.addEventListener("click", () => {
      const open = histPanel.hidden === false;
      histPanel.hidden = open;
      histBtn.setAttribute("aria-expanded", String(!open));
      if (!open) renderHistory();
    });
  }
  const banner = document.querySelector("[data-trusted]");
  if (banner) banner.textContent = banner.textContent.replace(/\u20B9/g, curSymbol());
}

function setCurrency(code, skipRender) {
  const next = isCurrency(code) ? code : "INR";
  state.currency = next;
  store.set("finhub_currency", state.currency);
  document.querySelectorAll("[data-currency]").forEach((s) => { s.value = state.currency; });
  document.querySelectorAll(".field__prefix").forEach((p) => { p.textContent = curSymbol(); });
  Object.entries(state.calcEls).forEach(([, ce]) => {
    if (!ce || !ce.def || !ce.el || ce.el.tagName !== "INPUT") return;
    if (ce.def.type !== "money") return;
    const n = state.values[ce.def.key];
    if (Number.isFinite(n)) ce.el.value = fmtGrouped(n, state.currency, decimalsOf(ce.def, n));
  });
  if (!skipRender) renderAll();
}
function decimalsOf(f, n) {
  const sd = String(f.step).split(".")[1] ? String(f.step).split(".")[1].length : 0;
  return Math.min(4, Math.max(sd, n % 1 ? String(n).split(".")[1].length : 0));
}
function resetForm() {
  const calc = getCalc(state.slug);
  if (calc.dynamic) {
    document.querySelectorAll("[data-dyn-list]").forEach(() => {});
    const m = document.querySelector("[data-app-form]");
    m.innerHTML = "";
    state.values = {};
    buildDynamicForm();
    collectDyn();
    render();
    return;
  }
  state.defs.forEach((f) => {
    state.values[f.key] = f.def;
    const ce = fieldEl(f.key);
    if (ce.setVal) ce.setVal(f.def); else if (ce.el) ce.el.value = f.def;
  });
  render();
}

/* resize -> redraw charts at new width */
function initResize() {
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (state.lastResult) renderCharts(state.lastResult.charts); }, 160);
  });
}

/* ---------------- boot ---------------- */
function initPremiumGate() {
  if (!page.premium) return;
  const card = document.querySelector(".results-card");
  if (card) card.classList.add("premium-locked");
  const cta = document.querySelector("[data-pro-cta]");
  if (cta) cta.addEventListener("click", () => flash(cta, "Coming soon - connect your checkout"));
}

function initCalc() {
  const calc = getCalc(state.slug);
  if (!calc) return;
  initTheme();
  if (calc.dynamic) {
    buildDynamicForm();
  } else {
    state.defs = calc.fields || [];
    state.defs.forEach((f) => { state.values[f.key] = f.def; });
    const restored = restoreFromQuery();
    if (!restored) {
      const last = store.get(`finhub_last_${state.slug}`, null);
      if (last && last.inputs) {
        state.defs.forEach((f) => {
          const v = last.inputs[f.key];
          if (v !== undefined && f.type === "select") state.values[f.key] = v;
          else if (v !== undefined) state.values[f.key] = unclampVal(v, f);
        });
      }
    }
    buildForm();
  }
  initToolbar();
  render();
  renderHistory();
  initResize();
  noteVisit();
}

function boot() {
  if (!page.type || page.type === "home") { initTheme(); initHome(); return; }
  if (getCalc(state.slug)) { initCalc(); initPremiumGate(); }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
