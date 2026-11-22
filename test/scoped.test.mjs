// Scoped build (dist/peak.scoped*.css): Peak and Blades apply inside .peak, not outside it and
// not inside .peak-ignore; inputs set on :root still reach the scope.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl, bubble } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(file, { htmlClass } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  await page.goto(fixtureUrl("scoped.html"));
  await page.evaluate(
    async ([href, htmlClass]) => {
      if (htmlClass) document.documentElement.classList.add(htmlClass);
      const link = document.querySelector("link[rel=stylesheet]");
      if (link.getAttribute("href").endsWith(href)) return;
      await new Promise((resolve) => {
        link.onload = resolve;
        link.href = `../../dist/${href}`;
      });
    },
    [file, htmlClass],
  );
  return page;
}

const style = (page, id, prop) => page.evaluate(([id, prop]) => getComputedStyle(document.getElementById(id))[prop], [id, prop]);

const oklch = (page, id, prop) =>
  page.evaluate(
    ([id, prop]) => {
      const el = document.getElementById(id);
      const probe = document.createElement("i");
      probe.style.color = `oklch(from ${getComputedStyle(el)[prop]} l c h)`;
      el.append(probe);
      const [l, c, h] = getComputedStyle(probe).color.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/).slice(1).map(Number);
      probe.remove();
      return { l, c, h };
    },
    [id, prop],
  );

for (const file of ["peak.scoped.css", "peak.scoped.min.css"]) {
  test(`${file}: styles stop at the scope and at .peak-ignore`, async () => {
    const page = await open(file);
    assert.equal(await style(page, "outside-button", "borderTopLeftRadius"), "0px", "outside");
    assert.equal(await style(page, "ignored-button", "borderTopLeftRadius"), "0px", ".peak-ignore");
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).marginTop), "8px", "body untouched");
    assert.notEqual(await style(page, "inside-button", "borderTopLeftRadius"), "0px", "inside");
    const { h } = await oklch(page, "inside-button", "backgroundColor");
    assert.ok(Math.abs(h - 250) < 3, `inside hue ${h}`);
    await page.close();
  });

  test(`${file}: inputs on :root reach the scope; nested themes and scopes work`, async () => {
    const page = await open(file);
    await page.evaluate(() => document.documentElement.style.setProperty("--peak-hue", "160"));
    assert.ok(Math.abs((await oklch(page, "inside-button", "backgroundColor")).h - 160) < 3, ":root input");
    assert.ok(Math.abs((await oklch(page, "hue-button", "backgroundColor")).h - 30) < 3, "data-peak-scope");
    assert.ok((await oklch(page, "dark-text", "color")).l > 0.85, "nested data-theme=dark");
    await page.close();
  });

  test(`${file}: a nested scope keeps the page's root size; .peak on <html> is fluid`, async () => {
    let page = await open(file);
    const sizes = await page.evaluate(() => ({
      html: parseFloat(getComputedStyle(document.documentElement).fontSize),
      scope: parseFloat(getComputedStyle(document.getElementById("scope")).fontSize),
      h1: parseFloat(getComputedStyle(document.getElementById("h1")).fontSize),
    }));
    assert.equal(sizes.scope, sizes.html);
    assert.ok(Math.abs(sizes.h1 - sizes.html * 1.15 ** 5) < 0.5, `h1 ${sizes.h1}`);
    await page.close();

    page = await open(file, { htmlClass: "peak" });
    const html = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.ok(Math.abs(html - (14 + 0.005 * 1280)) < 0.5, `fluid root ${html}`); // 0.875rem + 0.5vw
    await page.close();
  });

  test(`${file}: menus, dialogs and tooltips work inside the scope`, async () => {
    const page = await open(file);
    await page.click("#menu-trigger");
    const [t, m] = await page.evaluate(() =>
      ["menu-trigger", "menu"].map((id) => document.getElementById(id).getBoundingClientRect().toJSON()),
    );
    assert.ok(Math.abs(m.top - t.bottom) < 6 && Math.abs(m.left - t.left) < 6, "menu anchored");
    await page.keyboard.press("Escape");

    assert.match(await style(page, "dialog", "transitionBehavior"), /allow-discrete/);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("dialog"), "::backdrop").transitionProperty), "none");

    const b = await bubble(page, "tip");
    const host = await page.evaluate(() => document.getElementById("tip").getBoundingClientRect().toJSON());
    assert.ok(b && b.top >= host.bottom, `tooltip ${JSON.stringify(b)} host bottom ${host.bottom}`);
    await page.close();
  });
}
