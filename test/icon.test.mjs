// .peak-icon (src/components/icon.css): size in em and its variants, drawn in the text color
// through the SVG mask, and still drawn in forced colors and in print, in both builds. Also an
// icon button's neighbour: a type="button" trigger in a [data-peak-anchor] wrapper in a row. And a
// link's underline stops at the icon: no underlined space, the text still on the line.
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

  test(`${file}: in a link, the underline skips the space after the icon; the text stays on the line`, async () => {
    const page = await open(file);
    const m = await page.evaluate(() => {
      const measure = (node, start, end) => {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        return range.getBoundingClientRect().toJSON();
      };
      const row = (id) => {
        const p = document.getElementById(id);
        const a = p.querySelector("a");
        const text = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        const at = text.textContent.search(/\S/);
        return {
          height: p.getBoundingClientRect().height,
          // The words around the link and in it share a line: same top
          outside: measure(p.firstChild, 0, 4).top,
          inside: measure(text, at, at + 1).top,
          // The space between the icon and the text: not rendered, so not underlined
          space: text.textContent.trim() === text.textContent ? 0 : measure(text, at ? at - 1 : text.length - 1, at || text.length).width,
          icon: a.querySelector(".peak-icon").getBoundingClientRect().toJSON(),
          word: measure(text, at, at + 1),
        };
      };
      return {
        lineHeight: parseFloat(getComputedStyle(document.getElementById("u-row")).lineHeight),
        rows: [row("u-row"), row("u-row-after"), row("u-row-xl")],
      };
    });
    for (const [i, r] of m.rows.entries()) {
      assert.equal(r.space, 0, `row ${i}: the space is not rendered`);
      assert.ok(Math.abs(r.inside - r.outside) < 1, `row ${i}: the link's text on the line (${r.inside} vs ${r.outside})`);
    }
    const [plain, after] = m.rows;
    assert.equal(plain.height, m.lineHeight, "an icon of the default size adds no height to the line");
    assert.ok(Math.abs(plain.word.left - plain.icon.right - 5) < 1, "a 0.25em gap after the icon");
    assert.ok(Math.abs(after.icon.left - after.word.left) > 20, "an icon after the text stays after it");
    const iconMid = plain.icon.top + plain.icon.height / 2;
    const textMid = plain.word.top + plain.word.height / 2;
    assert.ok(Math.abs(iconMid - textMid) < 4, `centered on the text line (${iconMid} vs ${textMid})`);

    // No link color in the gap between the icon and the text, from the top of the line to its bottom
    const link = await rgb(page, "u-link");
    const x = Math.round(plain.icon.right + 2);
    for (let y = Math.round(plain.word.top); y < plain.word.bottom; y++) {
      assert.ok(!near(await pixel(page, x, y), link, 40), `no underline in the gap at y=${y}`);
    }

    // Links laid out as blocks or buttons keep their display
    const display = (id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).display, id);
    assert.equal(await display("u-button"), "inline-block");
    for (const id of ["u-aside", "u-dropdown", "u-popover"]) assert.equal(await display(id), "block", id);
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
