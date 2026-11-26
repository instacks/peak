// Column grid, sidebar layout, media object (src/layout.css), tabs, accordion, chips and callouts
// (src/components/*.css), in both builds and on Stacks'
// wrapper markup with Stacks' own CSS.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl, colorHelpers, contrast, pixel } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open(file, { width = 1280, reducedMotion = "no-preference", colorScheme = "light" } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion, colorScheme });
  page.setDefaultTimeout(5000);
  await page.goto(fixtureUrl("patterns.html"));
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

const rect = (page, id) => page.evaluate((id) => document.getElementById(id).getBoundingClientRect().toJSON(), id);
const style = (page, id, prop) => page.evaluate(([id, prop]) => getComputedStyle(document.getElementById(id))[prop], [id, prop]);
const columns = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).gridTemplateColumns.split(" ").length, id);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const file of ["peak.css", "peak.scoped.css"]) {
  test(`${file}: column grid: --peak-cols columns at most, fewer when narrow, spans only where they fit`, async () => {
    const wide = await open(file);
    assert.equal(await columns(wide, "grid"), 3, "default 3");
    assert.equal(await columns(wide, "grid-4"), 4, "--peak-cols: 4");
    const grid = await rect(wide, "grid");
    const span2 = await rect(wide, "span-2");
    const full = await rect(wide, "span-full");
    assert.ok(span2.width > grid.width * 0.6, "span-2 covers two of three columns");
    assert.ok(Math.abs(full.width - grid.width) < 1, "span-full covers the row");
    await wide.close();

    const tablet = await open(file, { width: 700 });
    assert.ok((await columns(tablet, "grid-4")) < 4, "fewer columns than asked when they would be narrower than the minimum");
    await tablet.close();

    const phone = await open(file, { width: 390 });
    assert.equal(await columns(phone, "grid"), 1);
    const g = await rect(phone, "grid");
    const s = await rect(phone, "span-2");
    assert.ok(s.width <= g.width + 0.5, "a span never adds a column");
    assert.equal(await overflow(phone), 0);
    await phone.close();
  });

  test(`${file}: sidebar layout side by side, wrapped when narrow, in either order; sticky`, async () => {
    const wide = await open(file);
    const rootSize = parseFloat(await wide.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    const [aside, content] = [await rect(wide, "aside"), await rect(wide, "content")];
    assert.ok(Math.abs(aside.top - content.top) < 1 && aside.right <= content.left, "aside beside the content");
    assert.ok(Math.abs(aside.width - 16 * rootSize) < 2, `aside 16rem (${aside.width})`);
    const [c2, a2] = [await rect(wide, "content-2"), await rect(wide, "aside-2")];
    assert.ok(Math.abs(a2.top - c2.top) < 1 && c2.right <= a2.left, "aside after the content");
    assert.equal(await style(wide, "aside-2", "position"), "sticky");
    const [a3, c3] = [await rect(wide, "aside-3"), await rect(wide, "content-3")];
    assert.ok(Math.abs(a3.top - c3.top) < 1 && c3.right <= a3.left, ".end: the first-written aside shown after the content");
    await wide.close();

    const phone = await open(file, { width: 390 });
    const [a, c] = [await rect(phone, "aside"), await rect(phone, "content")];
    assert.ok(c.top >= a.bottom, "stacked");
    assert.equal(await overflow(phone), 0);
    // Wrapped, a sticky aside would slide over the content while scrolling
    assert.equal(await style(phone, "aside-2", "position"), "static", "not sticky while wrapped");
    const [a4, c4] = [await rect(phone, "aside-3"), await rect(phone, "content-3")];
    assert.ok(a4.top >= c4.bottom, ".end: wrapped below the content");
    await phone.close();
  });

  test(`${file}: media object beside, then below its text`, async () => {
    const wide = await open(file);
    const [img, text] = [await rect(wide, "media-img"), await rect(wide, "media-text")];
    assert.ok(text.left >= img.right && Math.abs(text.top - img.top) < 1);
    assert.ok(parseFloat(await style(wide, "media", "marginBottom")) > 0, "spaced like a paragraph");
    const [ei, et] = [await rect(wide, "media-end-img"), await rect(wide, "media-end-text")];
    assert.ok(ei.left >= et.right && Math.abs(ei.top - et.top) < 1, ".end: the image after the text");
    await wide.close();
    const narrow = await open(file, { width: 300 });
    const [i, t] = [await rect(narrow, "media-img"), await rect(narrow, "media-text")];
    assert.ok(t.top >= i.bottom, "text wraps below");
    const [ni, nt] = [await rect(narrow, "media-end-img"), await rect(narrow, "media-end-text")];
    assert.ok(ni.top >= nt.bottom, ".end: the image wraps below the text");
    await narrow.close();
  });

  test(`${file}: tabs: one row of tabs, one panel, switching, the open tab stays open`, async () => {
    const page = await open(file);
    const tops = await Promise.all(["sum-1", "sum-2", "sum-3"].map(async (id) => Math.round((await rect(page, id)).top)));
    assert.equal(new Set(tops).size, 1, `tabs in one row: ${tops}`);
    const visible = () => page.evaluate(() => ["panel-1", "panel-2", "panel-3"].map((id) => document.getElementById(id).getBoundingClientRect().height > 0));
    assert.deepEqual(await visible(), [true, false, false]);
    const [tabs, panel] = [await rect(page, "tabs"), await rect(page, "panel-1")];
    assert.ok(panel.top > (await rect(page, "sum-1")).bottom && panel.left - tabs.left < 20, "panel below the tabs, from the start edge");
    await page.click("#sum-2");
    assert.deepEqual(await visible(), [false, true, false]);
    // The open tab ignores pointer events, so click its spot directly (page.click would wait forever)
    const s2 = await rect(page, "sum-2");
    await page.mouse.click(s2.left + s2.width / 2, s2.top + s2.height / 2);
    assert.deepEqual(await visible(), [false, true, false], "clicking the open tab doesn't close it");
    assert.equal(await style(page, "sum-2", "borderBottomColor"), await page.evaluate(() => { const i = document.createElement("i"); i.style.color = "var(--pico-primary)"; document.getElementById("tabs").append(i); return getComputedStyle(i).color; }));
    await page.close();
  });

  // B37: labels that don't fit on one line used to widen the grid, and the panel, past the page
  test(`${file}: tabs: labels on one line when there's room, wrapped between words when not`, async () => {
    const ids = ["long-1", "long-2", "long-3"];
    const wide = await open(file);
    const lineHeight = parseFloat(await style(wide, "long-1", "lineHeight"));
    for (const id of ids) assert.ok(parseFloat(await style(wide, id, "height")) < lineHeight * 2, `${id} on one line when wide`);
    await wide.close();

    const narrow = await open(file, { width: 390 });
    assert.equal(await overflow(narrow), 0, "no sideways scroll");
    const tabs = await rect(narrow, "tabs-long");
    assert.ok(tabs.right <= 390 && (await rect(narrow, "long-panel")).right <= tabs.right + 0.5, `tabs and panel inside the page: ${tabs.right}`);
    const tops = await Promise.all(ids.map(async (id) => Math.round((await rect(narrow, id)).top)));
    assert.equal(new Set(tops).size, 1, `still one row: ${tops}`);
    const wrapped = await Promise.all(ids.map(async (id) => parseFloat(await style(narrow, id, "height")) > lineHeight * 1.5));
    assert.ok(wrapped.includes(true), "labels wrap");
    await narrow.close();
  });

  test(`${file}: accordions open with an animation, not with reduced motion; dropdowns untouched`, async () => {
    const page = await open(file);
    await page.click("#acc-1 > summary");
    await page.waitForTimeout(60);
    const mid = (await rect(page, "acc-1")).height;
    await page.waitForTimeout(600);
    const end = (await rect(page, "acc-1")).height;
    assert.ok(mid < end - 5, `grows over time: ${mid} → ${end}`);
    assert.ok((await rect(page, "acc-panel")).height > 0);
    // The item's padding is the space below an open item; its last paragraph adds none
    assert.equal(await style(page, "acc-last", "marginBottom"), "0px");
    await page.click("#dropdown > summary");
    await page.waitForTimeout(400);
    assert.ok((await rect(page, "dropdown-link")).height > 0, "the dropdown's menu isn't clipped");
    await page.close();

    const still = await open(file, { reducedMotion: "reduce" });
    const closed = (await rect(still, "acc-1")).height;
    await still.click("#acc-1 > summary");
    await still.waitForTimeout(30);
    assert.ok((await rect(still, "acc-1")).height > closed + 20, "opens at once");
    await still.close();
  });

  test(`${file}: chips: selectable through a hidden checkbox, a 24px remove target`, async () => {
    const page = await open(file);
    await page.evaluate(colorHelpers);
    const tint = await page.evaluate(() => resolveColor("var(--peak-primary-tint)").css);
    assert.notEqual(await style(page, "chip-check", "backgroundColor"), tint);
    await page.click("#chip-check");
    assert.equal(await page.evaluate(() => document.getElementById("chip-input").checked), true);
    assert.equal(await style(page, "chip-check", "backgroundColor"), tint, "checked look");
    assert.ok((await rect(page, "chip-input")).width <= 1, "checkbox not drawn");
    const button = await rect(page, "chip-button");
    assert.ok(button.width >= 24 && button.height >= 24, `remove target ${button.width}×${button.height}`);
    assert.ok((await rect(page, "chip-link")).height >= 32 - 0.5, "chips at least 2rem tall");
    assert.equal(await style(page, "chip-current", "backgroundColor"), tint, "a link chip to the current page looks selected");
    assert.notEqual(await style(page, "chip-not-current", "backgroundColor"), tint, "aria-current=false doesn't");
    await page.close();
  });

  for (const colorScheme of ["light", "dark"]) {
    test(`${file}: ${colorScheme}: callouts: readable title and text on each tint, a colored edge`, async () => {
      const page = await open(file, { colorScheme });
      await page.evaluate(colorHelpers);
      const callouts = await page.evaluate(() =>
        [...document.querySelectorAll("main > .peak-callout")].map((el) => {
          const cs = getComputedStyle(el);
          return {
            id: el.id,
            bg: resolveColor(cs.backgroundColor, el),
            text: resolveColor(getComputedStyle(el.querySelector("p")).color, el),
            title: resolveColor(getComputedStyle(el.querySelector("strong")).color, el),
            edge: parseFloat(cs.borderInlineStartWidth),
          };
        }),
      );
      assert.equal(callouts.length, 7);
      for (const c of callouts) {
        assert.ok(contrast(c.text, c.bg) >= 4.5, `${c.id} text ${contrast(c.text, c.bg).toFixed(2)}`);
        assert.ok(contrast(c.title, c.bg) >= 4.5, `${c.id} title ${contrast(c.title, c.bg).toFixed(2)}`);
        assert.ok(c.edge >= 3, `${c.id} edge`);
      }
      await page.close();
    });
  }

  test(`${file}: switcher: one row when wide, all stacked when narrow, five items always stacked`, async () => {
    const tops = (page, ids) => Promise.all(ids.map(async (id) => Math.round((await rect(page, id)).top)));
    const wide = await open(file);
    assert.equal(new Set(await tops(wide, ["sw-1", "sw-2", "sw-3"])).size, 1, "one row");
    const five = await tops(wide, ["sw5-1", "sw5-2"]);
    assert.ok(five[1] > five[0], "five items stack");
    const s = await tops(wide, ["s-sw-1", "s-sw-2"]);
    assert.equal(s[0], s[1], "on a Stacks container stack too");
    await wide.close();
    const narrow = await open(file, { width: 500 });
    const t = await tops(narrow, ["sw-1", "sw-2", "sw-3"]);
    assert.ok(t[0] < t[1] && t[1] < t[2], `stacked: ${t}`);
    await narrow.close();
  });

  test(`${file}: horizontal card: image beside the content when wide, above it when narrow`, async () => {
    const page = await open(file);
    const [card, img, title] = [await rect(page, "h-card"), await rect(page, "h-img"), await rect(page, "h-title")];
    assert.ok(title.left >= img.right && Math.abs(img.left - card.left) < 1 && Math.abs(img.top - card.top) < 1, "image at the start edge, beside the title");
    assert.ok(Math.abs(img.bottom - card.bottom) < 1, "image fills the card's height");
    const [nImg, nTitle] = [await rect(page, "h-img-narrow"), await rect(page, "h-title-narrow")];
    assert.ok(nTitle.top >= nImg.bottom, "narrow card: image above");
    await page.close();
  });

  test(`${file}: pagination: a row of boxes at least 2.5rem, the current page filled`, async () => {
    const page = await open(file);
    await page.evaluate(colorHelpers);
    const boxes = await Promise.all(["page-prev", "page-1", "page-2", "page-gap", "page-9"].map((id) => rect(page, id)));
    const rootSize = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    assert.equal(new Set(boxes.map((b) => Math.round(b.top))).size, 1, "one row");
    assert.ok(boxes.every((b) => b.width >= 2.5 * rootSize - 0.5 && b.height >= 2.5 * rootSize - 0.5), "2.5rem boxes");
    const current = await page.evaluate(() => {
      const cs = getComputedStyle(document.getElementById("page-2"));
      return [resolveColor(cs.color), resolveColor(cs.backgroundColor), resolveColor("var(--peak-primary-fill)").css];
    });
    assert.equal(current[1].css, current[2], "filled with the primary fill");
    assert.ok(parseFloat(await style(page, "pagination", "marginBottom")) > 0, "spaced from what follows");
    assert.ok(contrast(current[0], current[1]) >= 4.5);
    await page.close();
  });

  test(`${file}: drawer slides in at the inline end (start, RTL), full height; wide and full dialogs`, async () => {
    const page = await open(file);
    const vw = 1280;
    const vh = 900;
    const show = (id) => page.evaluate((id) => document.getElementById(id).showModal(), id);
    const hide = (id) => page.evaluate((id) => document.getElementById(id).close(), id);
    // Wait for the entry transitions to end, not a fixed time: a busy CI runner can still be
    // scaling the dialog in after 400ms
    const settle = () => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished)));
    await show("drawer");
    await page.waitForTimeout(30);
    const early = await rect(page, "drawer-panel");
    await settle();
    const panel = await rect(page, "drawer-panel");
    const rootSize = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    assert.ok(early.left > panel.left + 1, `slides in: ${early.left} → ${panel.left}`);
    assert.ok(Math.abs(panel.right - vw) < 1 && Math.abs(panel.top) < 1 && Math.abs(panel.height - vh) < 1, "full height at the end edge");
    assert.ok(Math.abs(panel.width - 24 * rootSize) < 1, "24rem");
    await hide("drawer");
    for (const id of ["drawer-start", "drawer-rtl"]) {
      await show(id);
      await settle();
      const r = await rect(page, `${id}-panel`);
      assert.ok(Math.abs(r.left) < 1, `${id} at the left edge`);
      await hide(id);
    }
    await show("wide");
    await settle();
    const wide = await rect(page, "wide-panel");
    assert.ok(wide.width > 700 && wide.width <= 64 * rootSize + 1, `wide ${wide.width}`);
    await hide("wide");
    await show("full");
    await settle();
    const full = await rect(page, "full-panel");
    assert.ok(Math.abs(full.width - vw) < 1 && Math.abs(full.height - vh) < 1, "full screen");
    await hide("full");

    // closedby switches Blades to its modern modal, where the dialog itself is a centered box
    await show("drawer-cb");
    await settle();
    const cb = await rect(page, "drawer-cb-panel");
    assert.ok(Math.abs(cb.right - vw) < 1 && Math.abs(cb.top) < 1 && Math.abs(cb.height - vh) < 1, `closedby drawer: ${JSON.stringify(cb)}`);
    assert.ok(Math.abs(cb.width - 24 * rootSize) < 1, "closedby drawer: 24rem");
    await hide("drawer-cb");
    await show("drawer-start-cb");
    await settle();
    assert.ok(Math.abs((await rect(page, "drawer-start-cb-panel")).left) < 1, "closedby drawer at the start");
    await hide("drawer-start-cb");
    await show("wide-cb");
    await settle();
    const wideCb = await rect(page, "wide-cb-panel");
    assert.ok(wideCb.width > 700 && wideCb.width <= 64 * rootSize + 1, `closedby wide ${wideCb.width}`);
    await hide("wide-cb");
    await show("full-cb");
    await settle();
    const fullCb = await rect(page, "full-cb-panel");
    assert.ok(Math.abs(fullCb.width - vw) < 1 && Math.abs(fullCb.height - vh) < 1, `closedby full screen ${JSON.stringify(fullCb)}`);
    await page.close();

    const still = await open(file, { reducedMotion: "reduce" });
    await still.evaluate(() => document.getElementById("drawer").showModal());
    await still.waitForTimeout(30);
    assert.ok(Math.abs((await rect(still, "drawer-panel")).right - 1280) < 1, "no slide with reduced motion");
    await still.close();
  });

  test(`${file}: site title with a logo: logo, title, subtitle and links on one line`, async () => {
    const page = await open(file);
    const mid = async (id) => {
      const r = await rect(page, id);
      return (r.top + r.bottom) / 2;
    };
    const logo = await mid("logo-img");
    for (const id of ["logo-text", "logo-subtitle", "logo-link"]) {
      const m = await mid(id);
      assert.ok(Math.abs(m - logo) < 3, `${id} centered on the logo: ${m} vs ${logo}`);
    }
    await page.close();

    // On a phone the subtitle wraps; the logo and the title text keep their room
    const phone = await open(file, { width: 360 });
    await phone.evaluate(() => document.getElementById("logo-header").querySelector("nav > ul:last-child").insertAdjacentHTML("beforeend", "<li><a href='#'>About us</a></li><li><a href='#'>Contact</a></li>"));
    const t = await phone.evaluate(() => {
      const title = document.getElementById("logo-title");
      return { scroll: title.scrollWidth, client: title.clientWidth, img: document.getElementById("logo-img").getBoundingClientRect().width, imgHeight: document.getElementById("logo-img").getBoundingClientRect().height, textRight: document.getElementById("logo-text").getBoundingClientRect().right, subLeft: document.getElementById("logo-subtitle").getBoundingClientRect().left };
    });
    assert.ok(t.scroll <= t.client + 1, `title not squeezed: ${JSON.stringify(t)}`);
    assert.ok(Math.abs(t.img - t.imgHeight) < 1, `the square logo stays square: ${t.img}×${t.imgHeight}`);
    assert.ok(t.subLeft >= t.textRight - 1, `subtitle after the title, not over it: ${JSON.stringify(t)}`);
    await phone.close();
  });

  test(`${file}: a field and a button in a group: the label stays on one line; buttons alone still share`, async () => {
    const page = await open(file);
    const r = await page.evaluate(() => {
      const label = document.createRange();
      label.selectNodeContents(document.getElementById("group-button"));
      const lines = label.getClientRects().length;
      const shrink = [...document.getElementById("button-group").children].map((b) => getComputedStyle(b).flexShrink);
      return { lines, shrink, inputW: document.getElementById("group-input").getBoundingClientRect().width };
    });
    assert.equal(r.lines, 1, "button label on one line");
    assert.ok(r.inputW > 0, "the field keeps some room");
    assert.deepEqual(r.shrink, ["1", "1"], "a group of buttons alone is unchanged");
    await page.close();
  });

  test(`${file}: mobile menu: a row when wide; a centered toggle and a stacked popover when narrow`, async () => {
    const page = await open(file);
    const wide = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).closest("li").getBoundingClientRect().toJSON();
      return { toggle: getComputedStyle(document.getElementById("menu-toggle")).display, one: r("menu-link-1"), two: r("menu-link-2") };
    });
    assert.equal(wide.toggle, "none");
    assert.ok(Math.abs(wide.one.top - wide.two.top) < 0.5 && wide.two.left >= wide.one.right - 0.5, "links in a row");
    await page.close();

    const phone = await open(file, { width: 390 });
    const mid = async (id) => {
      const r = await rect(phone, id);
      return (r.top + r.bottom) / 2;
    };
    const title = await mid("menu-title");
    for (const id of ["menu-toggle", "menu-select"]) {
      const m = await mid(id);
      assert.ok(Math.abs(m - title) < 2, `${id} centered on the title: ${m} vs ${title}`);
    }
    assert.equal(await phone.isVisible("#menu-link-1"), false);
    await phone.click("#menu-toggle");
    await phone.waitForTimeout(400);
    const [toggle, one, two] = await phone.evaluate(() =>
      ["menu-toggle", "menu-link-1", "menu-link-2"].map((id) => (document.getElementById(id).closest("li") ?? document.getElementById(id)).getBoundingClientRect().toJSON()),
    );
    assert.ok(one.top >= toggle.bottom - 1, "the menu opens below its toggle");
    assert.ok(two.top >= one.bottom - 1, "links stacked");
    await phone.close();
  });

  test(`${file}: header styles: background and rule to the viewport edges; a dropdown hangs out of the header`, async () => {
    const page = await open(file);
    await page.evaluate(() => {
      const h = document.getElementById("bordered-header");
      h.dataset.navStyle = "surface";
      h.scrollIntoView({ block: "center" });
    });
    await page.evaluate(colorHelpers);
    const colors = await page.evaluate(() => {
      const h = document.getElementById("bordered-header");
      const rgb = (v) => {
        const c = resolveColor(v, h);
        return [c.r, c.g, c.b];
      };
      return { surface: rgb("var(--peak-surface)"), rule: rgb("var(--pico-muted-border-color)"), bg: rgb("var(--peak-bg)") };
    });
    const h = await rect(page, "bordered-header");
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 3);
    for (const x of [1, 1278]) {
      const inside = await pixel(page, x, Math.round(h.top + h.height / 2));
      assert.ok(near(inside, colors.surface), `surface at x=${x}: ${inside} vs ${colors.surface}`);
      const below = await pixel(page, x, Math.ceil(h.bottom));
      assert.ok(near(below, colors.rule), `rule below at x=${x}: ${below} vs ${colors.rule}`);
      const under = await pixel(page, x, Math.ceil(h.bottom) + 3);
      assert.ok(near(under, colors.bg), `page below the rule at x=${x}: ${under} vs ${colors.bg}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "no horizontal overflow");
    await page.click("#header-dropdown > summary");
    const last = await rect(page, "header-dropdown-last");
    assert.ok(last.top > h.bottom, "the dropdown's last item is below the header");
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [last.left + 5, (last.top + last.bottom) / 2]);
    assert.equal(hit, "header-dropdown-last", "visible and clickable below the header");
    await page.close();
  });

  test(`${file}: sidebar nav: current link marked, other branches closed, group labels spaced; a meter as wide as a progress bar`, async () => {
    const page = await open(file);
    const r = await page.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      return {
        currentWeight: cs("sidenav-current").fontWeight,
        currentEdge: cs("sidenav-current").borderInlineStartColor,
        primary: getComputedStyle(document.body).getPropertyValue("--pico-primary"),
        openChild: cs("sidenav-open-child").display,
        hiddenChild: document.getElementById("sidenav-hidden-child").closest("ul").checkVisibility(),
        labelGap: box("sidenav-label").top - box("sidenav-list-1").bottom,
        firstLabelMargin: parseFloat(cs("sidenav-first-label").marginBlockStart),
        labelSize: parseFloat(cs("sidenav-label").fontSize),
        root: parseFloat(getComputedStyle(document.documentElement).fontSize),
        transform: cs("sidenav-label").textTransform,
        meter: box("meter").width,
        progress: box("progress").width,
      };
    });
    assert.equal(Number(r.currentWeight), 600);
    assert.notEqual(r.openChild, "none", "the current branch is open");
    assert.equal(r.hiddenChild, false, "other branches are closed");
    assert.ok(r.labelGap > r.root, `space above a group label: ${r.labelGap}`);
    assert.equal(r.firstLabelMargin, 0, "none above the first");
    assert.ok(Math.abs(r.labelSize - 0.75 * r.root) < 0.01, `label size ${r.labelSize}`);
    assert.equal(r.transform, "uppercase");
    assert.ok(Math.abs(r.meter - r.progress) < 0.5, `meter ${r.meter} vs progress ${r.progress}`);
    await page.close();
  });

  test(`${file}: a form's submit button in a dialog footer sits in the row with the others`, async () => {
    const page = await open(file);
    await page.evaluate(() => document.getElementById("form-dialog").showModal());
    await page.waitForTimeout(300);
    const [cancel, submit] = await Promise.all([rect(page, "dialog-cancel"), rect(page, "dialog-submit")]);
    assert.ok(Math.abs(cancel.top - submit.top) < 1 && submit.left > cancel.right, `one row: ${JSON.stringify({ cancel, submit })}`);
    await page.close();
  });

  test(`${file}: rating: filled up to the value, from the inline start, clamped to five stars`, async () => {
    const page = await open(file);
    await page.evaluate(() => document.getElementById("rating-2").scrollIntoView({ block: "center" }));
    await page.evaluate(colorHelpers);
    const colors = await page.evaluate(() => {
      const el = document.getElementById("rating-2");
      const rgb = (v) => {
        const c = resolveColor(v, el);
        return [c.r, c.g, c.b];
      };
      return { fill: rgb("var(--_peak-rating-fill)"), empty: rgb("var(--peak-border-strong)") };
    });
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 12);
    // The middle of star n, measured along the glyphs, at the vertical middle of the line
    const star = async (id, n) => {
      const r = await rect(page, id);
      return pixel(page, Math.round(r.left + (r.width * (n - 0.5)) / 5), Math.round(r.top + r.height * 0.55));
    };
    assert.ok(near(await star("rating-2", 1), colors.fill), `first star filled: ${await star("rating-2", 1)} vs ${colors.fill}`);
    assert.ok(near(await star("rating-2", 5), colors.empty), `last star empty: ${await star("rating-2", 5)} vs ${colors.empty}`);
    assert.ok(near(await star("rating-rtl", 5), colors.fill), "right to left, the rightmost star is filled");
    assert.ok(near(await star("rating-rtl", 1), colors.empty), "and the leftmost empty");
    assert.ok(near(await star("rating-over", 5), colors.fill), "a value over 5 fills all five");
    await page.close();
  });

  for (const colorScheme of ["light", "dark"]) {
    test(`${file}: ${colorScheme}: the stars' fill has 3:1 on the page and on cards, across the warning inputs`, async () => {
      const page = await open(file, { colorScheme });
      await page.evaluate(colorHelpers);
      const low = await page.evaluate(() => {
        const el = document.getElementById("rating-2");
        const out = [];
        for (let hue = 0; hue < 360; hue += 30) {
          for (const chroma of [0, 0.1, 0.25]) {
            document.documentElement.style.setProperty("--peak-warning-hue", hue);
            document.documentElement.style.setProperty("--peak-status-chroma", chroma);
            out.push({ hue, chroma, fill: resolveColor("var(--_peak-rating-fill)", el), bg: resolveColor("var(--peak-bg)", el), surface: resolveColor("var(--peak-surface)", el) });
          }
        }
        return out;
      });
      const failing = low
        .map((x) => ({ ...x, bg: contrast(x.fill, x.bg), surface: contrast(x.fill, x.surface) }))
        .filter((x) => x.bg < 3 || x.surface < 3)
        .map((x) => `hue ${x.hue} chroma ${x.chroma}: ${x.bg.toFixed(2)} / ${x.surface.toFixed(2)}`);
      assert.deepEqual(failing, []);
      await page.close();
    });
  }

  test(`${file}: footer columns: a heading above stacked links; a plain footer nav is a row`, async () => {
    const page = await open(file);
    // The list items: Pico pads nav links and pulls them out by the same amount
    const [heading, one, two, row1, row2] = await page.evaluate(() =>
      ["fcol-heading", "fcol-1", "fcol-2", "frow-1", "frow-2"].map((id) => {
        const el = document.getElementById(id);
        return (el.closest("li") ?? el).getBoundingClientRect().toJSON();
      }),
    );
    assert.ok(one.top >= heading.bottom, "the links below the heading");
    assert.ok(two.top >= one.bottom && Math.abs(two.left - one.left) < 0.5, "one link per line");
    assert.ok(Math.abs(one.left - heading.left) < 0.5, `links start under the heading: ${one.left} vs ${heading.left}`);
    assert.ok(Math.abs(row1.top - row2.top) < 0.5 && row2.left > row1.right, "a row without .stacked");
    // Muted text and links (Pico colors p and ul itself); the current page in the text color
    await page.evaluate(colorHelpers);
    const c = await page.evaluate(() => {
      const color = (id) => getComputedStyle(document.getElementById(id)).color;
      return { text: color("footer-text"), link: color("frow-1"), current: color("frow-current"), muted: resolveColor("var(--peak-muted)").css, body: resolveColor("var(--peak-text)").css };
    });
    assert.equal(c.text, c.muted, "footer text muted");
    assert.equal(c.link, c.muted, "footer links muted");
    assert.equal(c.current, c.body, "the current page in the text color");
    await page.close();
  });

  test(`${file}: toast in the inline-end bottom corner, with its status edge`, async () => {
    const page = await open(file);
    await page.evaluate(() => document.getElementById("toast").showPopover());
    await page.waitForTimeout(400);
    const t = await rect(page, "toast");
    const rootSize = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    assert.ok(Math.abs(1280 - t.right - rootSize) < 1.5 && Math.abs(900 - t.bottom - rootSize) < 1.5, `corner ${t.right},${t.bottom}`);
    await page.evaluate(colorHelpers);
    const edge = await page.evaluate(() => [getComputedStyle(document.getElementById("toast")).borderInlineStartColor, resolveColor("var(--peak-success)").css]);
    assert.equal(edge[0], edge[1]);
    await page.click("#toast button");
    assert.equal(await page.evaluate(() => document.getElementById("toast").matches(":popover-open")), false, "closes");
    await page.close();
  });

  test(`${file}: stats, steps and avatars`, async () => {
    const page = await open(file);
    await page.evaluate(colorHelpers);
    const [label, value, third] = [await rect(page, "stat-label"), await rect(page, "stat-value"), await rect(page, "stat-3")];
    assert.ok(value.bottom <= label.top + 1, "number above its label");
    assert.ok(Math.abs(third.top - value.top) < 1, "in columns");
    const steps = await page.evaluate(() => ["step-1", "step-2", "step-3"].map((id) => {
      const cs = getComputedStyle(document.getElementById(id), "::before");
      return [cs.content, cs.backgroundColor];
    }));
    const fill = await page.evaluate(() => resolveColor("var(--peak-primary-fill)").css);
    assert.equal(steps[0][0], '"✓"', "done");
    assert.equal(steps[1][1], fill, "current filled");
    assert.notEqual(steps[2][0], '"✓"', "upcoming numbered");
    const avatars = await page.evaluate(() => {
      const el = document.getElementById("avatar-1");
      const cs = getComputedStyle(el);
      return {
        size: [el.getBoundingClientRect().width, el.getBoundingClientRect().height],
        radius: cs.borderTopLeftRadius,
        fg: resolveColor(cs.color, el),
        bg: resolveColor(cs.backgroundColor, el),
        overlap: document.getElementById("avatar-2").getBoundingClientRect().left < el.getBoundingClientRect().right,
      };
    });
    const rootSize = parseFloat(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    assert.ok(Math.abs(avatars.size[0] - 2.5 * rootSize) < 0.5 && avatars.size[0] === avatars.size[1]);
    assert.equal(avatars.radius, "50%");
    assert.ok(contrast(avatars.fg, avatars.bg) >= 4.5, "initials readable");
    assert.ok(avatars.overlap, "group overlaps");
    await page.close();
  });

  test(`${file}: on Stacks container stacks: grid, sidebar (sticky works), media, callout, last text in a box`, async () => {
    const page = await open(file);
    assert.equal(await style(page, "s-grid", "display"), "grid");
    assert.equal(await style(page, "s-sidebar", "display"), "flex");
    assert.equal(await style(page, "s-sidebar", "overflow"), "visible", "an overflow: hidden ancestor would stop sticky");
    const [a, c] = [await rect(page, "s-aside"), await rect(page, "s-content")];
    assert.ok(Math.abs(a.top - c.top) < 1 && a.right <= c.left, "sidebar stack beside the content stack");
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("s-aside").parentElement).position), "sticky");
    assert.equal(await style(page, "s-media", "display"), "flex");
    assert.ok(parseFloat(await style(page, "s-callout", "paddingTop")) > 0);
    // The box's padding is the space below its last text: no paragraph margin on top (B39)
    for (const id of ["s-callout-last", "p-callout-last", "p-panel-last"]) assert.equal(await style(page, id, "marginBottom"), "0px", id);
    assert.equal(await style(page, "s-hide-below", "display"), "block");
    assert.equal(await style(page, "s-hide-from", "display"), "none", "over Stacks' display: block");
    assert.notEqual(await style(page, "s-band", "borderImageSource"), "none", "the band's full-width background survives Stacks' border: 0");
    await page.setViewportSize({ width: 390, height: 800 });
    assert.equal(await style(page, "s-hide-below", "display"), "none");
    assert.equal(await style(page, "s-hide-from", "display"), "block");
    await page.close();
  });
}
