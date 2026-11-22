// The documentation site (scripts/docs.mjs, site/): it builds, documents every class and input,
// has no broken internal links, loads without errors, fits a phone, and the customizer works.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launch, root } from "./helpers.mjs";

const out = mkdtempSync(path.join(tmpdir(), "peak-docs-"));
execFileSync(process.execPath, [path.join(root, "scripts", "docs.mjs"), "--out", out]);
const pages = readdirSync(out).filter((f) => f.endsWith(".html"));
const html = Object.fromEntries(pages.map((f) => [f, readFileSync(path.join(out, f), "utf8")]));
const all = Object.values(html).join("\n");
const url = (file) => pathToFileURL(path.join(out, file)).href;

let browser;
before(async () => {
  browser = await launch();
});
after(() => {
  rmSync(out, { recursive: true, force: true });
  return browser?.close();
});

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(path.join(dir, e.name)) : e.name.endsWith(".css") ? [path.join(dir, e.name)] : [],
  );
}

const mentioned = (name) => new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(all);

test("every Peak and site class in src is documented", () => {
  const source = cssFiles(path.join(root, "src"))
    .map((f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))
    .join("\n");
  const classes = new Set(source.match(/\.(?:peak|site)-[a-z0-9-]+/g).map((c) => c.slice(1)));
  classes.add("nav-sticky");
  const missing = [...classes].filter((c) => !mentioned(c));
  assert.deepEqual(missing, [], `undocumented classes: ${missing.join(", ")}`);
});

test("every input in tokens.json and every component knob is documented", () => {
  const tokens = JSON.parse(readFileSync(path.join(root, "tokens.json"), "utf8"));
  const inputs = tokens.groups.flatMap((g) => Object.keys(g.tokens)).map((n) => `--peak-${n}`);
  const source = cssFiles(path.join(root, "src"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  // Read with a fallback but declared nowhere: a knob set per element
  const declared = new Set(source.match(/--peak-[a-z0-9-]+(?=\s*:)/g));
  const knobs = [...new Set(source.match(/var\(--peak-[a-z0-9-]+(?=,)/g).map((v) => v.slice(4)))].filter((k) => !declared.has(k));
  const missing = [...inputs, ...knobs].filter((t) => !mentioned(t));
  assert.deepEqual(missing, [], `undocumented: ${missing.join(", ")}`);
});

test("internal links point to pages and anchors that exist", () => {
  const ids = Object.fromEntries(pages.map((f) => [f, new Set([...html[f].matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
  const broken = [];
  for (const file of pages) {
    for (const [, href] of html[file].matchAll(/\shref="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [target, hash] = href.split("#");
      const page = target || file;
      if (target && !existsSync(path.join(out, target))) broken.push(`${file}: ${href}`);
      else if (hash && page.endsWith(".html") && !ids[page]?.has(hash)) broken.push(`${file}: ${href}`);
    }
    for (const [, src] of html[file].matchAll(/\ssrc="([^"]+)"/g)) {
      if (!/^https?:/.test(src) && !existsSync(path.join(out, src))) broken.push(`${file}: src ${src}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("pages load without errors and fit a phone screen", async () => {
  const problems = [];
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on("console", (m) => m.type() === "error" && problems.push(`${width} console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`${width} error: ${e.message}`));
    for (const file of pages) {
      await page.goto(url(file));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${width} ${file}: ${overflow}px sideways scroll`);
      const styled = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--peak-hue").trim());
      if (!styled) problems.push(`${width} ${file}: Peak's stylesheet didn't load`);
    }
    await page.close();
  }
  assert.deepEqual(problems, []);
});

test("page list: a sidebar on wide screens, a drawer on phones; the current page marked", async () => {
  const wide = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await wide.goto(url("cards.html"));
  assert.equal(await wide.isVisible(".docs-sidebar"), true);
  assert.equal(await wide.isVisible(".docs-menu-button"), false);
  assert.equal(await wide.textContent('.docs-sidebar [aria-current="page"]'), "Cards");
  await wide.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(url("cards.html"));
  assert.equal(await phone.isVisible(".docs-sidebar"), false);
  await phone.click(".docs-menu-button");
  await phone.waitForTimeout(400);
  const drawer = await phone.evaluate(() => {
    const r = document.querySelector("#docs-drawer > article").getBoundingClientRect();
    return { open: document.getElementById("docs-drawer").open, left: r.left, height: r.height };
  });
  assert.ok(drawer.open && Math.abs(drawer.left) < 1 && Math.abs(drawer.height - 844) < 1, JSON.stringify(drawer));
  await phone.close();
});

test("the customizer writes CSS, themes every page, and resets", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url("customize.html"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  assert.match(await page.textContent("#customizer-css"), /defaults/);

  await page.locator("#c-hue").fill("30");
  await page.click('summary:text-is("Spacing and shape")');
  await page.locator("#c-radius").fill("1");
  const css = await page.textContent("#customizer-css");
  assert.match(css, /--peak-hue: 30;/);
  assert.match(css, /--peak-radius: 1rem;/);
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--peak-hue")), "30");

  // An unset input only applies once its checkbox is on
  await page.click('summary:text-is("Color")');
  await page.locator("#c-accent-color").evaluate((el) => {
    el.value = "#ff0000";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.doesNotMatch(await page.textContent("#customizer-css"), /accent-color/);
  await page.check('[data-enables="c-accent-color"]');
  assert.match(await page.textContent("#customizer-css"), /--peak-accent-color: #ff0000;/);

  // Saved for the other pages
  await page.goto(url("cards.html"));
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--peak-hue").trim()), "30");
  assert.equal(await page.isVisible(".docs-custom-theme"), true);

  await page.goto(url("customize.html"));
  assert.equal(await page.inputValue("#c-hue"), "30", "controls restored");
  await page.click("#customizer-reset");
  assert.match(await page.textContent("#customizer-css"), /defaults/);
  await page.goto(url("cards.html"));
  assert.equal(await page.isVisible(".docs-custom-theme"), false);
  assert.equal(await page.evaluate(() => document.documentElement.style.length), 0);
  await page.close();
});

test("the scheme switch turns the docs dark; examples render live", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  await page.goto(url("badges.html"));
  await page.evaluate(() => localStorage.clear());
  await page.selectOption("header select.peak-scheme", "dark");
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).colorScheme), "dark");
  await page.selectOption("header select.peak-scheme", "");
  // A preview holds the real markup, and its listing the same markup as text
  const example = await page.evaluate(() => {
    const ex = document.querySelector(".docs-example");
    return { badges: ex.querySelectorAll(".docs-preview .peak-badge").length, code: ex.querySelector("code").textContent };
  });
  assert.ok(example.badges > 0);
  assert.match(example.code, /<span class="peak-badge">Primary<\/span>/);
  await page.close();
});
