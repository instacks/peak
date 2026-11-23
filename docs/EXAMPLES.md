# Example page layouts: plan

Status: **planned, not started** (23 Nov 2026). This file is the handoff for the session that
builds it. Read `CLAUDE.md` and the "Documentation site" part of it first; this plan follows its
rules.

## Goal

Full example pages for the documentation site (GitHub Pages) that show Peak used on whole pages,
not single components:

| # | Example | Pages |
|---|---|---|
| 1 | Landing page | `landing.html` |
| 2 | Admin dashboard | `dashboard.html` |
| 3 | Blog | `blog.html` (index), `blog-post.html` (article) |
| 4 | Shop | `shop.html` (listing), `product.html` (product detail) |

Decided with the maintainer: the landing page is in scope (Peak's downstream users build themes
for page builders, so a marketing page is the most common real use); blog and shop get two pages
each (the listing and the detail page are different layouts).

## Decisions

### 1. Separate full pages, not `<peak-example>` blocks

A docs page already has a site header, a sidebar, `<main>`, a table of contents and a footer
(`layout()` in `scripts/docs.mjs`). An example inside `<peak-example>` would nest a second
`.site-header` and `<main>` in it, its `h2`s would go into the docs' table of contents (the heading
pass only skips `h2`/`h3` *inside* `<peak-example>`, but ids still have to be unique per page), and
it would be squeezed into the content column. The point of these examples is how the page chrome
(`.site-header`, `.site-main`, `.peak-with-sidebar`, drawer, `.site-footer`) fits together, so each
example is a complete HTML document of its own.

### 2. Where the files go

```
site/examples/*.html          source: complete documents (doctype, head, body) + front matter
site/pages/examples.html      gallery page in the docs (new sidebar group "Examples")
_site/examples/*.html         build output, next to _site/assets/
```

- **Front matter** on each example, same `key: value` format as `site/pages/*`:
  `title`, `description`, `order`, `uses` (space-separated list of docs pages it demonstrates,
  e.g. `cards.html navigation.html data.html`). The gallery page is generated from it, so adding
  an example needs no edit to `examples.html` beyond what the builder generates.
- **Build** (`scripts/docs.mjs`): read `site/examples/*.html`, strip the front matter, write to
  `_site/examples/`. The source references the stylesheet as `../assets/peak.min.css` and the
  script as `../assets/peak-scheme.js` directly (no rewriting: the relative paths are right in
  `_site/examples/`). Inject the same one-line inline script the docs pages have in `<head>` (the
  `peak-docs-theme` localStorage reader in `layout()`), so a theme saved in the customizer applies
  to the examples too. Pull that script out into a constant shared by both. Do **not** load
  `docs.css` or `docs.js` on examples: they must be styled by Peak alone.
- **Sidebar**: add `"Examples"` to `GROUPS` in `scripts/docs.mjs`, between `"Components"` and
  `"Reference"`. One page in it, `site/pages/examples.html` (`title: Examples`, `group: Examples`,
  `order: 1`, probably `wide: true`).
- **Header**: add an "Examples" link to the docs header (`docs-header-link`, next to Docs and
  Customize in `layout()`).
- **Introduction** (`site/pages/index.html`): one link to the gallery, e.g. in "What Peak is" or as
  a fourth card under "At a glance".

### 3. The gallery page (`site/pages/examples.html`)

New custom element, expanded by `docs.mjs` like the others (document it in the header comment of
`docs.mjs`):

```
<peak-examples></peak-examples>
```

For each example (sorted by `order`): an `h2` with the title (so it lands in the table of
contents), the description, a live preview, and actions:

- Preview: `<iframe src="examples/x.html" loading="lazy" title="…">` in a docs-chrome wrapper
  (`.docs-frame` in `site/assets/docs.css`: full width of the main column, fixed height around
  32rem, border and radius like `.docs-preview`). The iframe is a real viewport, so a narrow
  column shows the example's narrow layout; that is fine and worth one sentence on the page.
- Actions (`.peak-cluster`): "Open full page" (`role="button"`, `href="examples/x.html"`) and
  "View source" (`https://github.com/instacks/peak/blob/main/site/examples/x.html`).
- "Built with": links to the pages in `uses`.
- The example's own inputs (see "Per-example theme" below) as a highlighted CSS code block: the
  builder copies the contents of the example's `<style data-peak-theme>` element verbatim (front
  matter can't hold multi-line CSS).

### 4. Rules for the example pages

- **Only Peak's classes, no custom CSS.** The single exception is one
  `<style data-peak-theme>` block in `<head>` that sets `--peak-*` inputs on `:root` (that is the
  example's theme, and it is what users would write). If an example looks wrong without extra
  CSS, that is a gap or a bug in Peak: fix it in `src/` (with a fixture and a test) or record it
  in `docs/PLAN.md` (§5 as B22… for bugs, §7.3 for missing features). This is how B17–B19 were
  found while building the docs.
- **No JavaScript** beyond `peak-scheme.js` (the light/dark `<select class="peak-scheme">` in the
  header). Use `popover`/`popovertarget`, `<dialog>` with `command`/`commandfor` and `closedby`,
  `<details name>` for accordions and tabs. A toast is shown by a button with
  `popovertarget` (toasts are `popover="manual"`, see `src/components/toast.css`).
- Every page: `lang`, `<meta name="viewport">`, `<meta name="color-scheme" content="light dark">`,
  a `.peak-skip-link` to `#content`, a `.site-header` with `.site-nav`, the mobile menu
  (`.site-menu-toggle` / `.site-menu-popover`, see `site/pages/navigation.html`), a
  `.site-footer`. Navigation links between the example pages work (blog ↔ post, shop ↔ product,
  every page → back to the docs gallery `../examples.html`); other links go to `#`.
- Placeholder content is neutral and invented (no real brands, people or products). Images: reuse
  `site/assets/landscape.svg` and `product.svg` (`../assets/…`); add more SVG placeholders there if
  needed, keep them small. Give images `width`/`height` and `alt`.
- Must fit a 390px phone with no sideways scroll; wide tables go in `.overflow-auto`.
- Must work in both schemes and with any customizer theme (the iframes inherit the saved theme).
- **Per-example theme**: each example sets a few inputs in its `<style data-peak-theme>` to show
  the range of one set of inputs. A theme saved in the customizer is set as inline styles on
  `<html>` and wins over it, which is the intended behavior. Check the exact input names in
  `tokens.json` before writing them (font, radius, density, hue…).

## Content of each example

The lists are the components to show; adjust the details while building, keep the coverage.

### 1. Landing page (`landing.html`)

Theme: default hue, maybe a display font input.

- Header: logo + title, nav links, dropdown (`ul[popover]` menu), "Sign up" button, scheme switch,
  mobile menu.
- Hero: eyebrow (`hgroup`), `.peak-display`, `.peak-lead`, `.peak-cluster` of two buttons, in a
  `.peak-band`; an image beside it via `.peak-switcher` or `.peak-grid`.
- Logo strip / social proof: `.peak-cluster` of muted text or SVGs.
- Features: `.peak-grid-auto` of cards with icons, one `.peak-card-link`.
- Stats: `.peak-stats`.
- How it works: `.peak-steps`.
- Pricing: three cards in `.peak-grid-auto`, the middle one highlighted (`.peak-badge accent`
  "Popular", a variant card), price in `.peak-tabular`, feature lists, buttons.
- Testimonials: cards with `.peak-media` + `.peak-avatar`, `blockquote`.
- FAQ: `.peak-accordion` (`<details name>`).
- CTA: `.peak-band primary` with a short form (email input + button, `role="group"`).
- Footer: `.site-footer-nav` columns, `.site-footer-text`, `.site-back-to-top`.

### 2. Admin dashboard (`dashboard.html`)

Theme: lower `--peak-density`, neutral/low chroma, smaller radius.

- Header: `.site-header` (sticky, `.nav-sticky`), search input, a user menu on a `.peak-avatar`
  button (`ul[popover]`).
- Layout: `.container-fluid` + `.peak-with-sidebar` with `.peak-sidebar-nav` (sections, current
  item `aria-current="page"`, counts as `.peak-badge`); on phones the nav also opens as a
  `.peak-drawer start` (same pattern as the docs' drawer in `layout()`).
- Main: `.site-breadcrumb`; `h1` + `.peak-cluster` of actions; `.peak-tabs` for the period
  (Today / 7 days / 30 days).
- KPIs: `.peak-stats`.
- "Goals": native `<meter>` / `<progress>` rows. **No chart**: Peak has no chart component; note
  it in PLAN §7.3 as a candidate, don't invent one in the example.
- Recent orders: `<table class="striped">` in `.overflow-auto`, numbers `.peak-tabular` and
  `.peak-text-end`, status `.peak-badge` (success/warning/danger), a row-action menu per row
  (`ul[popover]` with `[data-peak-anchor]`, check `anchor-scope` works with many triggers),
  `.peak-pagination`.
- Side column (`.peak-grid` with `.peak-span-*`, or a second `.peak-with-sidebar`): activity list
  with `.peak-avatar` / `.peak-avatar-group`; onboarding `.peak-steps`; a `.peak-callout warning`.
- "New customer" button → `<dialog closedby="any">` with a form (`.peak-wide` maybe); its submit
  button shows a `.peak-toast success` (`popovertarget`).
- Filters above the table: `.peak-chip`s.

### 3a. Blog index (`blog.html`)

Theme: serif heading font (if there is an input for it), warmer hue.

- Header + mobile menu; hero in a `.peak-band` (`.peak-hero`, `.peak-lead`).
- Featured post: horizontal card (see `site/pages/cards.html`, "Horizontal card"), linked to
  `blog-post.html`.
- Tag filter: `.peak-chip` row (`.peak-cluster`).
- Post grid: `.peak-grid-auto` of image cards (bleeding image, `.peak-card-link`), tag
  `.peak-badge`, author line with `.peak-avatar` + date (`<time>`).
- `.peak-pagination`.
- Newsletter: `.peak-band` with an email form.
- Footer.

### 3b. Blog post (`blog-post.html`)

- `.site-breadcrumb` (Blog › Category).
- Article header: eyebrow, `h1`, `.peak-lead`, author row (`.peak-media` + `.peak-avatar`, name,
  date, reading time).
- `.peak-with-sidebar sticky`: the article body in `.peak-prose` (paragraphs, `h2`/`h3` with
  `.peak-anchor` links, lists, `figure` + `figcaption`, `blockquote`, `pre><code`, inline `code`,
  `kbd`, a table, a `.peak-callout info`), and an aside with an "On this page" `.peak-sidebar-nav`
  (wraps above the article on phones).
- After the article: tags as `.peak-chip`s, author card, previous/next links (cards like the docs
  pager), related posts in `.peak-grid-auto`.
- `.site-back-to-top`, footer.

### 4a. Shop listing (`shop.html`)

Theme: warm hue, larger `--peak-radius`.

- Header with a cart button (count `.peak-badge`) that opens the cart drawer.
- `.site-breadcrumb`; `h1` + result count; sort `<select>`.
- `.peak-with-sidebar`: filters in the aside: `<details>` groups (category checkboxes, price range
  `input[type=range]`, color radios), "Apply"; active filters as removable `.peak-chip`s above the
  grid.
- Product grid: `.peak-grid-auto` of image cards linked to `product.html`: name, price
  (`.peak-tabular`, old price in `<s>` + `.peak-text-muted`), "Sale" / "New" `.peak-badge`.
- `.peak-pagination`.
- Cart: `<dialog class="peak-drawer end" closedby="any">`: line items (`.peak-media` with image),
  quantity input, a summary table (`.peak-tabular`), `.peak-steps` (Cart › Shipping › Payment),
  "Checkout" button.

### 4b. Product page (`product.html`)

- `.site-breadcrumb`.
- `.peak-switcher` (or `.peak-grid`): image(s) on one side, details on the other: `h1`, price,
  rating as text for now, short description, variant choice (radios styled as `.peak-chip`s or a
  `<fieldset>`), size `<select>`, quantity `input[type=number]`, "Add to cart" button that shows a
  `.peak-toast success` with a link to the cart, shipping `.peak-callout`.
- `.peak-tabs`: Description (`.peak-prose`), Specifications (striped table), Reviews (cards with
  `.peak-avatar`).
- "You may also like": `.peak-grid-auto` of product cards.
- Same cart drawer as the listing.

## Likely gaps (to confirm while building, not to build up front)

Record each one that is real in `docs/PLAN.md` §7.3 (or §5 if it's a bug), and decide per item
whether it becomes a Peak component (new class → docs page section → test) or stays out of scope.

- Charts (dashboard).
- A full-height app shell: sticky full-height sidebar with only the main area scrolling.
- Star rating display (shop, reviews).
- Quantity stepper (shop).
- Product image gallery with thumbnails (product page).
- Price with old price / discount styling.

## Tests (`test/docs.test.mjs`)

The suite only reads `.html` files at the top level of `_site/` (`readdirSync(out)`), so
`_site/examples/` is not covered today. Change it to include `examples/*.html`:

- internal links and `src` resolve (paths relative to the example's folder; the current check
  uses `path.join(out, target)` and must resolve against the file's directory instead);
- no console errors, no sideways scroll at 390px and 1280px, Peak's stylesheet loaded;
- the gallery page has one iframe per example and every "Open full page" link resolves;
- a theme saved by the customizer applies inside an example (extend the customizer test:
  after setting `--peak-hue` to 30, open `examples/landing.html` and read it);
- the class/input coverage tests stay as they are (examples count as documentation only if they
  are in `all`; decide whether to add them, so a class documented only by an example doesn't
  pass).

Add a fixture + test in the relevant `test/*.test.mjs` for every Peak fix found on the way, as
`CLAUDE.md` requires.

## Order of work

1. Builder: `GROUPS` += "Examples", copy `site/examples/` → `_site/examples/` with front matter
   stripped and the theme script injected, `<peak-examples>`, `.docs-frame` in `docs.css`, header
   link. Gallery page + one minimal example to prove the pipeline. Extend `test/docs.test.mjs`.
   `npm test` green.
2. Landing page.
3. Admin dashboard.
4. Blog index + post.
5. Shop listing + product.
6. After each: `npm test`, a visual pass at 390px and 1280px in light and dark (Chromium via
   Playwright, screenshots in the scratchpad), Safari if available; log or fix gaps.
7. Link from `site/pages/index.html`; mention in `README.md` if it lists the docs sections; add a
   `CLAUDE.md` line under "Layout" (`site/examples/*.html`) and under "Documentation site" (the
   no-custom-CSS rule for examples).

No change to `src/`, `dist/` or `tokens.json` is needed for the pipeline itself, so steps 1–5 are a
docs-only change (no release) unless a Peak fix comes out of them; such fixes are a patch or minor
release under the usual rules.
