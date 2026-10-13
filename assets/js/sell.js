/*
  FinHub sales page interaction
  -----------------------------
  A small, dependency-free estimator for the white-label offer. It prices the
  hours a shared platform can give back, at the buyer's own assumptions.

  Everything is illustrative and computed in the browser - nothing is sent
  anywhere and no figure is presented as a guarantee.
*/

export function initSell() {
  const root = document.querySelector("[data-sell-roi]");
  if (!root) return;
  const q = (sel) => root.querySelector(sel);
  const inputs = {
    clients: q('[data-roi="clients"]'),
    hours: q('[data-roi="hours"]'),
    value: q('[data-roi="value"]'),
    automation: q('[data-roi="automation"]'),
    cost: q('[data-roi="cost"]')
  };
  if (!inputs.clients) return;
  const outs = {
    clients: q('[data-roi-out="clients"]'),
    hours: q('[data-roi-out="hours"]'),
    value: q('[data-roi-out="value"]'),
    automation: q('[data-roi-out="automation"]'),
    cost: q('[data-roi-out="cost"]')
  };
  const res = {
    hours: q('[data-roi-result="hours"]'),
    value: q('[data-roi-result="value"]'),
    net: q('[data-roi-result="net"]'),
    payback: q('[data-roi-result="payback"]')
  };

  const inr = (n) => "\u20B9" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
  const num = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: Math.abs(n) % 1 ? 2 : 0 }).format(n);

  function calc() {
    const C = Number(inputs.clients.value) || 0;
    const H = Number(inputs.hours.value) || 0;
    const V = Number(inputs.value.value) || 0;
    const A = (Number(inputs.automation.value) || 0) / 100;
    const M = Number(inputs.cost.value) || 0;

    const hoursSaved = C * H * A;
    const timeValue = hoursSaved * V;
    const net = timeValue - M;
    const perClient = H * A * V;
    const payback = perClient > 0 ? Math.max(1, Math.ceil(M / perClient)) : 0;

    if (outs.clients) outs.clients.textContent = num(C);
    if (outs.hours) outs.hours.textContent = num(H);
    if (outs.value) outs.value.textContent = inr(V);
    if (outs.automation) outs.automation.textContent = Math.round(A * 100) + "%";
    if (outs.cost) outs.cost.textContent = inr(M);
    if (res.hours) res.hours.textContent = num(Math.round(hoursSaved * 10) / 10);
    if (res.value) res.value.textContent = inr(timeValue);
    if (res.net) {
      res.net.textContent = (net < 0 ? "\u2212" : "") + inr(Math.abs(net));
      res.net.classList.toggle("is-negative", net < 0);
    }
    if (res.payback) res.payback.textContent = payback || "-";
  }

  Object.values(inputs).forEach((el) => el && el.addEventListener("input", calc));
  calc();

  const rail = document.querySelector("[data-sell-rail]");
  if (rail) {
    const onScroll = () => rail.classList.toggle("is-visible", window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
}
