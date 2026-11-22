// Contrast sweep (docs/PLAN.md §7.4): every semantic text/background pair across the slider
// ranges, in both schemes. Failures point at the slider ranges to clamp or the lightness anchors
// in src/tokens.css to adjust.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl, colorHelpers, contrast } from "./helpers.mjs";

const TEXT = 4.5;
const UI = 3;

// [foreground, background, minimum ratio]
const brandPairs = [
  ["--peak-text", "--peak-bg", TEXT],
  ["--peak-text", "--peak-surface", TEXT],
  ["--peak-text", "--peak-surface-sunken", TEXT],
  ["--peak-heading", "--peak-bg", TEXT],
  ["--peak-muted", "--peak-bg", TEXT],
  ["--peak-muted", "--peak-surface-sunken", TEXT],
  ["--pico-h6-color", "--peak-bg", TEXT],
  ["--peak-primary", "--peak-bg", TEXT],
  ["--peak-primary", "--peak-surface", TEXT],
  ["--peak-primary-hover", "--peak-bg", TEXT],
  ["--peak-on-primary", "--peak-primary-fill", TEXT],
  ["--peak-on-primary", "--peak-primary-hover-bg", TEXT],
  ["--peak-primary-focus", "--peak-bg", UI],
  ["--peak-secondary", "--peak-bg", TEXT],
  ["--peak-on-secondary", "--peak-secondary-fill", TEXT],
  ["--peak-on-secondary", "--peak-secondary-hover-bg", TEXT],
  ["--peak-on-contrast", "--peak-contrast", TEXT],
  ["--peak-on-contrast", "--peak-contrast-hover-bg", TEXT],
  ["--peak-bg", "--peak-contrast", TEXT], // tooltip
  ["--peak-primary-hover", "--peak-primary-tint", TEXT], // badge
  ["--peak-secondary-hover", "--peak-secondary-tint", TEXT], // .secondary badge
  ["--peak-on-primary", "--peak-primary-fill", TEXT], // .solid badge
  ["--peak-text", "--peak-primary-tint", TEXT], // callout body
  ["--peak-text", "--peak-secondary-tint", TEXT], // .secondary callout body
];

const secondaryPairs = brandPairs.filter(([fg, bg]) => /secondary/.test(fg + bg));

const accentPairs = [
  ["--peak-accent", "--peak-bg", TEXT],
  ["--peak-accent", "--peak-surface", TEXT],
  ["--peak-accent-hover", "--peak-bg", TEXT],
  ["--peak-accent", "--peak-accent-subtle", TEXT],
  ["--peak-text", "--peak-accent-subtle", TEXT],
  ["--peak-on-accent", "--peak-accent-fill", TEXT],
  ["--peak-on-accent", "--peak-accent-hover-bg", TEXT],
];

const statusPairs = (s) => [
  ...(s === "warning"
    ? [["--peak-text", `--peak-${s}-subtle`, TEXT]]
    : [
        [`--peak-${s}`, "--peak-bg", TEXT],
        [`--peak-${s}`, `--peak-${s}-subtle`, TEXT],
        [`--peak-${s}`, "--peak-surface-sunken", UI], // form valid/invalid borders
      ]),
  [`--peak-text`, `--peak-${s}-subtle`, TEXT],
  [`--peak-on-${s}`, `--peak-${s}`, TEXT],
  [`--peak-on-${s}`, `--peak-${s}-hover`, TEXT],
];

const statuses = { success: 150, warning: 80, danger: 27, info: 235 };

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function sweep(scheme, configs, pairs) {
  const page = await browser.newPage({ colorScheme: scheme });
  await page.goto(fixtureUrl("tokens.html"));
  await page.evaluate(colorHelpers);
  const names = [...new Set(pairs.flatMap(([fg, bg]) => [fg, bg]))];
  const results = await page.evaluate(
    ([configs, names]) =>
      configs.map((inputs) => {
        const style = document.documentElement.style;
        style.cssText = "";
        for (const [k, v] of Object.entries(inputs)) style.setProperty(k, v);
        return Object.fromEntries(names.map((n) => [n, resolveColor(`var(${n})`)]));
      }),
    [configs, names],
  );
  await page.close();
  const failures = [];
  results.forEach((colors, i) => {
    for (const [fg, bg, min] of pairs) {
      const ratio = contrast(colors[fg], colors[bg]);
      if (ratio < min) failures.push({ scheme, ...configs[i], pair: `${fg} on ${bg}`, ratio: +ratio.toFixed(2), min });
    }
  });
  return failures;
}

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: brand pairs across hue 0–350 × chroma {0.05, 0.16, 0.30} and neutral tint {0, 0.04}`, async () => {
    const configs = [];
    for (let h = 0; h < 360; h += 10) {
      for (const c of [0.05, 0.16, 0.3]) {
        configs.push({ "--peak-hue": String(h), "--peak-chroma": String(c) });
        // Deep fills in dark mode: white text on the light scheme's fills
        configs.push({ "--peak-hue": String(h), "--peak-chroma": String(c), "--peak-dark-fills": "1" });
      }
      // Neutral tint at the ends of its slider range
      for (const n of [0, 0.04]) configs.push({ "--peak-hue": String(h), "--peak-neutral-chroma": String(n) });
    }
    const failures = await sweep(scheme, configs, brandPairs);
    if (failures.length) console.table(failures);
    assert.equal(failures.length, 0, `${failures.length} brand pairs below the WCAG minimum`);
  });

  test(`${scheme}: brand pairs with a separate neutral hue 0–350 (tint 0.04) against an opposite brand hue`, async () => {
    const configs = [];
    for (let h = 0; h < 360; h += 10) {
      for (const c of [0.05, 0.3]) {
        configs.push({
          "--peak-neutral-hue": String(h),
          "--peak-neutral-chroma": "0.04",
          "--peak-hue": String((h + 180) % 360),
          "--peak-chroma": String(c),
        });
      }
    }
    const failures = await sweep(scheme, configs, brandPairs);
    if (failures.length) console.table(failures);
    assert.equal(failures.length, 0, `${failures.length} brand pairs below the WCAG minimum`);
  });

  test(`${scheme}: brand pairs with an ink hue 0–350 × tint {0, 0.04} and a dark neutral hue, against opposite neutrals`, async () => {
    const configs = [];
    for (let h = 0; h < 360; h += 10) {
      for (const c of [0, 0.04]) {
        configs.push({
          "--peak-ink-hue": String(h),
          "--peak-ink-chroma": String(c),
          "--peak-neutral-hue": String((h + 180) % 360),
          "--peak-neutral-hue-dark": String((h + 90) % 360),
          "--peak-neutral-chroma": "0.04",
        });
      }
      // A dark neutral hue on its own, opposite the light one
      configs.push({ "--peak-neutral-hue-dark": String(h), "--peak-neutral-hue": String((h + 180) % 360), "--peak-neutral-chroma": "0.04" });
    }
    const failures = await sweep(scheme, configs, brandPairs);
    if (failures.length) console.table(failures);
    assert.equal(failures.length, 0, `${failures.length} brand pairs below the WCAG minimum`);
  });

  test(`${scheme}: accent pairs across hue 0–350 × chroma {0.05, 0.18, 0.25, 0.30}, with ink tint 0.04`, async () => {
    const configs = [];
    for (let h = 0; h < 360; h += 10) {
      for (const c of [0.05, 0.18, 0.25, 0.3]) {
        configs.push({ "--peak-accent-hue": String(h), "--peak-accent-chroma": String(c) });
        configs.push({ "--peak-accent-hue": String(h), "--peak-accent-chroma": String(c), "--peak-ink-hue": String((h + 180) % 360), "--peak-ink-chroma": "0.04" });
      }
    }
    const failures = await sweep(scheme, configs, accentPairs);
    if (failures.length) console.table(failures);
    assert.equal(failures.length, 0, `${failures.length} accent pairs below the WCAG minimum`);
  });

  test(`${scheme}: secondary pairs across secondary hue 0–350 × chroma {0, 0.05, 0.16, 0.30}, light and deep fills`, async () => {
    const configs = [];
    for (let h = 0; h < 360; h += 10) {
      for (const c of [0, 0.05, 0.16, 0.3]) {
        for (const fills of ["0", "1"]) {
          configs.push({ "--peak-secondary-hue": String(h), "--peak-secondary-chroma": String(c), "--peak-dark-fills": fills });
        }
      }
    }
    const failures = await sweep(scheme, configs, secondaryPairs);
    if (failures.length) console.table(failures);
    assert.equal(failures.length, 0, `${failures.length} secondary pairs below the WCAG minimum`);
  });

  test(`${scheme}: status pairs across hue 0–345 × chroma {0.15, 0.25}`, async () => {
    const failures = [];
    for (const [s, hue] of Object.entries(statuses)) {
      const configs = [];
      for (let dh = 0; dh < 360; dh += 15) {
        for (const c of [0.15, 0.25]) {
          configs.push({ [`--peak-${s}-hue`]: String((hue + dh + 360) % 360), "--peak-status-chroma": String(c) });
        }
      }
      failures.push(...(await sweep(scheme, configs, statusPairs(s))));
    }
    if (failures.length) console.table(failures);
    assert.equal(failures.length, 0, `${failures.length} status pairs below the WCAG minimum`);
  });
}
