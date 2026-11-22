// Shared Playwright helpers. Playwright is not a dependency of this package: the tests use the
// copy installed in the environment (cloud sessions preinstall it; locally run
// `npm i -g playwright && npx playwright install chromium`, with NODE_PATH pointing at global modules).
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function fixtureUrl(name) {
  return pathToFileURL(path.join(root, "test", "fixtures", name)).href;
}

export async function launch() {
  let playwright;
  try {
    playwright = require("playwright");
  } catch {
    throw new Error(
      "Playwright not found. Install it globally (npm i -g playwright && npx playwright install chromium) " +
        "and make sure NODE_PATH includes your global node_modules.",
    );
  }
  return playwright.chromium.launch();
}

// Resolve any CSS color (oklch, light-dark, var()) to 8-bit sRGBA the way the page paints it.
export const colorHelpers = `
  window.__probe = document.createElement("i");
  document.body.append(__probe);
  window.__canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  window.resolveColor = (value, host = document.body) => {
    host.append(__probe);
    __probe.style.color = value;
    const c = getComputedStyle(__probe).color;
    __canvas.clearRect(0, 0, 1, 1);
    __canvas.fillStyle = "#000";
    __canvas.fillStyle = c;
    __canvas.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = __canvas.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255, css: c };
  };
`;

export function luminance({ r, g, b }) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// Bounding box of a tooltip bubble painted rgb(255 0 255), found in a viewport screenshot after
// hovering the element: computed insets don't expose where an anchored ::before is drawn.
export async function bubble(page, id) {
  // Scroll instantly and move the mouse ourselves: Playwright's hover re-scrolls between its
  // hit test and the move, which lands on neighbors of these small inline targets.
  const c = await page.evaluate((id) => {
    const el = document.getElementById(id);
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(300);
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async (png) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement("canvas");
    [c.width, c.height] = [img.width, img.height];
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let box = null;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (data[i] > 240 && data[i + 1] < 30 && data[i + 2] > 240) {
          box ??= { left: x, top: y, right: x, bottom: y };
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x + 1);
          box.top = Math.min(box.top, y);
          box.bottom = Math.max(box.bottom, y + 1);
        }
      }
    }
    return box;
  }, png);
}

// One pixel of the rendered page as [r, g, b], from a PNG screenshot (8-bit RGB(A), one IDAT)
export async function pixel(page, x, y) {
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
