/*
  FinHub shared table renderer
  ----------------------------
  Turns any compute() result into detailed HTML tables (derived from every
  chart model via engine.deriveTables) with a totals row and per-table CSV.
  Shared by the calculator shell (app.js) and the decision tools (tools.js).
*/
import { deriveTables, fmtCompactMoney, fmtPct, fmtNum } from "./engine.js";

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function fmtCell(kind, v, cur) {
  if (v === null || v === undefined || v === "") return "\u2014";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  switch (kind) {
    case "money": return fmtCompactMoney(n, cur);
    case "pct": return fmtPct(n, 2);
    case "num": return fmtNum(n, 2);
    case "years": return `${fmtNum(n, n % 1 ? 2 : 0)} yr`;
    default: return String(v);
  }
}

export function tableCsv(t) {
  const esc = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const lines = [esc(t.title), t.columns.map((c) => esc(c.label)).join(",")];
  t.rows.forEach((r) => lines.push(r.map(esc).join(",")));
  if (t.totals) lines.push(t.totals.map(esc).join(","));
  return lines.join("\n");
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

function buildTable(t, currencyCode) {
  const det = el("details", "table-block");
  det.open = true;
  const sum = el("summary");
  sum.appendChild(el("span", null, t.title));
  const copy = el("button", "table-block__csv", "Copy CSV");
  copy.type = "button";
  copy.addEventListener("click", (e) => { e.preventDefault(); copyText(tableCsv(t)); flash(copy, "Copied"); });
  sum.appendChild(copy);
  det.appendChild(sum);

  const wrap = el("div", "table-scroll");
  const table = el("table");
  if (t.title) table.appendChild(el("caption", "sr-only", t.title));
  const thead = el("thead");
  const hr = el("tr");
  t.columns.forEach((c) => {
    const th = el("th", c.kind === "text" ? "" : "num", c.label);
    th.scope = "col";
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody");
  t.rows.forEach((r, ri) => {
    const tr = el("tr");
    r.forEach((val, ci) => {
      const kind = t.columns[ci] ? t.columns[ci].kind : "text";
      if (ci === 0) {
        const th = el("th", "td--period", fmtCell(kind, val, currencyCode));
        th.scope = "row";
        tr.appendChild(th);
      } else {
        tr.appendChild(el("td", kind === "text" ? "" : "num", fmtCell(kind, val, currencyCode)));
      }
    });
    const cls = t.rowClass && t.rowClass[ri];
    if (cls) {
      tr.className = cls;
      const badge = /\bshort\b/.test(cls) ? "Below goal" : /recommended/.test(cls) ? "Recommended" : "";
      if (badge && tr.firstChild) tr.firstChild.appendChild(el("span", "row-badge", badge));
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  if (t.totals) {
    const tfoot = el("tfoot");
    const tr = el("tr");
    t.totals.forEach((val, ci) => {
      const kind = t.columns[ci] ? t.columns[ci].kind : "text";
      tr.appendChild(el("td", ci === 0 ? "td--period" : (kind === "text" ? "" : "num"), fmtCell(kind, val, currencyCode)));
    });
    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }
  wrap.appendChild(table);
  det.appendChild(wrap);
  return det;
}

/* Render all derived tables into a mount element. */
export function renderTablesInto(mount, result, currencyCode = "INR", opts = {}) {
  if (!mount) return 0;
  mount.innerHTML = "";
  const tables = (opts.tables || deriveTables(result));
  if (!tables.length) return 0;
  if (opts.title !== false) mount.appendChild(el("h3", "tables__title", opts.title || "Detailed tables"));
  tables.forEach((t) => mount.appendChild(buildTable(t, currencyCode)));
  return tables.length;
}

export function resultToCsv(result) {
  const tables = deriveTables(result);
  if (!tables.length) return null;
  return tables.map(tableCsv).join("\n\n");
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
