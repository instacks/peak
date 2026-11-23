// Typography (src/typography.css, src/utilities.css, the heading and button bridges in
// tokens.css), in the global and the scoped build.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

const SET = `:root {
  --peak-heading-tracking: -0.015em;
  --peak-display-weight: 700;
  --peak-heading-font-weight: 650;
  --peak-subheading-font-weight: 600;
  --peak-button-font-weight: 550;
  --peak-font-smoothing: antialiased;
  --peak-section-spacing: 4rem;
  --peak-code-max-height: 22rem;
}`;

async function open(file, inputs = "") {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(fixtureUrl("typography.html"));
  await page.evaluate(
    async ([file, inputs]) => {
      if (file.includes("scoped")) document.documentElement.classList.add("peak");
      document.getElementById("inputs").textContent = inputs;
      const link = document.querySelector("link[rel=stylesheet]");
      if (link.getAttribute("href").endsWith(file)) return;
      await new Promise((resolve) => {
        link.onload = resolve;
        link.href = `../../dist/${file}`;
      });
    },
    [file, inputs],
  );
  return page;
}

const read = (page) =>
  page.evaluate(() => {
    const cs = (id) => getComputedStyle(document.getElementById(id));
    const px = (v) => parseFloat(v);
    const ids = ["h1", "h2", "h3", "h4", "h5", "eyebrow-heading", "subtitle-heading", "subtitle", "eyebrow", "eyebrow-class", "display", "lead", "lead-parent", "text-primary", "text-muted", "h3-as-h4", "text", "button", "section", "pre", "caption", "tabular"];
    const out = {};
    for (const id of ids) {
      const c = cs(id);
      out[id] = {
        size: px(c.fontSize),
        weight: Number(c.fontWeight),
        tracking: c.letterSpacing === "normal" ? 0 : px(c.letterSpacing),
        color: c.color,
        transform: c.textTransform,
        wrap: c.textWrapStyle || c.textWrap,
        maxInline: c.maxInlineSize,
        marginEnd: px(c.marginBlockEnd),
        maxBlock: c.maxBlockSize,
        smoothing: c.webkitFontSmoothing,
        numeric: c.fontVariantNumeric,
        lineHeight: px(c.lineHeight),
      };
    }
    const root = getComputedStyle(document.documentElement);
    const probe = (value) => {
      const i = document.createElement("i");
      i.style.color = value;
      document.body.append(i);
      const c = getComputedStyle(i).color;
      i.remove();
      return c;
    };
    out.tokens = {
      primary: probe("var(--peak-primary)"),
      secondary: probe("var(--peak-secondary)"),
      muted: probe("var(--peak-muted)"),
      rootSize: px(root.fontSize),
      blockSpacing: px(getComputedStyle(document.body).getPropertyValue("--pico-block-spacing-vertical")) || null,
      chWidth: (() => {
        const s = document.createElement("span");
        s.style.cssText = "inline-size: 65ch; display: inline-block; font: inherit";
        document.getElementById("lead").append(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return w;
      })(),
      vw: innerWidth,
    };
    return out;
  });

for (const file of ["peak.css", "peak.scoped.css"]) {
  test(`${file}: with the inputs unset, headings and buttons look as before`, async () => {
    const page = await open(file);
    const s = await read(page);
    for (const h of ["h1", "h2", "h3", "h4", "h5"]) assert.equal(s[h].tracking, 0, `${h} letter-spacing`);
    for (const h of ["h1", "h2", "h4", "h5"]) assert.equal(s[h].weight, 700, `${h} follows the heading weight`);
    assert.equal(s.button.weight, s.text.weight, "button follows the body weight");
    assert.equal(s.pre.maxBlock, "none");
    assert.notEqual(s.text.smoothing, "antialiased");
    assert.equal(s.h2.wrap, "balance");
    // Blades' per-level line heights, around the input's default 1.2 (h4)
    for (const [h, lh] of [["h1", 1.125], ["h2", 1.15], ["h3", 1.175], ["h4", 1.2], ["h5", 1.225]]) {
      assert.ok(Math.abs(s[h].lineHeight - lh * s[h].size) < 0.1, `${h} line-height ${s[h].lineHeight / s[h].size}`);
    }
    await page.close();
  });

  test(`${file}: tracking, per-level weights, button weight, smoothing, section and code inputs`, async () => {
    const page = await open(file, SET);
    const s = await read(page);
    const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, `${msg}: ${a} vs ${b}`);
    close(s.h2.tracking, -0.015 * s.h2.size, "h2 tracking");
    close(s.h4.tracking, -0.015 * s.h4.size, "h4 tracking");
    close(s.h1.tracking, -0.02 * s.h1.size, "h1 gets 4/3");
    close(s.display.tracking, -0.025 * s.display.size, "display gets 5/3");
    assert.equal(s.h5.tracking, 0, "h5 untracked");
    assert.deepEqual([s.h1.weight, s.h2.weight, s.h3.weight, s.h4.weight, s.h5.weight], [700, 650, 650, 600, 600]);
    assert.equal(s.button.weight, 550);
    assert.equal(s.text.smoothing, "antialiased");
    close(s.section.marginEnd, 4 * s.tokens.rootSize, "section spacing");
    close(parseFloat(s.pre.maxBlock), 22 * s.tokens.rootSize, "code block height");
    await page.close();
  });

  test(`${file}: an eyebrow before a heading leaves the heading intact; a subtitle is still muted`, async () => {
    const page = await open(file);
    const s = await read(page);
    assert.equal(s["eyebrow-heading"].size, s.h2.size, "heading keeps its size");
    assert.equal(s["eyebrow-heading"].color, s.h2.color, "and its color");
    assert.equal(s["eyebrow-heading"].weight, s.h2.weight, "and its weight");
    assert.equal(s.eyebrow.transform, "uppercase");
    assert.equal(s.eyebrow.color, s.tokens.primary);
    assert.ok(Math.abs(s.eyebrow.size - 0.75 * s.tokens.rootSize) < 0.05, "0.75rem");
    assert.equal(s["eyebrow-class"].color, s.tokens.secondary, ".peak-eyebrow.secondary");
    const gap = await page.evaluate(() => document.getElementById("after-eyebrow").getBoundingClientRect().top - document.getElementById("eyebrow-class").getBoundingClientRect().bottom);
    assert.ok(gap < 0.5 * s.tokens.rootSize, `a heading follows .peak-eyebrow closely (${gap}px)`);
    assert.equal(s.subtitle.color, s.tokens.muted, "Blades' subtitle rule still applies");
    assert.ok(Math.abs(s.subtitle.size - s.tokens.rootSize) < 0.05, "subtitle 1rem");
    assert.equal(s["subtitle-heading"].size, s.h2.size);
    await page.close();
  });

  test(`${file}: display, lead and utilities`, async () => {
    const page = await open(file);
    const s = await read(page);
    const fluid = Math.min(Math.max(2.25 * s.tokens.rootSize, s.tokens.rootSize + 0.04 * s.tokens.vw), 3.5 * s.tokens.rootSize);
    assert.ok(Math.abs(s.display.size - fluid) < 0.1, `display ${s.display.size} vs ${fluid}`);
    assert.equal(s.display.weight, 700);
    assert.ok(Math.abs(s.display.lineHeight - 1.05 * s.display.size) < 0.1);
    assert.ok(Math.abs(s.lead.size - 1.15 * s["lead-parent"].size) < 0.05, "lead one step up");
    assert.equal(s.lead.color, s.tokens.muted);
    assert.ok(Math.abs(parseFloat(s.lead.maxInline) - s.tokens.chWidth) < 1, "lead measure 65ch");
    assert.equal(s["text-primary"].color, s.tokens.primary);
    assert.equal(s["text-muted"].color, s.tokens.muted);
    assert.equal(s["h3-as-h4"].size, s.h4.size, ".peak-h4 on an h3");
    assert.equal(s.tabular.numeric, "tabular-nums");
    assert.ok(Math.abs(s.caption.size - 0.75 * s.text.size) < 0.05, "caption 0.75em");
    await page.close();
  });

  test(`${file}: alignment utilities follow the writing direction; margin resets beat components`, async () => {
    const page = await open(file);
    const a = await page.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      const left = (id) => {
        const el = document.getElementById(id);
        const r = document.createRange();
        r.selectNodeContents(el);
        return { text: r.getBoundingClientRect().left - el.getBoundingClientRect().left, box: el.getBoundingClientRect().width - r.getBoundingClientRect().width };
      };
      return {
        center: cs("text-center").textAlign,
        end: cs("text-end").textAlign,
        endRtl: left("text-end-rtl"),
        endLtr: left("text-end"),
        heading: cs("center-heading").textAlign,
        eyebrow: cs("center-eyebrow").textAlign,
        start: cs("text-start").textAlign,
        mt0: parseFloat(cs("mt-0").marginBlockStart),
        mtNormal: parseFloat(cs("mt-normal").marginBlockStart),
        mb0: parseFloat(cs("mb-0").marginBlockEnd),
        card: parseFloat(cs("card-mb-0").marginBlockEnd),
      };
    });
    assert.equal(a.center, "center");
    assert.equal(a.end, "end");
    // "end" puts the text on the right in LTR and on the left in RTL
    assert.ok(Math.abs(a.endLtr.text - a.endLtr.box) < 1, "LTR: text at the right edge");
    assert.ok(a.endRtl.text < 1, "RTL: text at the left edge");
    assert.equal(a.heading, "center", "an hgroup's heading inherits it");
    assert.equal(a.eyebrow, "center", "and its eyebrow");
    assert.equal(a.start, "start");
    assert.ok(a.mtNormal > 0, "a heading after content has space above by default");
    assert.equal(a.mt0, 0);
    assert.equal(a.mb0, 0);
    assert.equal(a.card, 0, "utilities win over the card's margin");
    await page.close();
  });
}
