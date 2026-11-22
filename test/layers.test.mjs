// Sub-layers: blades, then peak.tokens < peak.base < peak.layout <
// peak.components < peak.utilities. Lightning CSS drops the @layer order statement from bundles
// (PLAN B11), so the order in which layers first appear in each built file is what the browser
// uses; it must match the statement in src/peak.css.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { launch, fixtureUrl, root } from "./helpers.mjs";

const read = (file) => readFileSync(path.join(root, file), "utf8");
const declared = read("src/peak.css")
  .match(/^@layer\s+([^;{]+);/m)[1]
  .split(",")
  .map((s) => s.trim());

const firstAppearance = (css) => [
  ...new Set(
    [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@layer\s+([\w.-]+)\s*[{;]/g)].map((m) => m[1]),
  ),
];

test("src/peak.css declares blades first and Peak's sub-layers after it", () => {
  assert.deepEqual(declared, ["blades", "peak.tokens", "peak.base", "peak.layout", "peak.components", "peak.utilities"]);
});

test("both entries declare the same layer order", () => {
  assert.match(read("src/peak.scoped.css"), new RegExp(`^@layer ${declared.join(", ").replace(/\./g, "\\.")};`, "m"));
});

test("every import in the entries goes into a declared layer", () => {
  for (const entry of ["src/peak.css", "src/peak.scoped.css"]) {
    for (const [, layer] of read(entry).matchAll(/@import\s+"[^"]+"\s+layer\(([^)]+)\)/g)) {
      assert.ok(declared.includes(layer), `${entry}: layer(${layer}) is not in the @layer statement`);
    }
    assert.doesNotMatch(read(entry), /@import\s+"[^"]+"\s*;/, `${entry}: unlayered @import`);
  }
});

for (const file of ["peak.css", "peak.min.css", "peak.scoped.css", "peak.scoped.min.css"]) {
  test(`dist/${file}: layers first appear in the declared order`, () => {
    assert.deepEqual(firstAppearance(read(`dist/${file}`)), declared);
  });
}

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

for (const file of ["peak.css", "peak.scoped.css"]) {
  test(`${file}: later sub-layers win over specificity, unlayered CSS wins over all of Peak`, async () => {
    const page = await browser.newPage();
    await page.goto(fixtureUrl("layers.html"));
    await page.evaluate(async (href) => {
      const link = document.querySelector("link[rel=stylesheet]");
      if (link.getAttribute("href").endsWith(href)) return;
      await new Promise((resolve) => {
        link.onload = resolve;
        link.href = `../../dist/${href}`;
      });
    }, file);
    const get = (id, prop) => page.evaluate(([id, prop]) => getComputedStyle(document.getElementById(id))[prop], [id, prop]);
    assert.equal(await get("layered", "color"), "rgb(0, 0, 1)", "peak.utilities beats peak.components");
    assert.equal(await get("layered", "outlineColor"), "rgb(0, 0, 4)", "peak.tokens beats blades");
    assert.equal(await get("unlayered", "backgroundColor"), "rgb(0, 0, 5)", "unlayered beats peak.*");
    await page.close();
  });
}

// A Stacks template that embeds the global build would read `:(` as a template token
test("the builds contain no `:(` (a Stacks template token)", () => {
  for (const file of ["peak.css", "peak.min.css", "peak.scoped.css", "peak.scoped.min.css"]) {
    const css = readFileSync(path.join(root, "dist", file), "utf8");
    const at = css.indexOf(":(");
    assert.equal(at, -1, `${file}: …${css.slice(at - 40, at + 40)}…`);
  }
});

// What the npm package ships, and what consumers (themes, bundlers) import
test("package: exports point at files that exist, and only dist/ and tokens.json ship", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(pkg.files, ["dist", "tokens.json"]);
  for (const [key, target] of Object.entries(pkg.exports)) {
    if (target.includes("*")) continue;
    assert.ok(readFileSync(path.join(root, target)), `${key} → ${target}`);
  }
  assert.equal(pkg.dependencies, undefined, "no runtime dependencies: the builds bundle Blades");
});
