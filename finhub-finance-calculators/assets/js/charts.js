/*
  FinHub SVG charts
  -----------------
  Pure DOM/SVG renderers for the chart models emitted by engine.js:
    { type:"area", title, data:{ labels, series:[{name,points,color}] } }
    { type:"donut", title, data:{ segments:[{name,value,color}] } }
    { type:"bars",  title, data:{ items:[{year,principal,interest,balance,color}] } }
  No libraries. Output is inline SVG + a semantic HTML legend for accessibility.
*/
const NS = "http://www.w3.org/2000/svg";
import { curPrefix } from "./engine.js";

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function h(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

/* compact axis labels: 12.3L, 1.05 Cr, 25k, 430 (INR) or 1.2M/450k (other) */
export function fmtAxis(v, currencyCode = "INR") {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (currencyCode === "INR") {
    if (a >= 1e7) return `${s}${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
    if (a >= 1e5) return `${s}${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
    if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}k`;
    return `${s}${Math.round(a)}`;
  }
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}k`;
  return `${s}${Math.round(a)}`;
}

function measureWidth(container) {
  const w = container ? container.getBoundingClientRect().width : 0;
  return Math.max(280, Math.min(w || 620, 900));
}

function buildLegend(parent, items) {
  if (!items || !items.length) return;
  const list = h("ul", "fin-legend", parent);
  for (const it of items) {
    const li = h("li", null, list);
    const sw = h("span", "fin-legend__dot", li);
    sw.style.background = it.color;
    h("span", null, li, it.name);
  }
}

function chartFrame(model, container, options) {
  const wrap = h("div", "finchart", container);
  if (model.title) h("h4", "finchart__title", wrap, model.title);
  const body = h("div", "finchart__body", wrap);
  if (options.accessor) {
    const holder = h("div", "finchart__canvas", body);
    const width = options.width || measureWidth(container);
    const svg = el("svg", { width, height: options.height, role: "img", "aria-label": model.title || "chart", class: "finchart__svg" }, holder);
    options.accessor(svg, { width, height: options.height });
  }
  if (options.legend) buildLegend(body, options.legend);
  return wrap;
}

function niceTicks(min, max, count) {
  if (!isFinite(min) || !isFinite(max)) return [0, 1, [0, 1]];
  if (min === max) { min = min === 0 ? 0 : min * 0.98; max = max === 0 ? 1 : max * 1.02; }
  const span = max - min;
  const step0 = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step0;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const step = step0 * mult;
  const t0 = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = t0; v <= max + step * 1e-6; v += step) ticks.push(Number(v.toFixed(8)));
  return [ticks[0] || 0, ticks[ticks.length - 1] || step, ticks];
}

/* ============================= AREA ============================= */
const AREA_PALETTE = ["#16a34a", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#3b82f6"];

function seriesColor(s, idx) {
  return s.color || AREA_PALETTE[idx % AREA_PALETTE.length];
}

function renderArea(svg, model, geom, currencyCode) {
  const { labels, series } = model.data;
  const W = geom.width, H = geom.height;
  const padL = 60, padR = 16, padT = 12, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  let lo = Infinity, hi = -Infinity;
  series.forEach((s) => (s.points || []).forEach((p) => { if (p < lo) lo = p; if (p > hi) hi = p; }));
  if (lo === Infinity) lo = 0;
  if (hi === lo) hi = lo + 1;
  const [t0, t1, ticks] = niceTicks(lo, hi, 4);
  const Y = (v) => padT + ih - ((v - t0) / (t1 - t0)) * ih;
  const X = (i) => padL + (labels.length <= 1 ? iw / 2 : (iw * i) / (labels.length - 1));

  const grid = el("g", { class: "finchart__grid" }, svg);
  ticks.forEach((t) => {
    const y = Y(t);
    el("line", { x1: padL, y1: y, x2: W - padR, y2: y }, grid);
    el("text", { x: padL - 8, y: y + 4, "text-anchor": "end", class: "finchart__tick" }, grid).textContent = fmtAxis(t, currencyCode);
  });
  const maxTicks = Math.max(3, Math.min(9, Math.floor(iw / 70)));
  const every = Math.max(1, Math.ceil(labels.length / maxTicks));
  labels.forEach((lb, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    const x = X(i);
    const text = el("text", { x, y: H - 12, "text-anchor": "middle", class: "finchart__tick finchart__tick--x" }, svg);
    text.textContent = lb.length > 14 ? lb.slice(0, 13) + "\u2026" : lb;
  });

  // subtle fill under the series with the largest swing (the interesting one)
  const spans = series.map((s) => {
    const pts = s.points || [];
    if (!pts.length) return 0;
    return Math.max.apply(null, pts) - Math.min.apply(null, pts);
  });
  const fillIdx = spans.indexOf(Math.max.apply(null, spans));
  if (fillIdx >= 0 && spans[fillIdx] > 1e-9) {
    const pts = series[fillIdx].points;
    const c = seriesColor(series[fillIdx], fillIdx);
    const id = `grad_${Math.random().toString(36).slice(2, 8)}`;
    const defs = el("defs", {}, svg);
    const lg = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0%", "stop-color": c, "stop-opacity": "0.26" }, lg);
    el("stop", { offset: "100%", "stop-color": c, "stop-opacity": "0.02" }, lg);
    let d = `M ${X(0)} ${Y(pts[0] ?? 0)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${X(i)} ${Y(pts[i])}`;
    d += ` L ${X(pts.length - 1)} ${padT + ih} L ${X(0)} ${padT + ih} Z`;
    el("path", { d, fill: `url(#${id})`, stroke: "none" }, svg);
  }

  const base = el("g", { class: "finchart__series" }, svg);
  series.forEach((s, idx) => {
    const pts = s.points || [];
    if (pts.length < 2) return;
    const c = seriesColor(s, idx);
    let d = `M ${X(0)} ${Y(pts[0])}`;
    for (let i = 1; i < pts.length; i++) {
      const x = X(i), x0 = X(i - 1);
      const y = Y(pts[i]), y0 = Y(pts[i - 1]);
      const cx = (x0 + x) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y}, ${x} ${y}`;
    }
    el("path", { d, fill: "none", stroke: c, "stroke-width": 2.2, "stroke-linecap": "round" }, base);
  });
}

/* ============================= DONUT ============================= */
function pt(cx, cy, r, ang) {
  return { x: cx + r * Math.sin(ang), y: cy - r * Math.cos(ang) };
}

function ringPath(cx, cy, rOut, rIn, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const s = pt(cx, cy, rOut, a0), e = pt(cx, cy, rOut, a1);
  const si = pt(cx, cy, rIn, a0), ei = pt(cx, cy, rIn, a1);
  return `M ${s.x} ${s.y} A ${rOut} ${rOut} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${rIn} ${rIn} 0 ${large} 0 ${si.x} ${si.y} Z`;
}

function renderDonut(svg, model, geom, curSymbol, currencyCode) {
  const segs = (model.data.segments || []).filter((s) => s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0);
  const size = Math.min(geom.width, 330);
  const rOut = size / 2 - 6, rIn = rOut * 0.62;
  const cx = geom.width / 2, cy = size / 2;
  if (total <= 0) {
    el("circle", { cx, cy, r: rOut, fill: "#e5e7eb", "stroke": "none" }, svg);
    return;
  }
  let acc = 0;
  const g = el("g", {}, svg);
  segs.forEach((s) => {
    const frac = s.value / total;
    const a0 = acc * Math.PI * 2;
    acc += frac;
    const a1 = acc * Math.PI * 2;
    const path = a1 - a0 >= Math.PI * 2 * 0.999
      ? null
      : ringPath(cx, cy, rOut, rIn, a0, a1);
    if (path === null) {
      el("circle", { cx, cy, r: rOut, fill: s.color }, g);
    } else {
      el("path", { d: path, fill: s.color }, g);
    }
  });
  const totalFmt = fmtAxis(total, currencyCode);
  const label = el("text", { x: cx, y: cy - 1, "text-anchor": "middle", class: "finchart__donut-total" }, svg);
  label.textContent = curSymbol + totalFmt;
  const cap = el("text", { x: cx, y: cy + 18, "text-anchor": "middle", class: "finchart__donut-cap" }, svg);
  cap.textContent = "total";
}

/* ============================= BARS ============================= */
function renderBars(svg, model, geom, currencyCode) {
  const items = model.data.items || [];
  if (!items.length) return;
  const W = geom.width, H = geom.height;
  const padL = 60, padR = 16, padT = 12, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  let lo = 0, hi = 0;
  items.forEach((it) => {
    const v = (it.principal || 0) + (it.interest || 0);
    if (v > hi) hi = v;
    if ((it.principal || 0) < lo) lo = it.principal || 0;
  });
  if (hi === 0) hi = 1;
  const total = hi - lo;
  const [t0, t1, ticks] = niceTicks(lo, hi, 4);
  const Y = (v) => padT + ih - ((v - t0) / (t1 - t0)) * ih;
  const slot = iw / items.length;
  const barW = Math.min(54, Math.max(12, slot * 0.55));
  const zeroY = Y(0);

  el("line", { x1: padL, y1: zeroY, x2: W - padR, y2: zeroY, class: "finchart__axis" }, svg);
  const grid = el("g", { class: "finchart__grid" }, svg);
  ticks.forEach((t) => {
    if (t === 0) return;
    const y = Y(t);
    el("line", { x1: padL, y1: y, x2: W - padR, y2: y }, grid);
    el("text", { x: padL - 8, y: y + 4, "text-anchor": "end", class: "finchart__tick" }, grid).textContent = fmtAxis(t, currencyCode);
  });

  items.forEach((it, i) => {
    const cx = padL + slot * i + slot / 2;
    const principal = it.principal || 0;
    const interest = it.interest || 0;
    const x = cx - barW / 2;
    const colorBase = it.color || "#3b82f6";
    const colorInt = it.color ? null : "#ef4444";
    if (principal !== 0) {
      const pTop = principal > 0 ? Math.max(zeroY, Y(principal)) : zeroY;
      const pBot = principal > 0 ? zeroY : Math.min(zeroY, Y(principal));
      const rect = el("rect", { x, y: pTop, width: barW, height: Math.max(0.5, pBot - pTop), fill: colorBase, rx: 2 }, svg);
      if (principal < 0) rect.setAttribute("class", "finchart__neg");
    }
    if (interest > 0) {
      const y1 = Y(principal), y2 = Y(principal + interest);
      el("rect", { x, y: y2, width: barW, height: Math.max(0.5, y1 - y2), fill: colorInt || colorBase, rx: 2 }, svg);
    }
    const lbl = el("text", { x: cx, y: H - 14, "text-anchor": "middle", class: "finchart__tick finchart__tick--x" }, svg);
    lbl.textContent = String(it.year || "").length > 14 ? String(it.year || "").slice(0, 13) + "\u2026" : it.year;
  });
}

/* ========================== PUBLIC ========================== */
export function renderChart(model, container, currencyCode = "INR") {
  if (!model) return null;
  const symbol = curPrefix(currencyCode);
  if (model.type === "area") {
    const series = model.data.series || [];
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom) => renderArea(svg, model, geom, currencyCode),
      legend: series.map((s, i) => ({ name: s.name, color: seriesColor(s, i) }))
    });
  }
  if (model.type === "donut") {
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom) => renderDonut(svg, model, geom, symbol, currencyCode),
      legend: (model.data.segments || []).map((s) => ({ name: `${s.name}`, color: s.color }))
    });
  }
  if (model.type === "bars") {
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom) => renderBars(svg, model, geom, currencyCode)
    });
  }
  return null;
}
