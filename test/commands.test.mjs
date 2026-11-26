// peak-commands.js (src/js/): command/commandfor and closedby="any" in browsers without them.
// Chromium has both, so the test removes them before the page loads, as an older browser would
// lack them, and checks the script stands in. With them in place, the script must stay out of the way.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, fixtureUrl } from "./helpers.mjs";

let browser;
before(async () => {
  browser = await launch();
});
after(() => browser?.close());

async function open({ native }) {
  const page = await browser.newPage();
  if (!native) {
    await page.addInitScript(() => {
      delete HTMLButtonElement.prototype.command;
      delete HTMLButtonElement.prototype.commandForElement;
      delete HTMLDialogElement.prototype.closedBy;
      // Without the API the browser ignores the attributes: stop its own handling as well
      document.addEventListener("command", (e) => e.preventDefault(), true);
    });
  }
  await page.goto(fixtureUrl("commands.html"));
  await page.waitForLoadState("load");
  return page;
}

const isOpen = (page) => page.evaluate(() => document.getElementById("dialog").open);

for (const native of [false, true]) {
  test(`dialog opens and closes with command/commandfor (${native ? "native" : "the script stands in"})`, async () => {
    const page = await open({ native });
    if (!native) assert.equal(await page.evaluate(() => "command" in HTMLButtonElement.prototype), false, "API removed");
    await page.click("#open");
    assert.equal(await isOpen(page), true, "opened");
    assert.equal(await page.evaluate(() => document.getElementById("dialog").matches(":modal")), true, "as a modal");
    await page.click("#close");
    assert.equal(await isOpen(page), false, "closed by its button");

    await page.click("#open");
    await page.mouse.click(5, 5);
    assert.equal(await isOpen(page), false, "closedby=any: a click outside closes it");

    await page.click("#toggle");
    assert.equal(await page.evaluate(() => document.getElementById("pop").matches(":popover-open")), true, "toggle-popover");
    await page.close();
  });
}
