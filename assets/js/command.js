/*
  FinHub command palette (instant search)
  ---------------------------------------
  A dependency-free, keyboard-first search over every calculator, planner,
  answer page and trust page. The index is emitted by build.js as
  window.FINHUB_INDEX so results are instant and work offline.

  Keyboard:  Cmd/Ctrl+K or "/" to open, arrows to move, Enter to open,
  Esc to close. Degrades to nothing if the index or markup is absent.
*/

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function highlight(text, q) {
  const safe = esc(text);
  const tokens = q.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return safe;
  try {
    return safe.replace(new RegExp(`(${tokens.join("|")})`, "ig"), "<mark>$1</mark>");
  } catch {
    return safe;
  }
}

export function initCommand() {
  const root = document.querySelector("[data-cmdk]");
  const index = Array.isArray(window.FINHUB_INDEX) ? window.FINHUB_INDEX : [];
  if (!root || !index.length) return;

  const input = root.querySelector("[data-cmdk-input]");
  const list = root.querySelector("[data-cmdk-list]");
  const escBtn = root.querySelector(".cmdk__esc");
  if (!input || !list) return;

  const data = index.map((it) => ({
    ...it,
    t: it.t || it.s,
    g: it.g || "",
    d: it.d || "",
    k: it.k || "Page",
    hay: `${it.t} ${it.g} ${it.d} ${it.w || ""}`.toLowerCase(),
    wl: String(it.w || "").toLowerCase()
  }));

  let results = [];
  let active = 0;
  let isOpen = false;
  let lastFocus = null;

  function score(item, tokens) {
    const t = item.t.toLowerCase();
    let s = 0;
    for (const tok of tokens) {
      if (!item.hay.includes(tok)) return 0;
      if (t.startsWith(tok)) s += 6;
      else if (t.includes(tok)) s += 4;
      else if (item.wl.includes(tok)) s += 3;
      else s += 1;
    }
    if (item.k === "Calculator") s += 0.5;
    return s;
  }

  function query(q) {
    const ql = q.trim().toLowerCase();
    if (!ql) return data.slice(0, 8);
    const tokens = ql.split(/\s+/).filter(Boolean);
    return data
      .map((it) => ({ it, s: score(it, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.it.t.length - b.it.t.length)
      .slice(0, 30)
      .map((x) => x.it);
  }

  function render(q) {
    results = query(q);
    active = 0;
    if (!results.length) {
      list.innerHTML = `<li class="cmdk__empty" role="option" aria-disabled="true">No matches for \u201c${esc(q)}\u201d</li>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    list.innerHTML = results
      .map((it, i) => `
      <li class="cmdk__item${i === 0 ? " is-active" : ""}" role="option" id="cmdk-opt-${i}" aria-selected="${i === 0}" data-cmdk-item data-href="${esc(it.s)}">
        <span class="cmdk__item-main">
          <span class="cmdk__item-title">${highlight(it.t, q)}</span>
          <span class="cmdk__item-desc">${esc(it.g)}${it.d ? " &middot; " + esc(it.d) : ""}</span>
        </span>
        <span class="cmdk__item-kind">${esc(it.k)}</span>
      </li>`)
      .join("");
    input.setAttribute("aria-activedescendant", "cmdk-opt-0");
  }

  function setActive(n) {
    if (!results.length) return;
    active = (n + results.length) % results.length;
    const items = list.querySelectorAll("[data-cmdk-item]");
    items.forEach((el, i) => {
      const on = i === active;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", String(on));
    });
    const cur = items[active];
    if (cur) cur.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", `cmdk-opt-${active}`);
  }

  function choose() {
    const it = results[active];
    if (it) location.href = it.s;
  }

  function show() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("cmdk-open");
    input.value = "";
    render("");
    requestAnimationFrame(() => input.focus());
  }

  function hide() {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    document.documentElement.classList.remove("cmdk-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  document.querySelectorAll("[data-cmdk-open]").forEach((b) => {
    b.addEventListener("click", (e) => { e.preventDefault(); show(); });
  });
  root.querySelectorAll("[data-cmdk-close]").forEach((b) => b.addEventListener("click", hide));

  input.addEventListener("input", () => render(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(results.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(); }
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest("[data-cmdk-item]");
    if (li) location.href = li.getAttribute("data-href");
  });
  list.addEventListener("mousemove", (e) => {
    const li = e.target.closest("[data-cmdk-item]");
    if (!li) return;
    const items = [...list.querySelectorAll("[data-cmdk-item]")];
    const i = items.indexOf(li);
    if (i >= 0 && i !== active) setActive(i);
  });

  root.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusables = [input, escBtn].filter(Boolean);
    if (!focusables.length) return;
    e.preventDefault();
    const i = focusables.indexOf(document.activeElement);
    const next = (i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
    focusables[next].focus();
  });

  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === "k") {
      e.preventDefault();
      isOpen ? hide() : show();
      return;
    }
    if (key === "escape" && isOpen) {
      e.preventDefault();
      hide();
      return;
    }
    if (isOpen) return;
    const el = document.activeElement;
    const tag = el ? el.tagName : "";
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (el && el.isContentEditable);
    if (key === "/" && !typing) {
      e.preventDefault();
      show();
    }
  });
}
