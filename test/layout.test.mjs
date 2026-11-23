// Layout patterns, cards and badges (src/layout.css, src/stacks.css, src/components/card.css,
// src/components/badge.css), in both builds, in plain
// HTML and in Stacks' wrapper markup with Stacks' own unlayered CSS.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { launch, fixtureUrl, colorHelpers, contrast } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(file, { width = 1280, colorScheme = "light", reducedMotion = "no-preference" } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion });
  page.setDefaultTimeout(5000);
  await page.goto(fixtureUrl("layout.html"));
  await page.evaluate(async (file) => {
    if (file.includes("scoped")) document.documentElement.classList.add("peak");
    const link = document.querySelector("link[rel=stylesheet]");
    if (link.getAttribute("href").endsWith(file)) return;
    await new Promise((resolve) => {
      link.onload = resolve;
      link.href = `../../dist/${file}`;
    });
  }, file);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  return page;
}

const rect = (page, id) =>
  page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  }, id);
const style = (page, id, prop) => page.evaluate(([id, prop]) => getComputedStyle(document.getElementById(id))[prop], [id, prop]);
const columns = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).gridTemplateColumns.split(" ").length, id);
const px = (v) => parseFloat(v);

// One pixel of the rendered page, read from a PNG screenshot (8-bit RGB(A), one IDAT stream)
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
  const raw = inflateSync(Buffer.concat(idat));
  return [...raw.subarray(1, 1 + channels)].slice(0, 3);
}

for (const file of ["peak.css", "peak.scoped.css"]) {
  test(`${file}: auto grid fits columns to the room, per-grid minimum, one column on a phone`, async () => {
    const wide = await open(file);
    const main = await rect(wide, "main");
    const rootSize = px(await wide.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    const gap = px(await style(wide, "grid", "columnGap"));
    const expected = Math.floor((main.width + gap) / (15 * rootSize + gap));
    assert.equal(await columns(wide, "grid"), Math.min(expected, 5), "15rem columns");
    assert.equal(await columns(wide, "grid-wide"), Math.floor((main.width + gap) / (30 * rootSize + gap)), "--peak-gridmin: 30rem");
    await wide.close();

    const phone = await open(file, { width: 390 });
    assert.equal(await columns(phone, "grid"), 1);
    assert.equal(await columns(phone, "grid-wide"), 1, "a minimum wider than the container still fits");
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "no horizontal overflow");
    await phone.close();
  });

  test(`${file}: cards in a grid share the row height, footers at the bottom, no margins`, async () => {
    const page = await open(file);
    const cards = await Promise.all([1, 2, 3].map((n) => rect(page, `card-${n}`)));
    const footers = await Promise.all([1, 2, 3].map((n) => rect(page, `footer-${n}`)));
    assert.ok(cards.every((c) => Math.abs(c.height - cards[1].height) < 0.5), `heights ${cards.map((c) => c.height)}`);
    assert.ok(footers.every((f, i) => Math.abs(f.bottom - cards[i].bottom) < 0.5), "footers at the card bottom");
    assert.equal(await style(page, "card-1", "marginBottom"), "0px");
    assert.equal(await style(page, "card-3", "marginBottom"), "0px", ".peak-card too (its own margin is in a later layer)");
    // The same in a column grid and a switcher
    for (const [prefix, n] of [["col", 3], ["sw", 2]]) {
      const ids = [...Array(n).keys()].map((i) => i + 1);
      const c = await Promise.all(ids.map((i) => rect(page, `${prefix}-${i}`)));
      const f = await Promise.all(ids.map((i) => rect(page, `${prefix}-footer-${i}`)));
      assert.equal(new Set(c.map((x) => Math.round(x.top))).size, 1, `${prefix}: one row`);
      assert.ok(c.every((x) => Math.abs(x.height - c[1].height) < 0.5), `${prefix}: heights ${c.map((x) => x.height)}`);
      assert.ok(f.every((x, i) => Math.abs(x.bottom - c[i].bottom) < 0.5), `${prefix}: footers at the card bottom`);
      for (const i of ids) assert.equal(await style(page, `${prefix}-${i}`, "marginBottom"), "0px", `${prefix}-${i}: no margin`);
    }
    // A switcher's cards keep its basis: two equal columns, not squeezed by flex: 1
    const [s1, s2] = await Promise.all([rect(page, "sw-1"), rect(page, "sw-2")]);
    assert.ok(Math.abs(s1.width - s2.width) < 0.5, "switcher items share the row equally");
    await page.close();
  });

  test(`${file}: cluster, hero and band`, async () => {
    const page = await open(file);
    const rootSize = px(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    assert.equal(await style(page, "cluster", "display"), "flex");
    assert.equal(await style(page, "cluster", "alignItems"), "end");
    assert.equal(px(await style(page, "cluster", "columnGap")), 2 * rootSize, "--peak-gap");
    // A <div> row has a paragraph's space below it, like a <p class="peak-cluster">
    const gap = (await rect(page, "after-cluster")).top - (await rect(page, "div-cluster")).bottom;
    assert.ok(gap > 0 && Math.abs(gap - px(await style(page, "div-cluster", "marginBottom"))) < 0.5, `space below a div row: ${gap}`);
    assert.ok(px(await style(page, "div-cluster", "marginBottom")) > 0, "a div row has a margin below");
    // A grid of cards is spaced like a card from what follows, except as the last child
    const blockSpacing = px(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--pico-block-spacing-vertical")));
    const gridGap = (await rect(page, "after-grid")).top - (await rect(page, "spaced-grid")).bottom;
    assert.ok(gridGap > 0 && Math.abs(gridGap - px(await style(page, "spaced-grid", "marginBottom"))) < 0.5, `space below a grid: ${gridGap}`);
    assert.ok(px(await style(page, "spaced-grid", "marginBottom")) > 0, `grid margin (block spacing ${blockSpacing})`);
    assert.equal(await style(page, "last-grid", "marginBottom"), "0px", "a last child adds nothing to its section's spacing");

    assert.equal(px(await style(page, "hero", "paddingTop")), 4 * rootSize);
    assert.equal(px(await style(page, "hero", "paddingBottom")), 2.5 * rootSize);
    assert.equal(px(await style(page, "hero", "maxWidth")), 46 * rootSize);
    assert.equal(await style(page, "hero", "marginBottom"), "0px", "no section spacing on top of its padding");

    // The band's background reaches both viewport edges; its content stays in the container
    const band = await rect(page, "band");
    await page.evaluate(() => document.getElementById("band").scrollIntoView({ block: "center" }));
    const b = await rect(page, "band");
    const y = Math.round(b.top + b.height / 2);
    await page.evaluate(colorHelpers);
    const sunken = await page.evaluate(() => {
      const c = resolveColor("var(--peak-surface-sunken)", document.getElementById("band"));
      return [c.r, c.g, c.b];
    });
    for (const x of [1, 1278]) {
      const [r, g, bl] = await pixel(page, x, y);
      assert.ok(Math.abs(r - sunken[0]) + Math.abs(g - sunken[1]) + Math.abs(bl - sunken[2]) <= 3, `band color at x=${x}: ${[r, g, bl]} vs ${sunken}`);
    }
    assert.ok(band.left > 1, "content in the container");
    // Nothing clips what hangs out of the band: a dropdown's last item below its bottom edge
    await page.click("#band-dropdown > summary");
    const last = await rect(page, "band-dropdown-last");
    const after = await rect(page, "band");
    assert.ok(last.bottom > after.bottom, "the dropdown reaches below the band");
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [last.left + 5, (last.top + last.bottom) / 2]);
    assert.equal(hit, "band-dropdown-last", "and is visible and clickable there");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "no horizontal overflow");
    await page.close();
  });

  test(`${file}: a switcher item with wide code or a wide image fits a phone`, async () => {
    const page = await open(file, { width: 390 });
    const sw = await rect(page, "switcher-image");
    for (const id of ["switcher-code", "switcher-figure"]) {
      const item = await rect(page, id);
      assert.ok(item.right <= sw.right + 0.5, `${id} ${item.right} inside the switcher ${sw.right}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "no horizontal overflow");
    await page.close();
  });

  test(`${file}: --peak-media-min keeps a byline beside its avatar in a narrow card`, async () => {
    const page = await open(file);
    const [avatar, text] = [await rect(page, "media-avatar"), await rect(page, "media-text")];
    assert.ok(text.left > avatar.right, "the name is beside the avatar");
    // Without the knob, the 16rem minimum doesn't fit the card and the text wraps below
    const [a2, t2] = [await rect(page, "media-default-avatar"), await rect(page, "media-default-text")];
    assert.ok(t2.top >= a2.bottom, "the default minimum wraps");
    await page.close();
  });

  for (const colorScheme of ["light", "dark"]) {
    test(`${file}: ${colorScheme}: text on a filled band takes the band's text color`, async () => {
      const page = await open(file, { colorScheme });
      await page.evaluate(colorHelpers);
      const result = await page.evaluate(() => {
        const color = (id) => {
          const c = getComputedStyle(document.getElementById(id)).color;
          return resolveColor(c);
        };
        const bg = (id, token) => resolveColor(`var(${token})`, document.getElementById(id));
        return {
          primary: {
            bg: bg("band-primary", "--peak-primary-fill"),
            fg: bg("band-primary", "--peak-on-primary"),
            items: Object.fromEntries(["band-eyebrow", "band-h2", "band-h3", "band-lead", "band-link", "band-muted", "band-text-primary"].map((id) => [id, color(id)])),
          },
          contrast: {
            bg: bg("band-contrast", "--peak-contrast"),
            fg: bg("band-contrast", "--peak-on-contrast"),
            items: Object.fromEntries(["band-contrast-h3", "band-contrast-lead"].map((id) => [id, color(id)])),
          },
        };
      });
      for (const band of Object.values(result)) {
        for (const [id, c] of Object.entries(band.items)) {
          assert.deepEqual([c.r, c.g, c.b], [band.fg.r, band.fg.g, band.fg.b], `${id}: ${c.css}`);
          assert.ok(contrast(c, band.bg) >= 4.5, `${id}: contrast ${contrast(c, band.bg).toFixed(2)}`);
        }
      }
      await page.close();
    });

    test(`${file}: ${colorScheme}: every badge variant is a readable pill`, async () => {
      const page = await open(file, { colorScheme });
      await page.evaluate(colorHelpers);
      const badges = await page.evaluate(() =>
        [...document.querySelectorAll("#badges .peak-badge")].map((el) => {
          const cs = getComputedStyle(el);
          const bg = cs.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.documentElement).backgroundColor : cs.backgroundColor;
          return {
            id: el.id,
            fg: resolveColor(cs.color, el),
            bg: resolveColor(bg, el),
            pill: parseFloat(cs.borderTopLeftRadius) >= el.getBoundingClientRect().height / 2 - 0.5,
            size: parseFloat(cs.fontSize) / parseFloat(getComputedStyle(el.parentElement).fontSize),
            weight: cs.fontWeight,
          };
        }),
      );
      for (const b of badges) {
        assert.ok(contrast(b.fg, b.bg) >= 4.5, `${b.id}: ${contrast(b.fg, b.bg).toFixed(2)}:1`);
        assert.ok(b.pill, `${b.id} is a pill`);
        assert.ok(Math.abs(b.size - 0.75) < 0.01, `${b.id} 0.75em`);
        assert.equal(b.weight, "600");
      }
      const narrow = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const card = document.getElementById("narrow-card");
        const cs = getComputedStyle(card);
        const inner = card.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
        const long = document.getElementById("badge-long");
        const lh = parseFloat(getComputedStyle(long).lineHeight);
        const dot = getComputedStyle(long, "::before");
        return {
          longRight: r("badge-long").right,
          inner,
          longLines: Math.round((r("badge-long").height - 2 * parseFloat(getComputedStyle(long).paddingTop)) / lh),
          dot: [parseFloat(dot.width), parseFloat(dot.height)],
          shortLines: ["badge-short", "badge-short-2"].map((id) => Math.round(r(id).height / lh)),
          shortHeight: r("badge-short").height,
          shortRadius: parseFloat(getComputedStyle(document.getElementById("badge-short")).borderTopLeftRadius),
          scroll: document.documentElement.scrollWidth - innerWidth,
        };
      });
      assert.ok(narrow.longRight <= narrow.inner + 0.5, `a long badge stays inside its card: ${narrow.longRight} > ${narrow.inner}`);
      assert.ok(narrow.longLines >= 2, "it wraps");
      assert.equal(narrow.dot[0], narrow.dot[1], "its dot stays round");
      assert.ok(narrow.dot[0] > 0, "and keeps its size");
      assert.deepEqual(narrow.shortLines, [1, 1], "short badges stay on one line");
      assert.ok(Math.abs(narrow.shortRadius - narrow.shortHeight / 2) < 0.5, "a one-line badge is still a pill");
      assert.equal(narrow.scroll, 0, "no horizontal overflow");
      const tableLines = await page.evaluate(() => {
        const b = document.getElementById("badge-table");
        const label = document.createRange();
        label.selectNodeContents(b);
        return label.getClientRects().length;
      });
      assert.equal(tableLines, 1, "a one-word badge in a squeezed table column stays whole");
      const accent = await page.evaluate(() => [getComputedStyle(document.getElementById("badge-accent")).backgroundColor, resolveColor("var(--peak-accent-fill)").css]);
      assert.equal(accent[0], accent[1], "accent badge uses the accent fill");
      await page.close();
    });
  }

  test(`${file}: a linked card is one click target; other links stay on top; it lifts on hover`, async () => {
    const page = await open(file);
    await page.evaluate(() => document.getElementById("linked").scrollIntoView({ block: "center" }));
    const card = await rect(page, "linked");
    const hit = (x, y) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [x, y]);
    assert.equal(await hit(card.left + 5, card.top + card.height / 2), "card-link", "anywhere on the card is the link");
    const other = await rect(page, "other-link");
    assert.equal(await hit(other.left + other.width / 2, other.top + other.height / 2), "other-link");
    await page.mouse.move(card.left + 10, card.top + card.height / 2);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.getElementById("linked")).transform).m42), -2);
    await page.close();

    const still = await open(file, { reducedMotion: "reduce" });
    await still.evaluate(() => document.getElementById("linked").scrollIntoView({ block: "center" }));
    const c = await rect(still, "linked");
    await still.mouse.move(c.left + 10, c.top + c.height / 2);
    await still.waitForTimeout(100);
    assert.equal(await style(still, "linked", "transform"), "none", "no lift with reduced motion");
    await still.focus("#card-link");
    await still.keyboard.press("Shift+Tab");
    await still.keyboard.press("Tab");
    assert.notEqual(await style(still, "linked", "outlineStyle"), "none", "focus ring on the card");
    await still.close();
  });

  test(`${file}: an image first in a card runs to its edges; .peak-card on any element`, async () => {
    const page = await open(file);
    const card = await rect(page, "image-card");
    const img = await rect(page, "card-image");
    assert.ok(Math.abs(img.left - card.left) < 0.5 && Math.abs(img.right - card.right) < 0.5 && Math.abs(img.top - card.top) < 0.5, "image flush with the card");
    // width/height attributes (against layout shift) must not fix the height once the width bleeds
    assert.ok(Math.abs(img.height - img.width / 2) < 1, `keeps its aspect ratio: ${img.width}×${img.height}`);
    assert.notEqual(await style(page, "div-card", "boxShadow"), "none");
    assert.ok(px(await style(page, "div-card", "paddingTop")) > 0);
    await page.close();
  });

  test(`${file}: table group rows and code in cells`, async () => {
    const page = await open(file, { width: 390 });
    await page.evaluate(colorHelpers);
    const s = await page.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      return {
        group: [cs("group-row").textTransform, cs("group-row").fontWeight, cs("group-row").color, resolveColor("var(--peak-muted)").css],
        groupSize: parseFloat(cs("group-row").fontSize) / parseFloat(getComputedStyle(document.getElementById("table")).fontSize),
        rowHeader: cs("row-header").textTransform,
        codeSize: parseFloat(cs("cell-code").fontSize) / parseFloat(cs("value-cell").fontSize),
        wrap: cs("cell-code").overflowWrap,
        overflow: document.getElementById("table").scrollWidth - document.getElementById("table").clientWidth,
      };
    });
    assert.deepEqual(s.group.slice(0, 2), ["uppercase", "600"]);
    assert.equal(s.group[2], s.group[3], "muted");
    assert.ok(Math.abs(s.groupSize - 0.8) < 0.01);
    assert.equal(s.rowHeader, "none", "a th with scope=row isn't a group label");
    assert.ok(Math.abs(s.codeSize - 0.8) < 0.01);
    assert.equal(s.wrap, "anywhere");
    assert.ok(s.overflow <= 0, "long code wraps instead of widening the table");
    await page.close();
  });

  test(`${file}: Peak classes on Stacks container stacks win over Stacks' wrapper CSS`, async () => {
    const page = await open(file);
    assert.equal(await style(page, "s-grid", "display"), "grid");
    assert.ok((await columns(page, "s-grid")) >= 3);
    assert.equal(await style(page, "s-grid", "overflow"), "visible");
    assert.equal(await style(page, "s-item-1", "overflow"), "visible", "items don't clip shadows or the hover lift");
    const cards = await Promise.all(["s-card-1", "s-card-2", "s-card-3"].map((id) => rect(page, id)));
    assert.ok(cards.every((c) => Math.abs(c.height - cards[1].height) < 0.5), `card heights ${cards.map((c) => c.height)}`);
    const footer = await rect(page, "s-footer-1");
    assert.ok(Math.abs(footer.bottom - cards[0].bottom) < 0.5, "footer at the bottom inside the wrappers");
    assert.ok(px(await style(page, "s-card-3", "paddingTop")) > 0, "a card stack keeps its padding");
    assert.equal(await style(page, "s-card-3", "marginBottom"), "0px");
    assert.equal(await style(page, "s-cluster", "display"), "flex");
    assert.ok(px(await style(page, "s-hero", "paddingTop")) > 0, "a hero stack keeps its padding");
    await page.close();
  });
}
