import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CALC_LIST, TOOLS } from "../assets/js/engine.js";
import { PAGES, CONTENT } from "../assets/js/content.js";

const root = fileURLToPath(new URL("..", import.meta.url));
execFileSync(process.execPath, ["build.js"], { cwd: root, stdio: "ignore" });

const read = (p) => readFileSync(root + "dist/" + p, "utf8");

test("build emits the core routes", () => {
  ["index.html", "sip/index.html", "dashboard/index.html", "money-plan/index.html", "compare-decisions/index.html", "monthly-review/index.html", "plan-report/index.html", "my-plans/index.html", "sell/index.html",
    "about/index.html", "trust/index.html", "support/index.html", "how-it-works/index.html",
    "privacy/index.html", "terms/index.html", "adviser-roi/index.html", "assets/sample/sample-client-report.csv"]
    .forEach((p) => assert.ok(existsSync(root + "dist/" + p), "missing " + p));
});

test("every calculator has content, a formula and a calculation-trace mount", () => {
  for (const c of CALC_LIST) {
    const cc = CONTENT[c.slug];
    assert.ok(cc && cc.formula && cc.formula.trim(), `${c.slug} missing formula content`);
    const html = read(`${c.slug}/index.html`);
    assert.match(html, /data-app-work/, `${c.slug} missing data-app-work mount`);
    assert.match(html, /The formula behind it/, `${c.slug} missing formula section`);
  }
});

test("every decision tool has a calculation-trace mount", () => {
  for (const t of TOOLS) {
    const html = read(`${t.slug}/index.html`);
    assert.match(html, /data-tool-work/, `${t.slug} missing data-tool-work mount`);
  }
});

test("sitemap lists every route exactly once", () => {
  const xml = read("sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, "duplicate urls in sitemap");
  for (const slug of [null, ...CALC_LIST.map((c) => c.slug), ...TOOLS.map((t) => t.slug), ...PAGES.map((p) => p.slug)]) {
    const path = slug ? `/${slug}/` : "/";
    assert.ok(locs.some((u) => u.endsWith(path)), `sitemap missing ${path}`);
  }
});

test("trust page covers data, calculations, security and deletion", () => {
  const html = read("trust/index.html");
  ["What data we process", "How calculations work", "Security practices", "deleting your data", "Refund"]
    .forEach((t) => assert.match(html, new RegExp(t, "i")));
});

test("lead capture and client config ship on the right pages", () => {
  assert.match(read("index.html"), /data-lead-form/);
  assert.match(read("index.html"), /FINHUB_LEADS/);
  assert.match(read("sell/index.html"), /data-lead-form/);
});
