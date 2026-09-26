/*
  FinHub SVG charts
  -----------------
  Pure DOM/SVG renderers, no libraries. Chart models emitted by engine.js:

    { type:"area",      data:{ labels, series:[{name,points,color,dashed}] } }
    { type:"line",      data:{ labels, series:[{name,points,color,dashed}] } }
    { type:"bars",      data:{ items:[{year,principal,interest,balance,color,label}] } }
    { type:"hbar",      data:{ items:[{label,value,color,secondary}] } }
    { type:"waterfall", data:{ items:[{label,value,type,color}] } }
    { type:"gauge",     data:{ value, max, label, kind, color, caption } }
    { type:"donut",     data:{ segments:[{name,value,color}] } }

  All charts are interactive: hover shows a tooltip, and line/area charts draw a
  crosshair. Output is inline SVG plus a semantic HTML legend for accessibility.
*/
const NS = "http://www.w3.org/2000/svg";
import { curPrefix, fmtMoney, fmtCompactMoney, fmtPct, fmtNum } from "./engine.js";

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

function money(v, currencyCode) {
  return fmtMoney(Number(v) || 0, currencyCode);
}

function buildLegend(parent, items) {
  if (!items || !items.length) return;
  const list = h("ul", "fin-legend", parent);
  for (const it of items) {
    const li = h("li", null, list);
    const sw = h("span", "fin-legend__dot", li);
    sw.style.background = it.color;
    if (it.dashed) sw.classList.add("fin-legend__dot--dashed");
    h("span", null, li, it.name);
  }
}

/* shared tooltip */
function tooltip(wrap) {
  let tip = wrap.querySelector(".finchart__tip");
  if (!tip) {
    tip = h("div", "finchart__tip", wrap);
    tip.hidden = true;
  }
  return {
    show(html, x, y) {
      tip.innerHTML = html;
      tip.hidden = false;
      const w = tip.offsetWidth || 140;
      const hh = tip.offsetHeight || 40;
      tip.style.left = `${Math.max(4, Math.min(x, (wrap.clientWidth || 600) - w - 4))}px`;
      tip.style.top = `${Math.max(0, y - hh - 10)}px`;
    },
    hide() { tip.hidden = true; }
  };
}

function chartFrame(model, container, options) {
  const wrap = h("div", "finchart", container);
  if (model.title) h("h4", "finchart__title", wrap, model.title);
  const body = h("div", "finchart__body", wrap);
  if (options.accessor) {
    const holder = h("div", "finchart__canvas", body);
    const width = options.width || measureWidth(container);
    const svg = el("svg", { width, height: options.height, role: "img", "aria-label": model.title || "chart", class: "finchart__svg" }, holder);
    const tip = tooltip(holder);
    options.accessor(svg, { width, height: options.height }, tip, holder);
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

const AREA_PALETTE = ["#16a34a", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#3b82f6"];
function seriesColor(s, idx) { return s.color || AREA_PALETTE[idx % AREA_PALETTE.length]; }

/* ========================= AREA / LINE ========================= */
function renderLineLike(svg, model, geom, currencyCode, tip, holder, fill) {
  const { labels, series } = model.data;
  const W = geom.width, H = geom.height;
  const padL = 62, padR = 18, padT = 14, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  let lo = Infinity, hi = -Infinity;
  series.forEach((s) => (s.points || []).forEach((p) => { if (p < lo) lo = p; if (p > hi) hi = p; }));
  if (lo === Infinity) lo = 0;
  if (hi === lo) hi = lo + 1;
  if (lo > 0) lo = 0;
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

  if (fill) {
    const spans = series.map((s) => {
      const pts = s.points || [];
      return pts.length ? Math.max.apply(null, pts) - Math.min.apply(null, pts) : 0;
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
  }

  const base = el("g", { class: "finchart__series" }, svg);
  const dots = [];
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
    el("path", {
      d, fill: "none", stroke: c, "stroke-width": s.dashed ? 1.8 : 2.2,
      "stroke-linecap": "round", "stroke-dasharray": s.dashed ? "5 4" : "none", opacity: s.dashed ? 0.85 : 1
    }, base);
    if (!s.dashed) dots.push({ color: c, name: s.name, pts });
  });

  /* interaction: crosshair + tooltip */
  const cross = el("line", { class: "finchart__crosshair", x1: 0, y1: padT, x2: 0, y2: padT + ih, opacity: 0 }, svg);
  const marker = el("g", { opacity: 0 }, svg);
  const overlay = el("rect", { x: padL, y: padT, width: iw, height: ih, fill: "transparent", class: "finchart__hit" }, svg);
  overlay.addEventListener("mousemove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (W / rect.width);
    let i = Math.round(((mx - padL) / iw) * (labels.length - 1));
    i = Math.max(0, Math.min(labels.length - 1, i));
    const x = X(i);
    cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("opacity", 1);
    marker.innerHTML = "";
    const rows = series.map((s) => {
      const pts = s.points || [];
      if (pts.length <= i) return "";
      const c = seriesColor(s, series.indexOf(s));
      el("circle", { cx: X(i), cy: Y(pts[i]), r: 3.4, fill: c, stroke: "#fff", "stroke-width": 1.2 }, marker);
      return `<span class="finchart__tip-row"><i style="background:${c}"></i>${s.name}<b>${money(pts[i], currencyCode)}</b></span>`;
    }).join("");
    marker.setAttribute("opacity", 1);
    tip.show(`<span class="finchart__tip-title">${labels[i]}</span>${rows}`, x, Y(Math.max.apply(null, series.map((s) => (s.points && s.points[i] != null ? s.points[i] : -Infinity)))));
  });
  overlay.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); marker.setAttribute("opacity", 0); tip.hide(); });
}

/* ============================= DONUT ============================= */
function pt(cx, cy, r, ang) { return { x: cx + r * Math.sin(ang), y: cy - r * Math.cos(ang) }; }
function ringPath(cx, cy, rOut, rIn, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const s = pt(cx, cy, rOut, a0), e = pt(cx, cy, rOut, a1);
  const si = pt(cx, cy, rIn, a0), ei = pt(cx, cy, rIn, a1);
  return `M ${s.x} ${s.y} A ${rOut} ${rOut} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${rIn} ${rIn} 0 ${large} 0 ${si.x} ${si.y} Z`;
}

function renderDonut(svg, model, geom, curSymbol, currencyCode, tip, holder) {
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
    const path = a1 - a0 >= Math.PI * 2 * 0.999 ? null : ringPath(cx, cy, rOut, rIn, a0, a1);
    const node = path === null
      ? el("circle", { cx, cy, r: rOut, fill: s.color }, g)
      : el("path", { d: path, fill: s.color, class: "finchart__seg" }, g);
    node.addEventListener("mousemove", (ev) => {
      const rect = svg.getBoundingClientRect();
      tip.show(`<span class="finchart__tip-title">${s.name}</span><span class="finchart__tip-row"><b>${money(s.value, currencyCode)}</b> &middot; ${(frac * 100).toFixed(1)}%</span>`, ev.clientX - rect.left, ev.clientY - rect.top);
    });
    node.addEventListener("mouseleave", () => tip.hide());
  });
  const label = el("text", { x: cx, y: cy - 1, "text-anchor": "middle", class: "finchart__donut-total" }, svg);
  label.textContent = curSymbol + fmtAxis(total, currencyCode);
  const cap = el("text", { x: cx, y: cy + 18, "text-anchor": "middle", class: "finchart__donut-cap" }, svg);
  cap.textContent = "total";
}

/* ============================= BARS ============================= */
function renderBars(svg, model, geom, currencyCode, tip, holder) {
  const items = model.data.items || [];
  if (!items.length) return;
  const W = geom.width, H = geom.height;
  const padL = 62, padR = 18, padT = 14, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  let lo = 0, hi = 0;
  items.forEach((it) => {
    const v = it.balance != null && it.interest == null && it.principal == null
      ? it.balance
      : (it.principal || 0) + (it.interest || 0);
    if (v > hi) hi = v;
    if ((it.principal || 0) < lo) lo = it.principal || 0;
  });
  if (hi === 0) hi = 1;
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

  const singleVal = items.every((it) => it.interest == null && it.principal == null && it.balance != null);
  items.forEach((it, i) => {
    const cx = padL + slot * i + slot / 2;
    const x = cx - barW / 2;
    const base = it.color || "#3b82f6";
    if (singleVal) {
      const v = it.balance || 0;
      const yTop = v >= 0 ? Y(v) : zeroY;
      const yBot = v >= 0 ? zeroY : Y(v);
      const rect = el("rect", { x, y: yTop, width: barW, height: Math.max(0.5, yBot - yTop), fill: base, rx: 3, class: "finchart__bar" }, svg);
      rect.addEventListener("mousemove", (ev) => {
        const r = svg.getBoundingClientRect();
        tip.show(`<span class="finchart__tip-title">${it.label || it.year}</span><span class="finchart__tip-row"><b>${money(v, currencyCode)}</b></span>`, ev.clientX - r.left, ev.clientY - r.top);
      });
      rect.addEventListener("mouseleave", () => tip.hide());
    } else {
      const principal = it.principal || 0;
      const interest = it.interest || 0;
      const colorInt = it.color ? base : "#ef4444";
      let rectP = null, rectI = null;
      if (principal !== 0) {
        const pTop = principal > 0 ? Math.max(zeroY, Y(principal)) : zeroY;
        const pBot = principal > 0 ? zeroY : Math.min(zeroY, Y(principal));
        rectP = el("rect", { x, y: pTop, width: barW, height: Math.max(0.5, pBot - pTop), fill: base, rx: 3, class: "finchart__bar" }, svg);
      }
      if (interest > 0) {
        const y1 = Y(principal), y2 = Y(principal + interest);
        rectI = el("rect", { x, y: y2, width: barW, height: Math.max(0.5, y1 - y2), fill: colorInt, rx: 3, class: "finchart__bar" }, svg);
      }
      [rectP, rectI].forEach((rect) => {
        if (!rect) return;
        rect.addEventListener("mousemove", (ev) => {
          const r = svg.getBoundingClientRect();
          tip.show(`<span class="finchart__tip-title">${it.label || it.year}</span>` +
            `<span class="finchart__tip-row"><i style="background:${base}"></i>Principal<b>${money(principal, currencyCode)}</b></span>` +
            `<span class="finchart__tip-row"><i style="background:${colorInt}"></i>Interest<b>${money(interest, currencyCode)}</b></span>` +
            `<span class="finchart__tip-row">Total<b>${money(principal + interest, currencyCode)}</b></span>`,
            ev.clientX - r.left, ev.clientY - r.top);
        });
        rect.addEventListener("mouseleave", () => tip.hide());
      });
    }
    const lbl = el("text", { x: cx, y: H - 14, "text-anchor": "middle", class: "finchart__tick finchart__tick--x" }, svg);
    lbl.textContent = String(it.label || it.year || "").length > 14 ? String(it.label || it.year || "").slice(0, 13) + "\u2026" : (it.label || it.year);
  });
}

/* ============================= HBAR ============================= */
function renderHBar(svg, model, geom, currencyCode, tip, holder) {
  const items = model.data.items || [];
  if (!items.length) return;
  const W = geom.width, H = geom.height;
  const padL = Math.min(130, Math.max(90, W * 0.28)), padR = 74, padT = 10, padB = 10;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max.apply(null, items.map((it) => Math.abs(it.value) || 0)) || 1;
  const rowH = ih / items.length;
  const barH = Math.min(26, rowH * 0.62);
  items.forEach((it, i) => {
    const y = padT + i * rowH + (rowH - barH) / 2;
    const w = Math.max(1, (Math.abs(it.value) / max) * iw);
    const c = it.color || "#3b82f6";
    const lbl = el("text", { x: padL - 10, y: y + barH / 2 + 4, "text-anchor": "end", class: "finchart__hbarlabel" }, svg);
    lbl.textContent = String(it.label).length > 20 ? String(it.label).slice(0, 19) + "\u2026" : it.label;
    el("rect", { x: padL, y, width: iw, height: barH, rx: 5, class: "finchart__hbartrack" }, svg);
    const bar = el("rect", { x: padL, y, width: w, height: barH, rx: 5, fill: c, class: "finchart__hbar" }, svg);
    const val = el("text", { x: padL + w + 8, y: y + barH / 2 + 4, "text-anchor": "start", class: "finchart__hbarval" }, svg);
    val.textContent = it.display || money(it.value, currencyCode);
    bar.addEventListener("mousemove", (ev) => {
      const r = svg.getBoundingClientRect();
      tip.show(`<span class="finchart__tip-title">${it.label}</span><span class="finchart__tip-row"><b>${it.display || money(it.value, currencyCode)}</b></span>${it.secondary ? `<span class="finchart__tip-row">${it.secondary}</span>` : ""}`, ev.clientX - r.left, ev.clientY - r.top);
    });
    bar.addEventListener("mouseleave", () => tip.hide());
  });
}

/* ============================= WATERFALL ============================= */
function renderWaterfall(svg, model, geom, currencyCode, tip, holder) {
  const items = model.data.items || [];
  if (!items.length) return;
  const W = geom.width, H = geom.height;
  const padL = 62, padR = 18, padT = 14, padB = 44;
  const iw = W - padL - padR, ih = H - padT - padB;
  let cum = 0;
  const steps = items.map((it) => {
    const type = it.type || (it.value >= 0 ? "delta" : "delta");
    if (type === "start" || type === "total") {
      const from = 0, to = it.value;
      cum = it.value;
      return { ...it, from, to, type };
    }
    const from = cum, to = cum + it.value;
    cum = to;
    return { ...it, from, to, type: "delta" };
  });
  const lo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)));
  const hi = Math.max(0, ...steps.map((s) => Math.max(s.from, s.to)));
  const [t0, t1, ticks] = niceTicks(lo, hi, 4);
  const Y = (v) => padT + ih - ((v - t0) / (t1 - t0)) * ih;
  const slot = iw / steps.length;
  const barW = Math.min(58, Math.max(14, slot * 0.6));

  const grid = el("g", { class: "finchart__grid" }, svg);
  ticks.forEach((t) => {
    const y = Y(t);
    el("line", { x1: padL, y1: y, x2: W - padR, y2: y }, grid);
    el("text", { x: padL - 8, y: y + 4, "text-anchor": "end", class: "finchart__tick" }, grid).textContent = fmtAxis(t, currencyCode);
  });
  el("line", { x1: padL, y1: Y(0), x2: W - padR, y2: Y(0), class: "finchart__axis" }, svg);

  steps.forEach((s, i) => {
    const cx = padL + slot * i + slot / 2;
    const x = cx - barW / 2;
    const yTop = Math.min(Y(s.from), Y(s.to));
    const height = Math.max(1, Math.abs(Y(s.to) - Y(s.from)));
    let c = "#3b82f6";
    if (s.type === "delta") c = s.value >= 0 ? "#16a34a" : "#ef4444";
    if (s.type === "start") c = "#64748b";
    if (s.type === "total") c = s.color || "#6366f1";
    const rect = el("rect", { x, y: yTop, width: barW, height, rx: 3, fill: s.color || c, class: "finchart__bar" }, svg);
    if (i < steps.length - 1) {
      const connY = Y(s.to);
      el("line", { x1: x + barW, y1: connY, x2: x + slot, y2: connY, class: "finchart__waterfall-link" }, svg);
    }
    rect.addEventListener("mousemove", (ev) => {
      const r = svg.getBoundingClientRect();
      const sign = s.type === "delta" && s.value > 0 ? "+" : "";
      tip.show(`<span class="finchart__tip-title">${s.label}</span><span class="finchart__tip-row"><b>${sign}${money(s.value, currencyCode)}</b></span>`, ev.clientX - r.left, ev.clientY - r.top);
    });
    rect.addEventListener("mouseleave", () => tip.hide());
    const lbl = el("text", { x: cx, y: H - 24, "text-anchor": "middle", class: "finchart__tick finchart__tick--x" }, svg);
    lbl.textContent = String(s.label).length > 12 ? String(s.label).slice(0, 11) + "\u2026" : s.label;
  });
}

/* ============================= GAUGE ============================= */
function renderGauge(svg, model, geom, currencyCode, tip, holder) {
  const d = model.data || {};
  const kind = d.kind || "num";
  const value = Number(d.value) || 0;
  const max = Number(d.max) || Math.max(value * 2, 1);
  const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const W = geom.width, H = geom.height;
  const cx = W / 2, cy = H * 0.78;
  const r = Math.min(W / 2 - 30, H * 0.66);
  const color = d.color || (frac >= 0.66 ? "#16a34a" : frac >= 0.33 ? "#f59e0b" : "#ef4444");

  const arc = (from, to, stroke, width, cls) => {
    const a0 = Math.PI * (1 - from), a1 = Math.PI * (1 - to);
    const p0 = { x: cx + r * Math.cos(a0), y: cy - r * Math.sin(a0) };
    const p1 = { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) };
    return el("path", {
      d: `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`,
      fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round", class: cls
    }, svg);
  };
  arc(0, 1, "var(--grid-line)", 16, "finchart__gauge-track");
  if (frac > 0.001) arc(0, frac, color, 16, "finchart__gauge-val");

  const shown = kind === "pct" ? fmtPct(value, 2) : kind === "ratio" ? `1 : ${fmtNum(value, 2)}` : money(value, currencyCode);
  const t = el("text", { x: cx, y: cy - 6, "text-anchor": "middle", class: "finchart__gauge-value" }, svg);
  t.textContent = shown;
  const lab = el("text", { x: cx, y: cy + 16, "text-anchor": "middle", class: "finchart__gauge-label" }, svg);
  lab.textContent = d.label || "";
  if (d.caption) {
    const cap = el("text", { x: cx, y: cy + 34, "text-anchor": "middle", class: "finchart__gauge-cap" }, svg);
    cap.textContent = d.caption;
  }
}

/* ========================== PUBLIC ========================== */
export function renderChart(model, container, currencyCode = "INR") {
  if (!model) return null;
  const symbol = curPrefix(currencyCode);
  if (model.type === "area" || model.type === "line") {
    const series = model.data.series || [];
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom, tip, holder) => renderLineLike(svg, model, geom, currencyCode, tip, holder, model.type === "area"),
      legend: series.map((s, i) => ({ name: s.name, color: seriesColor(s, i), dashed: s.dashed }))
    });
  }
  if (model.type === "donut") {
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom, tip, holder) => renderDonut(svg, model, geom, symbol, currencyCode, tip, holder),
      legend: (model.data.segments || []).map((s) => ({ name: `${s.name}`, color: s.color }))
    });
  }
  if (model.type === "bars") {
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom, tip, holder) => renderBars(svg, model, geom, currencyCode, tip, holder)
    });
  }
  if (model.type === "hbar") {
    return chartFrame(model, container, {
      height: Math.max(140, (model.data.items || []).length * 44 + 24),
      accessor: (svg, geom, tip, holder) => renderHBar(svg, model, geom, currencyCode, tip, holder),
      legend: (model.data.items || []).some((it) => it.color)
        ? (model.data.items || []).map((it) => ({ name: it.label, color: it.color }))
        : null
    });
  }
  if (model.type === "waterfall") {
    return chartFrame(model, container, {
      height: 300,
      accessor: (svg, geom, tip, holder) => renderWaterfall(svg, model, geom, currencyCode, tip, holder)
    });
  }
  if (model.type === "gauge") {
    return chartFrame(model, container, {
      height: 220,
      accessor: (svg, geom, tip, holder) => renderGauge(svg, model, geom, currencyCode, tip, holder)
    });
  }
  return null;
}
