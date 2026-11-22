// Token and bridge checks: nested themes, scopes, picker, compact, leaks from Pico's palette.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl, colorHelpers } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(colorScheme = "light", { stylesheet } = {}) {
  const page = await browser.newPage({ colorScheme, viewport: { width: 1280, height: 800 } });
  await page.goto(fixtureUrl("tokens.html"));
  if (stylesheet) {
    await page.evaluate(async (href) => {
      const link = document.querySelector("link[rel=stylesheet]");
      await new Promise((resolve) => {
        link.onload = resolve;
        link.href = href;
      });
    }, stylesheet);
  }
  await page.evaluate(colorHelpers);
  return page;
}

// OKLCH lightness of a computed color string, via the browser's own conversion
async function lightness(page, selector, prop = "color") {
  return page.evaluate(
    ([selector, prop]) => {
      const el = document.querySelector(selector);
      const value = getComputedStyle(el)[prop];
      const probe = document.createElement("i");
      probe.style.color = `oklch(from ${value} l 0 0)`;
      el.append(probe);
      const l = parseFloat(getComputedStyle(probe).color.match(/oklch\(([\d.]+)/)[1]);
      probe.remove();
      return l;
    },
    [selector, prop],
  );
}

async function hue(page, selector, prop) {
  return page.evaluate(
    ([selector, prop]) => {
      const el = document.querySelector(selector);
      const probe = document.createElement("i");
      probe.style.color = `oklch(from ${getComputedStyle(el)[prop]} 0.5 0 h)`;
      el.append(probe);
      const h = parseFloat(getComputedStyle(probe).color.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)/)[1]);
      probe.remove();
      return h;
    },
    [selector, prop],
  );
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: root text follows the scheme`, async () => {
    const page = await open(scheme);
    const l = await lightness(page, "#root-text");
    assert.ok(scheme === "light" ? l < 0.3 : l > 0.85, `L=${l}`);
    await page.close();
  });

  test(`${scheme}: nested data-theme="dark" and author color-scheme use dark tokens`, async () => {
    const page = await open(scheme);
    for (const id of ["#nested-dark-text", "#author-scheme-text"]) {
      const l = await lightness(page, id);
      assert.ok(l > 0.85, `${id} L=${l}`);
    }
    // A section doesn't paint a background in Blades; the token itself must be dark there
    const tokenBg = await page.evaluate(() => {
      const s = document.querySelector("#nested-dark");
      return resolveColor("var(--peak-bg)", s);
    });
    assert.ok(tokenBg.r < 60, `nested --peak-bg ${tokenBg.css}`);
    await page.close();
  });

  test(`${scheme}: nested data-theme="light" uses light tokens`, async () => {
    const page = await open(scheme);
    const l = await lightness(page, "#nested-light-text");
    assert.ok(l < 0.3, `L=${l}`);
    await page.close();
  });
}

test("nested themes keep Peak's primary, not Pico blue", async () => {
  const page = await open("light");
  const root = await hue(page, "#root-button", "backgroundColor");
  const nested = await hue(page, "#nested-dark-button", "backgroundColor");
  assert.ok(Math.abs(root - 250) < 3, `root hue ${root}`);
  assert.ok(Math.abs(nested - 250) < 3, `nested hue ${nested}`);
  await page.close();
});

test("data-peak-scope recomputes derived tokens from local inputs", async () => {
  const page = await open("light");
  const h = await hue(page, "#scope-hue-button", "backgroundColor");
  assert.ok(Math.abs(h - 30) < 3, `scoped button hue ${h}`);
  // Blades derives accordion colors from --pico-primary-hover at the root; the bridge redeclares them
  const summary = await page.evaluate(() =>
    resolveColor("var(--pico-accordion-active-summary-color)", document.querySelector("#scope-hue")),
  );
  const summaryHue = await page.evaluate(
    (c) => {
      const p = document.createElement("i");
      p.style.color = `oklch(from ${c} 0.5 0 h)`;
      document.body.append(p);
      return parseFloat(getComputedStyle(p).color.match(/oklch\([\d.]+ [\d.]+ ([\d.]+)/)[1]);
    },
    summary.css,
  );
  assert.ok(Math.abs(summaryHue - 30) < 3, `scoped accordion hue ${summaryHue}`);

  const card = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("#scope-spacing-card"));
    return { padding: cs.paddingTop, radius: cs.borderTopLeftRadius };
  });
  const rootCard = await page.evaluate(() => getComputedStyle(document.querySelector("#root-card")).paddingTop);
  assert.equal(parseFloat(card.padding), parseFloat(rootCard) * 2, "scoped --peak-spacing");
  assert.equal(card.radius, "0px", "scoped --peak-radius");
  await page.close();
});

test("--peak-brand picker sets hue and re-imposes lightness", async () => {
  const page = await open("light");
  const h = await hue(page, "#scope-brand-button", "backgroundColor");
  const l = await lightness(page, "#scope-brand-button", "backgroundColor");
  // #e11d48 is oklch(0.586 0.222 17.6)
  assert.ok(Math.abs(h - 17.6) < 2, `hue ${h}`);
  assert.ok(Math.abs(l - 0.54) < 0.02, `L ${l}`);
  await page.close();
});

test("--peak-neutral-hue tints neutrals with its own hue; unset they follow the brand", async () => {
  const page = await open("light");
  assert.ok(Math.abs((await hue(page, "#root-text", "color")) - 250) < 3, "root text follows brand hue 250");
  assert.ok(Math.abs((await hue(page, "#scope-neutral-text", "color")) - 90) < 3, "neutral hue 90");
  // Secondary is the neutral ramp tinted when it has no hue of its own
  assert.ok(Math.abs((await hue(page, "#scope-neutral-secondary", "backgroundColor")) - 90) < 3, "secondary follows neutrals");
  await page.close();
});

test("--peak-secondary-hue/-chroma make secondary its own color, at the pinned lightness", async () => {
  const page = await open("light");
  assert.ok(Math.abs((await hue(page, "#scope-secondary-button", "backgroundColor")) - 30) < 3, "secondary hue 30");
  const l = await lightness(page, "#scope-secondary-button", "backgroundColor");
  assert.ok(l < 0.51 && l > 0.4, `secondary L ${l}`);
  await page.close();
});

test("--peak-dark-fills: deep button fills with white text in dark mode; links stay light", async () => {
  const page = await open("dark");
  for (const [plain, deep] of [
    ["#root-button", "#scope-fills-button"],
    ["#scope-neutral-secondary", "#scope-fills-secondary"],
  ]) {
    const lPlain = await lightness(page, plain, "backgroundColor");
    const lDeep = await lightness(page, deep, "backgroundColor");
    assert.ok(lPlain > 0.65, `${plain} light fill ${lPlain}`);
    assert.ok(lDeep < 0.56, `${deep} deep fill ${lDeep}`);
    assert.ok((await lightness(page, deep)) > 0.95, `${deep} white text`);
  }
  assert.ok((await lightness(page, "#scope-fills-link")) > 0.65, "link text stays light");
  await page.close();
  // No effect in light mode
  const light = await open("light");
  const [a, b] = [await lightness(light, "#root-button", "backgroundColor"), await lightness(light, "#scope-fills-button", "backgroundColor")];
  assert.ok(Math.abs(a - b) < 0.005, `light fills ${a} vs ${b}`);
  await light.close();
});

test("--peak-font-family-mono sets code fonts; unset keeps Blades' monospace stack", async () => {
  const page = await open("light");
  const [root, scoped] = await page.evaluate(() => ["#root-code", "#scope-mono-code"].map((s) => getComputedStyle(document.querySelector(s)).fontFamily));
  assert.match(root, /ui-monospace/);
  assert.match(scoped, /^Courier/);
  await page.close();
});

test("focus ring is opaque (WCAG 1.4.11)", async () => {
  for (const scheme of ["light", "dark"]) {
    const page = await open(scheme);
    const c = await page.evaluate(() => resolveColor("var(--pico-primary-focus)"));
    assert.equal(c.a, 1, `${scheme} focus alpha`);
    await page.close();
  }
});

test("link hover moves away from the background in dark mode", async () => {
  const page = await open("dark");
  const [base, hover] = await page.evaluate(() => [
    resolveColor("var(--pico-primary)"),
    resolveColor("var(--pico-primary-hover)"),
  ]);
  const sum = (c) => c.r + c.g + c.b;
  assert.ok(sum(hover) > sum(base), `${hover.css} should be lighter than ${base.css}`);
  await page.close();
});

test("Blades' data-compact sizes survive the bridge", async () => {
  const page = await open("light");
  const [radius, rem] = await page.evaluate(() => [
    parseFloat(getComputedStyle(document.querySelector("#compact-button")).borderTopLeftRadius),
    parseFloat(getComputedStyle(document.documentElement).fontSize),
  ]);
  assert.equal(radius, rem * 0.5); // Blades compact radius: 0.5rem
  await page.close();
});

test("heading scale follows --peak-type-ratio", async () => {
  const page = await open("light");
  const sizes = await page.evaluate(() =>
    [1, 2, 3, 4, 5, 6].map((n) => parseFloat(getComputedStyle(document.querySelector(`#h${n}`)).fontSize)),
  );
  const rootSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  sizes.forEach((px, i) => {
    const expected = rootSize * 1.15 ** (5 - i);
    assert.ok(Math.abs(px - expected) < 0.5, `h${i + 1} ${px}px, expected ${expected}px`);
  });
  await page.close();
});

test("no --pico-* color keeps Blades' default value", async () => {
  // Pico values Peak intentionally keeps
  const keep = new Set(["--pico-switch-color"]);
  for (const scheme of ["light", "dark"]) {
    const read = async (page) =>
      page.evaluate(() => {
        const out = {};
        const cs = getComputedStyle(document.documentElement);
        for (let i = 0; i < cs.length; i++) {
          const name = cs[i];
          if (!name.startsWith("--pico-")) continue;
          __probe.style.color = "rgb(1, 2, 3)";
          __probe.style.color = `var(${name})`;
          const c = getComputedStyle(__probe).color;
          if (c !== "rgb(1, 2, 3)" && cs.getPropertyValue(name).trim()) out[name] = c;
        }
        return out;
      });
    const blades = await open(scheme, { stylesheet: "../../node_modules/@anyblades/blades/css/blades.css" });
    const before = await read(blades);
    await blades.close();
    const peak = await open(scheme);
    const after = await read(peak);
    await peak.close();
    assert.ok(Object.keys(before).length > 80, `only ${Object.keys(before).length} colors compared`);
    const leaks = Object.keys(before).filter((k) => !keep.has(k) && before[k] === after[k]);
    assert.deepEqual(leaks, [], `${scheme}: Pico colors not bridged`);
  }
});
