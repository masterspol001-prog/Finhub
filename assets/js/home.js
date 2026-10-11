/*
  FinHub editorial homepage interactions
  --------------------------------------
  Pure, dependency-free enhancement for the redesigned homepage:
   - translucent header that solidifies on scroll + a small menu popover
   - cursor-following ambient glow and a subtle 3D tilt on the hero instrument
   - scroll-reveal (IntersectionObserver), animated number counters
   - a live compounding chart driven by three sliders

  Everything degrades gracefully: with JavaScript off (or reduced-motion on)
  the server-rendered homepage is complete and readable.
*/
import { computeCalc, fmtMoney, getCurrency } from "./engine.js";

const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rAF = (fn) => window.requestAnimationFrame(fn);

/* ---------------- header ---------------- */
export function initHeader() {
  const header = document.querySelector("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  const more = document.querySelector("[data-nav-more]");
  const btn = document.querySelector("[data-nav-menu]");
  const panel = document.querySelector("[data-nav-menu-panel]");
  if (!more || !btn || !panel) return;
  const close = () => { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  const open = () => { panel.hidden = false; btn.setAttribute("aria-expanded", "true"); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.hidden ? open() : close(); });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  document.addEventListener("click", (e) => { if (!more.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

/* ---------------- helpers ---------------- */
function ptsToPath(points) {
  if (!points.length) return "";
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = ((x0 + x1) / 2).toFixed(1);
    d += ` C ${mx} ${y0.toFixed(1)}, ${mx} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}
function normalize(values, w, h, pad) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const n = values.length - 1 || 1;
  return values.map((v, i) => [(i / n) * w, h - pad - ((v - min) / span) * (h - pad * 2)]);
}
function animateCount(el) {
  const target = Number(el.dataset.count) || 0;
  const prefix = el.dataset.countPrefix || "";
  const dur = 1300;
  const start = performance.now();
  const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = prefix + fmt.format(Math.round(target * eased));
    if (t < 1) rAF(tick);
  };
  el.dataset.countDone = "1";
  rAF(tick);
}

/* ---------------- scroll reveal + counters ---------------- */
function initReveal() {
  if (reduceMotion() || !("IntersectionObserver" in window)) return;
  const els = document.querySelectorAll([
    ".hero-editorial__inner > *",
    ".intents .intent-tile",
    ".ask > *",
    ".picture-section > *",
    ".story .story__item",
    ".future__inner > *",
    ".compound__inner > *",
    ".answers__feature",
    ".answers__item",
    ".tools-strip .calc-card",
    ".dir-group",
    ".recent .container > *"
  ].join(","));
  els.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const delay = Math.min(6, i) * 60;
      window.setTimeout(() => el.classList.add("is-visible"), delay);
      io.unobserve(el);
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => io.observe(el));
}

function initCounters() {
  const counts = Array.from(document.querySelectorAll("[data-count]"));
  if (!counts.length) return;
  if (reduceMotion() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCount(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.4 });
  counts.forEach((el) => io.observe(el));
}

/* ---------------- hero ambience ---------------- */
function initHeroMotion() {
  if (reduceMotion()) return;
  const hero = document.querySelector(".hero-editorial");
  const instrument = document.querySelector("[data-instrument]");
  const ambient = document.querySelector("[data-ambient]");
  const line = document.querySelector("[data-hero-line]");
  const dot = document.querySelector("[data-hero-dot]");
  if (!hero) return;
  let raf = 0;
  hero.addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = rAF(() => {
      raf = 0;
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      if (ambient) {
        ambient.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        ambient.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      }
      if (instrument) {
        instrument.style.setProperty("--tilt-x", `${(-ny * 5).toFixed(2)}deg`);
        instrument.style.setProperty("--tilt-y", `${(nx * 7).toFixed(2)}deg`);
        instrument.style.setProperty("--glare-x", `${(50 + nx * 60).toFixed(1)}%`);
      }
      if (line) line.style.transform = `translateY(${(ny * -6).toFixed(2)}px)`;
      if (dot) dot.style.transform = `translateY(${(ny * -6).toFixed(2)}px)`;
    });
  });
  hero.addEventListener("pointerleave", () => {
    if (instrument) {
      instrument.style.setProperty("--tilt-x", "0deg");
      instrument.style.setProperty("--tilt-y", "0deg");
    }
    if (line) line.style.transform = "";
    if (dot) dot.style.transform = "";
  });
}

/* ---------------- live compounding chart ---------------- */
function initCompound() {
  const monthly = document.querySelector("[data-comp-monthly]");
  const years = document.querySelector("[data-comp-years]");
  const rate = document.querySelector("[data-comp-rate]");
  const line = document.querySelector("[data-comp-line]");
  const area = document.querySelector("[data-comp-area]");
  if (!monthly || !years || !rate || !line || !area) return;
  const W = 560, H = 320;
  const money = (v) => fmtMoney(v, getCurrency());
  const outMonthly = document.querySelector("[data-comp-monthly-out]");
  const outYears = document.querySelector("[data-comp-years-out]");
  const outRate = document.querySelector("[data-comp-rate-out]");
  const elInvested = document.querySelector("[data-comp-invested]");
  const elGrowth = document.querySelector("[data-comp-growth]");
  const elFinal = document.querySelector("[data-comp-final]");

  const recompute = () => {
    const m = Number(monthly.value) || 0;
    const y = Math.max(1, Math.round(Number(years.value) || 1));
    const r = Number(rate.value) || 0;
    if (outMonthly) outMonthly.textContent = money(m);
    if (outYears) outYears.textContent = `${y}`;
    if (outRate) outRate.textContent = `${r}%`;
    const series = [];
    for (let i = 0; i <= y; i++) {
      series.push(computeCalc("sip", { monthly: m, rate: r, years: i, stepUp: 0 }).head.value);
    }
    const pts = normalize(series, W, H, 20);
    area.setAttribute("d", `${ptsToPath(pts)} L ${W} ${H} L 0 ${H} Z`);
    line.setAttribute("d", ptsToPath(pts));
    const invested = m * y * 12;
    const final = series[series.length - 1] || 0;
    if (elInvested) elInvested.textContent = money(invested);
    if (elGrowth) elGrowth.textContent = money(Math.max(0, final - invested));
    if (elFinal) elFinal.textContent = money(final);
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = rAF(() => { raf = 0; recompute(); }); };
  [monthly, years, rate].forEach((el) => el.addEventListener("input", schedule));
  recompute();
}

export function initEditorial() {
  initReveal();
  initCounters();
  initHeroMotion();
  initCompound();
}
