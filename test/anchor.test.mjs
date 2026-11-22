// Popover and anchor positioning (docs/PLAN.md §2): menus, edge flips, scoping, legacy dropdowns,
// hint popovers and anchored [data-tooltip] bubbles.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl, bubble } from "./helpers.mjs";

const VIEWPORT = { width: 1280, height: 800 };
const TOLERANCE = 6; // outline-width gap plus rounding

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open() {
  const page = await browser.newPage({ viewport: VIEWPORT, reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  await page.goto(fixtureUrl("components.html"));
  await page.evaluate(() => document.getElementById("markup-open").close());
  return page;
}

const rect = (page, id) =>
  page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
  }, id);

async function openMenu(page, trigger, menu, { viaClick = true } = {}) {
  if (viaClick) {
    await page.locator(`#${trigger}`).scrollIntoViewIfNeeded();
    await page.click(`#${trigger}`);
  } else {
    await page.evaluate((id) => document.getElementById(id).showPopover(), menu);
  }
  return { t: await rect(page, trigger), m: await rect(page, menu) };
}

const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= TOLERANCE, `${msg}: ${a} vs ${b}`);

test("menu opens below its trigger, at least as wide", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "menu-trigger", "menu");
  near(m.top, t.bottom, "top");
  near(m.left, t.left, "left");
  assert.ok(m.width >= t.width - 0.5, `width ${m.width} < ${t.width}`);
  await page.close();
});

test("side-by-side menus anchor to their own triggers, also without { source }", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "menu2-trigger", "menu2", { viaClick: false });
  near(m.left, t.left, "second menu left");
  near(m.top, t.bottom, "second menu top");
  await page.close();
});

for (const [name, trigger, menu] of [
  ["overflow: hidden", "clip-trigger", "clip-menu"],
  ["a transformed parent", "transform-trigger", "transform-menu"],
]) {
  test(`menu inside ${name} escapes and stays anchored`, async () => {
    const page = await open();
    const { t, m } = await openMenu(page, trigger, menu);
    near(m.top, t.bottom, "top");
    near(m.left, t.left, "left");
    if (menu === "clip-menu") assert.ok(m.height > 60, `clipped: ${m.height}px`);
    await page.close();
  });
}

test("RTL menu aligns to the trigger's inline end", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "rtl-trigger", "rtl-menu");
  near(m.right, t.right, "right edge");
  near(m.top, t.bottom, "top");
  await page.close();
});

test("menu at the right edge flips inline", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "right-trigger", "right-menu");
  assert.ok(m.right <= VIEWPORT.width, `overflows: ${m.right}`);
  near(m.right, t.right, "aligned to trigger end");
  await page.close();
});

test("menu at the bottom edge flips block", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "bottom-trigger", "bottom-menu");
  assert.ok(m.bottom <= t.top + 1, `menu bottom ${m.bottom} below trigger top ${t.top}`);
  near(m.left, t.left, "left");
  await page.close();
});

test("menu in the corner flips both ways", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "corner-trigger", "corner-menu");
  assert.ok(m.bottom <= t.top + 1, `menu bottom ${m.bottom} below trigger top ${t.top}`);
  assert.ok(m.right <= VIEWPORT.width, `overflows: ${m.right}`);
  near(m.right, t.right, "aligned to trigger end");
  await page.close();
});

test("generic popover: centered by default, anchored with a [data-peak-anchor] wrapper", async () => {
  const page = await open();
  const { m: g } = await openMenu(page, "generic-trigger", "generic");
  near(g.left + g.width / 2, VIEWPORT.width / 2, "centered");
  await page.evaluate(() => document.getElementById("generic").hidePopover());
  const { t, m } = await openMenu(page, "anchored-trigger", "anchored");
  near(m.top, t.bottom, "anchored top");
  near(m.left, t.left, "anchored left");
  const bg = await page.evaluate(() => getComputedStyle(document.getElementById("anchored")).backgroundColor);
  assert.notEqual(bg, "rgb(255, 255, 255)", "themed surface, not the UA Canvas");
  await page.close();
});

test("hint popover sits above its trigger", async () => {
  const page = await open();
  const { t, m } = await openMenu(page, "hint-trigger", "hint");
  assert.ok(m.bottom <= t.top + 1, `hint bottom ${m.bottom} vs trigger top ${t.top}`);
  near(m.left + m.width / 2, t.left + t.width / 2, "centered on trigger");
  await page.close();
});

test("legacy details.dropdown: unchanged by default, anchored with data-peak-anchor", async () => {
  const page = await open();
  const legacy = await page.evaluate(() => {
    const d = document.getElementById("dd-legacy");
    d.open = true;
    return getComputedStyle(d.querySelector("ul")).position;
  });
  assert.equal(legacy, "absolute");
  await page.evaluate(() => (document.getElementById("dd-legacy").open = false));
  const anchored = await page.evaluate(() => {
    const d = document.getElementById("dd-anchored");
    d.scrollIntoView({ block: "center" });
    d.open = true;
    const s = d.querySelector("summary").getBoundingClientRect();
    const u = d.querySelector("ul").getBoundingClientRect();
    return { position: getComputedStyle(d.querySelector("ul")).position, s, u };
  });
  assert.equal(anchored.position, "fixed");
  near(anchored.u.top, anchored.s.bottom, "top");
  near(anchored.u.left, anchored.s.left, "left");
  assert.ok(anchored.u.width >= anchored.s.width - 0.5, "at least as wide as the summary");
  await page.close();
});

for (const [id, check] of [
  ["tip-top", (b, h) => b.bottom <= h.top && Math.abs((b.left + b.right) / 2 - (h.left + h.right) / 2) < 4],
  ["tip-bottom", (b, h) => b.top >= h.bottom],
  ["tip-left", (b, h) => b.right <= h.left],
  ["tip-right", (b, h) => b.left >= h.right],
  ["tip-edge", (b, h) => b.top >= h.bottom], // flip-block at the top of the viewport
]) {
  test(`[data-tooltip] ${id.slice(4)} is anchored to its element`, async () => {
    const page = await open();
    const b = await bubble(page, id);
    const h = await rect(page, id);
    assert.ok(b, "bubble not found");
    assert.ok(check(b, h), `bubble ${JSON.stringify(b)} host ${JSON.stringify(h)}`);
    await page.close();
  });
}

test("[data-tooltip] long text wraps within the viewport", async () => {
  const page = await open();
  const b = await bubble(page, "tip-long");
  const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  assert.ok(b.right - b.left <= 20 * rem + 1, `width ${b.right - b.left}`);
  assert.ok(b.bottom - b.top > 2 * rem, `height ${b.bottom - b.top}: not wrapped`);
  assert.ok(b.left >= 0 && b.right <= VIEWPORT.width);
  await page.close();
});
