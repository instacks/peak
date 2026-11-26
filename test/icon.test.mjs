// .peak-icon (src/components/icon.css): size in em and its variants, drawn in the text color
// through the SVG mask, and still drawn in forced colors and in print, in both builds. Also an
// icon button's neighbour: a type="button" trigger in a [data-peak-anchor] wrapper in a row.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl, pixel } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(file, { forcedColors = "none", media = "screen" } = {}) {
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  await page.emulateMedia({ forcedColors, media });
  await page.goto(fixtureUrl("icon.html"));
  await page.evaluate(async (file) => {
    if (file.includes("scoped")) document.documentElement.classList.add("peak");
    const link = document.querySelector("link[rel=stylesheet]");
    if (link.getAttribute("href").endsWith(file)) return;
    await new Promise((resolve) => {
      link.onload = resolve;
      link.href = `../../dist/${file}`;
    });
  }, file);
  return page;
}

const box = (page, id) => page.evaluate((id) => document.getElementById(id).getBoundingClientRect().toJSON(), id);
const center = async (page, id) => {
  const b = await box(page, id);
  return pixel(page, Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
};
// A computed color (oklch, rgb…) as sRGB bytes, painted on a canvas like the screenshot
const rgb = (page, id, prop = "color") =>
  page.evaluate(([id, prop]) => {
    const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d");
    ctx.fillStyle = getComputedStyle(document.getElementById(id) ?? document.body)[prop];
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, [id, prop]);
const near = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

for (const file of ["peak.css", "peak.scoped.css"]) {
  test(`${file}: icon sizes follow the text: 1.25em, sm, lg, xl and --peak-icon-size`, async () => {
    const page = await open(file);
    const sizes = {};
    for (const id of ["default", "sm", "lg", "xl", "knob"]) sizes[id] = Math.round((await box(page, id)).width * 100) / 100;
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.deepEqual(sizes, { default: 25, sm: 20, lg: 35, xl: 50, knob: 3 * rem });
    const [t, i] = await page.evaluate(() => {
      const icon = document.getElementById("default");
      const range = document.createRange();
      range.selectNodeContents(icon.parentElement.firstChild);
      const x = range.getBoundingClientRect();
      const r = icon.getBoundingClientRect();
      return [x.top + x.height / 2, r.top + r.height / 2];
    });
    assert.ok(Math.abs(t - i) < 4, `centered on the text line (${t} vs ${i})`);
    await page.close();
  });

  test(`${file}: drawn in the text color, through the mask`, async () => {
    const page = await open(file);
    assert.ok(near(await center(page, "red"), [200, 0, 0]), "the parent's color");
    assert.ok(near(await center(page, "in-link"), await rgb(page, "link")), "a link's color");
    assert.ok(near(await center(page, "success"), await rgb(page, "success")), ".peak-text-success");
    const ring = await box(page, "ring");
    const bg = await pixel(page, Math.round(ring.right + 6), Math.round(ring.y + ring.height / 2));
    assert.ok(near(await center(page, "ring"), bg), "the ring's hole shows the page: the SVG is a mask");
    await page.close();
  });

  test(`${file}: a <button type="button"> trigger in a [data-peak-anchor] wrapper lines up with the buttons beside it`, async () => {
    const page = await open(file);
    const [a, b] = [await box(page, "row-plain"), await box(page, "row-trigger")];
    assert.ok(Math.abs(a.top - b.top) < 1 && Math.abs(a.height - b.height) < 1, `same line (${a.top}/${b.top})`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("row-trigger")).marginBottom), "0px");
    await page.close();
  });

  test(`${file}: still drawn in forced colors and in print`, async () => {
    const forced = await open(file, { forcedColors: "active" });
    const text = await rgb(forced, "red");
    assert.ok(near(await center(forced, "red"), text), `forced colors: the system text color (${text})`);
    await forced.close();
    const print = await open(file, { media: "print" });
    assert.equal(await print.evaluate(() => getComputedStyle(document.getElementById("red")).printColorAdjust), "exact");
    await print.close();
  });
}
