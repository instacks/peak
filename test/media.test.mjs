// Prose, heading anchors (src/typography.css) and the visitor's preferences: more contrast,
// reduced transparency (src/tokens.css), forced colors and print (src/media.css). Both builds.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { launch, fixtureUrl } from "./helpers.mjs";

// One pixel of the rendered page, from a PNG screenshot (8-bit RGB(A), one IDAT stream)
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  let i = 8;
  let channels = 3;
  const idat = [];
  while (i < png.length) {
    const len = png.readUInt32BE(i);
    const type = png.toString("ascii", i + 4, i + 8);
    if (type === "IHDR") channels = png[i + 8 + 9] === 6 ? 4 : 3;
    if (type === "IDAT") idat.push(png.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  return [...inflateSync(Buffer.concat(idat)).subarray(1, 1 + channels)].slice(0, 3);
}

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(file, { width = 1280, media = {} } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(5000);
  await page.emulateMedia(media);
  await page.goto(fixtureUrl("media.html"));
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

const style = (page, id, prop, pseudo) => page.evaluate(([id, prop, pseudo]) => getComputedStyle(document.getElementById(id), pseudo)[prop], [id, prop, pseudo]);
const resolve = (page, value) =>
  page.evaluate((value) => {
    const i = document.createElement("i");
    i.style.color = value;
    i.style.forcedColorAdjust = "none";
    document.getElementById("prose").append(i);
    const c = getComputedStyle(i).color;
    i.remove();
    return c;
  }, value);

for (const file of ["peak.css", "peak.scoped.css"]) {
  test(`${file}: prose keeps a readable width; wide media and tables stay inside it`, async () => {
    const page = await open(file, { width: 390 });
    const s = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const t = document.getElementById("wide-table");
      return { prose: r("prose").width, img: r("wide-img").width, tableScrolls: t.scrollWidth > t.clientWidth, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert.ok(s.img <= s.prose, "image fits");
    assert.ok(s.tableScrolls, "the table scrolls");
    assert.equal(s.overflow, 0, "the page doesn't");
    await page.close();
    const wide = await open(file);
    const [prose, chWidth] = await wide.evaluate(() => {
      const s = document.createElement("span");
      s.style.cssText = "display:inline-block; inline-size: 65ch";
      document.getElementById("para").append(s);
      return [document.getElementById("prose").getBoundingClientRect().width, s.getBoundingClientRect().width];
    });
    assert.ok(prose <= chWidth + 1, `measure: ${prose} vs ${chWidth}`);
    await wide.close();
  });

  test(`${file}: code blocks shade an edge with more code beyond it`, async () => {
    const page = await open(file, { width: 390 });
    await page.evaluate(() => document.getElementById("code").scrollIntoView({ block: "center" }));
    const r = await page.evaluate(() => document.getElementById("code").getBoundingClientRect().toJSON());
    const y = Math.round(r.bottom - r.height / 4);
    const sum = (p) => p[0] + p[1] + p[2];
    const plain = sum(await pixel(page, Math.round(r.left + r.width / 2), y));
    const atStart = { right: sum(await pixel(page, Math.round(r.right) - 3, y)), left: sum(await pixel(page, Math.round(r.left) + 3, y)) };
    assert.ok(atStart.right < plain - 6, `shade at the right edge: ${atStart.right} vs ${plain}`);
    assert.ok(Math.abs(atStart.left - plain) <= 3, "no shade at the start");
    await page.evaluate(() => { const c = document.getElementById("code"); c.scrollLeft = c.scrollWidth; });
    await page.waitForTimeout(100);
    const atEnd = { right: sum(await pixel(page, Math.round(r.right) - 3, y)), left: sum(await pixel(page, Math.round(r.left) + 3, y)) };
    assert.ok(Math.abs(atEnd.right - plain) <= 3, "no shade at the end");
    assert.ok(atEnd.left < plain - 6, "shade at the left edge once scrolled");
    await page.close();
  });

  test(`${file}: heading anchors appear on hover and focus; targets clear the sticky header`, async () => {
    const page = await open(file);
    assert.equal(await style(page, "anchor", "opacity"), "0");
    await page.hover("#setup");
    await page.waitForTimeout(400);
    assert.equal(await style(page, "anchor", "opacity"), "1");
    await page.mouse.move(1200, 800);
    await page.focus("#anchor");
    await page.waitForTimeout(400);
    assert.equal(await style(page, "anchor", "opacity"), "1", "keyboard focus");
    const rootSize = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    assert.equal(parseFloat(await style(page, "setup", "scrollMarginTop")), 5 * rootSize);
    await page.close();
  });

  test(`${file}: more contrast: muted text becomes text, borders get stronger`, async () => {
    const normal = await open(file);
    const before = { muted: await style(normal, "muted", "color"), border: await resolve(normal, "var(--peak-border)"), text: await resolve(normal, "var(--peak-text)") };
    await normal.close();
    const more = await open(file, { media: { contrast: "more" } });
    const after = { muted: await style(more, "muted", "color"), border: await resolve(more, "var(--peak-border)") };
    assert.equal(after.muted, before.text, "muted = text");
    assert.notEqual(after.border, before.border, "stronger border");
    await more.close();
  });

  test(`${file}: reduced transparency: no blur behind dialogs`, async () => {
    const page = await open(file);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    const filter = await page.evaluate(() => getComputedStyle(document.getElementById("prose")).getPropertyValue("--pico-modal-overlay-backdrop-filter").trim());
    assert.equal(filter, "none");
    await page.close();
  });

  test(`${file}: forced colors: borders instead of shadows, outline focus, highlighted states`, async () => {
    const page = await open(file, { media: { forcedColors: "active" } });
    assert.equal(await style(page, "card", "borderTopWidth"), "1px");
    assert.equal(await style(page, "badge", "borderTopStyle"), "solid");
    await page.focus("#button");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    assert.equal(await style(page, "button", "outlineStyle"), "solid", "visible focus");
    assert.equal(await style(page, "current-page", "backgroundColor"), await page.evaluate(() => {
      const i = document.createElement("i");
      i.style.cssText = "background-color: Highlight; forced-color-adjust: none";
      document.body.append(i);
      return getComputedStyle(i).backgroundColor;
    }));
    await page.close();
  });

  test(`${file}: print: light scheme on a dark page, no site chrome, external link addresses`, async () => {
    const page = await open(file, { media: { media: "print", colorScheme: "dark" } });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), "light");
    assert.equal(await style(page, "header", "display"), "none");
    assert.match(await style(page, "external", "content", "::after"), /https:\/\/example\.com\/docs/);
    assert.equal(await style(page, "internal", "content", "::after"), "none", "internal links stay as they are");
    assert.equal(await style(page, "card", "boxShadow"), "none");
    await page.close();
  });
}
