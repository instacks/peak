// Entry and exit transitions (docs/PLAN.md §3): dialogs, popovers, reduced motion.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, ...options });
  await page.goto(fixtureUrl("components.html"));
  return page;
}

// Transitions running on an element (or one of its pseudo-elements), by property
const running = (page, id) =>
  page.evaluate(
    (id) =>
      document
        .getAnimations()
        .filter((a) => a.effect.target === document.getElementById(id))
        .map((a) => `${a.effect.pseudoElement ?? ""}${a.transitionProperty}`)
        .sort(),
    id,
  );

test("transitionBehavior survives the build", async () => {
  const page = await open();
  const behavior = await page.evaluate(() =>
    ["classic", "generic", "menu"].map((id) => getComputedStyle(document.getElementById(id)).transitionBehavior),
  );
  for (const b of behavior) assert.match(b, /allow-discrete/);
  await page.close();
});

test("<dialog open> in the markup doesn't animate on load", async () => {
  const page = await open();
  assert.deepEqual(await running(page, "markup-open"), []);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("markup-open")).opacity), "1");
  await page.close();
});

for (const id of ["classic", "closedby"]) {
  test(`${id} dialog: entry and exit`, async () => {
    const page = await open();
    await page.evaluate((id) => document.getElementById(id).close(), "markup-open");
    await page.evaluate((id) => document.getElementById(id).showModal(), id);
    const entry = await running(page, id);
    assert.ok(entry.includes("opacity"), `entry: ${entry}`);
    assert.ok(entry.includes("::backdropopacity"), `backdrop entry: ${entry}`);

    await page.waitForTimeout(400);
    await page.evaluate((id) => document.getElementById(id).close(), id);
    const exit = await running(page, id);
    assert.ok(exit.includes("opacity") && exit.includes("display"), `exit: ${exit}`);
    const during = await page.evaluate((id) => {
      const d = document.getElementById(id);
      return { display: getComputedStyle(d).display, bg: getComputedStyle(d).backgroundColor };
    }, id);
    assert.notEqual(during.display, "none", "still rendered while fading out");
    if (id === "closedby") assert.equal(during.bg, "rgba(0, 0, 0, 0)", "no classic overlay during exit");

    // Wait for the exit transitions themselves rather than a fixed time: a slow frame under load
    // made a 400ms wait for a 200ms fade flaky
    await page.evaluate(
      (id) =>
        Promise.race([
          Promise.all(document.getAnimations().filter((a) => a.effect.target === document.getElementById(id)).map((a) => a.finished)),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]),
      id,
    );
    assert.equal(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).display, id), "none");
    await page.close();
  });
}

test("closedby backdrop keeps Blades' overlay color", async () => {
  const page = await open();
  await page.evaluate(() => document.getElementById("closedby").showModal());
  await page.waitForTimeout(400);
  const backdrop = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById("closedby"), "::backdrop");
    return { bg: cs.backgroundColor, filter: cs.backdropFilter, opacity: cs.opacity };
  });
  assert.notEqual(backdrop.bg, "rgba(0, 0, 0, 0)");
  assert.match(backdrop.filter, /blur/);
  assert.equal(backdrop.opacity, "1");
  await page.close();
});

for (const id of ["generic", "menu"]) {
  test(`${id} popover: entry and exit`, async () => {
    const page = await open();
    await page.evaluate((id) => document.getElementById(id).showPopover(), id);
    const entry = await running(page, id);
    assert.ok(entry.includes("opacity"), `entry: ${entry}`);
    assert.ok(entry.includes("translate"), `entry slide: ${entry}`);
    await page.waitForTimeout(400);
    await page.evaluate((id) => document.getElementById(id).hidePopover(), id);
    const exit = await running(page, id);
    assert.ok(exit.includes("opacity") && exit.includes("display"), `exit: ${exit}`);
    await page.close();
  });
}

test("reduced motion: no slide, no backdrop transition", async () => {
  const page = await open({ reducedMotion: "reduce" });
  const s = await page.evaluate(() => {
    const g = document.getElementById("generic");
    return {
      translate: getComputedStyle(g).translate,
      duration: getComputedStyle(g).transitionDuration,
      backdrop: getComputedStyle(document.getElementById("classic"), "::backdrop").transitionProperty,
    };
  });
  assert.equal(s.translate, "none");
  assert.match(s.duration, /^0s/);
  assert.equal(s.backdrop, "none");
  await page.close();
});
