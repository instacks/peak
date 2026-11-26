# Peak

[![npm](https://img.shields.io/npm/v/@instacks/peak)](https://www.npmjs.com/package/@instacks/peak)

A zero-JS CSS layer on top of [Blades CSS](https://blades.dev/) (a Pico CSS fork): a small set of
`--peak-*` inputs generates the whole palette, type and spacing, with native popovers, anchor
positioning and entry/exit transitions.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@instacks/peak/dist/peak.min.css" />
```

or `npm install @instacks/peak` and import `@instacks/peak` (minified) or
`@instacks/peak/unminified`.

**Documentation:** <https://instacks.github.io/peak/>, with live examples of every component, a
token reference, a customizer that writes your theme's CSS, and
[example pages](https://instacks.github.io/peak/examples.html) (a landing page, an admin
dashboard, a blog and a shop) built with Peak's classes alone. Build it locally with
`npm run build && npm run docs` (output in `_site/`, `npm run docs:serve` to browse it).

### Scoped build

`peak.scoped.css` (`@instacks/peak/scoped`) styles only what's inside `.peak`, and skips anything
inside `.peak-ignore`. Use it where other code shares the page, such as third-party stacks in a
Stacks 6 site:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@instacks/peak/dist/peak.scoped.min.css" />

<body>
  <header class="peak">…</header>
  <main class="peak">
    …
    <div class="peak-ignore">A third-party stack, left alone</div>
  </main>
</body>
```

- Inputs work the same in both builds: set them on `:root`, `.peak`, `[data-theme]` or
  `[data-peak-scope]`. Only `--peak-*` defaults are declared outside the scope.
- Inherited properties (color, font) still flow into `.peak-ignore`; nothing else does.
- `rem` refers to `<html>`. On a nested `.peak` the fluid root size is off, so text, headings and
  spacing stay in proportion; put `class="peak"` on `<html>` to get it back.
- Needs `@scope`: Chrome/Edge 118+, Safari 17.4+, Firefox 146+. Older browsers ignore the whole
  stylesheet, so the global build is the safer choice for a public site that must support them.

## Theming

Set inputs on `:root`, or on any `[data-theme]` or `[data-peak-scope]` element for one section:

```css
:root {
  --peak-hue: 160;
  --peak-chroma: 0.12;
  --peak-radius: 0.75rem;
}
```

```html
<section data-peak-scope style="--peak-hue: 30">…</section>
<section data-theme="dark">…</section>
```

For designs the derived palette can't match, exact light and dark values replace the derived page
background, surfaces, text, headings, muted text, borders and the secondary fill. Each is outside
the contrast guarantee:

```css
:root {
  --peak-bg-light: #fafaf7;
  --peak-bg-dark: #0e1113;
}
```

<!-- tokens:start (generated from tokens.json) -->
| Input | Default | Range | |
|---|---|---|---|
| `--peak-logo-size` | `2rem` | 1–4rem | Logo size. Height of the logo image in the site title |
| `--peak-hue` | `250` | 0–360 | Brand hue. OKLCH hue of the brand color |
| `--peak-chroma` | `0.16` | 0–0.3 | Brand saturation. OKLCH chroma of the brand color |
| `--peak-brand` | unset | any color | Brand color. Picker path: takes hue and chroma from any color and overrides the two above. Lightness is still set per scheme |
| `--peak-neutral-chroma` | `0.012` | 0–0.04 | Neutral tint. Tints surfaces, text and borders toward the brand hue (or the neutral hue) |
| `--peak-neutral-hue` | unset | 0–360 | Neutral hue. Hue of the neutral tint (surfaces, text, borders, contrast); unset follows the brand hue |
| `--peak-neutral-hue-dark` | unset | 0–360 | Dark neutral hue. Hue of the dark scheme's surfaces and borders, e.g. warm paper in light mode and a cool night in dark mode; unset follows the neutral hue |
| `--peak-ink-hue` | unset | 0–360 | Text hue. Hue of text, headings, muted text and the contrast color; unset follows the neutral ramp |
| `--peak-ink-chroma` | `0.012` | 0–0.04 | Text tint. OKLCH chroma of text; applies only with `--peak-ink-hue` |
| `--peak-secondary-hue` | unset | 0–360 | Secondary hue. Makes secondary a color of its own; unset, secondary is the neutral ramp tinted four times as strongly |
| `--peak-secondary-chroma` | `0.05` | 0–0.3 | Secondary saturation. OKLCH chroma of the secondary color; applies only with `--peak-secondary-hue` |
| `--peak-accent-hue` | `40` | 0–360 | Accent hue. Hue of the accent color, for highlights used sparingly (badges, icons) |
| `--peak-accent-chroma` | `0.18` | 0–0.25 | Accent saturation. OKLCH chroma of the accent color |
| `--peak-accent-color` | unset | any color | Accent color. Picker path for the accent, like `--peak-brand`: hue and chroma come from the color (chroma capped at 0.25), lightness is set per use |
| `--peak-success-hue` | `150` | 0–360 | Success hue. Valid fields, `<ins>` |
| `--peak-warning-hue` | `80` | 0–360 | Warning hue. `<mark>` |
| `--peak-danger-hue` | `27` | 0–360 | Danger hue. Invalid fields, `<del>` |
| `--peak-info-hue` | `235` | 0–360 | Info hue |
| `--peak-status-chroma` | `0.15` | 0–0.25 | Status saturation. Shared by the four status colors |
| `--peak-dark-fills` | `0` | 0 or 1 | Deep fills in dark mode. 1: primary and secondary buttons keep the light scheme's deep fill with white text in dark mode, instead of a light fill with dark text |
| `--peak-bg-light` | unset | any color | Page background, light. Exact light-scheme color for `--peak-bg`, the page background; outside the contrast guarantee. Unset: derived |
| `--peak-bg-dark` | unset | any color | Page background, dark. Exact dark-scheme color for `--peak-bg`, the page background; outside the contrast guarantee. Unset: derived |
| `--peak-surface-light` | unset | any color | Surface, light. Exact light-scheme color for `--peak-surface`: cards, inputs, menus; outside the contrast guarantee. Unset: derived |
| `--peak-surface-dark` | unset | any color | Surface, dark. Exact dark-scheme color for `--peak-surface`: cards, inputs, menus; outside the contrast guarantee. Unset: derived |
| `--peak-text-light` | unset | any color | Text, light. Exact light-scheme color for `--peak-text`, body text; outside the contrast guarantee. Unset: derived |
| `--peak-text-dark` | unset | any color | Text, dark. Exact dark-scheme color for `--peak-text`, body text; outside the contrast guarantee. Unset: derived |
| `--peak-heading-light` | unset | any color | Headings, light. Exact light-scheme color for `--peak-heading` and every heading level; outside the contrast guarantee. Unset: derived |
| `--peak-heading-dark` | unset | any color | Headings, dark. Exact dark-scheme color for `--peak-heading` and every heading level; outside the contrast guarantee. Unset: derived |
| `--peak-muted-light` | unset | any color | Muted text, light. Exact light-scheme color for `--peak-muted`: captions, placeholders, hints; outside the contrast guarantee. Unset: derived |
| `--peak-muted-dark` | unset | any color | Muted text, dark. Exact dark-scheme color for `--peak-muted`: captions, placeholders, hints; outside the contrast guarantee. Unset: derived |
| `--peak-border-light` | unset | any color | Borders, light. Exact light-scheme color for `--peak-border`: rules, card and table borders; outside the contrast guarantee. Unset: derived |
| `--peak-border-dark` | unset | any color | Borders, dark. Exact dark-scheme color for `--peak-border`: rules, card and table borders; outside the contrast guarantee. Unset: derived |
| `--peak-secondary-fill-light` | unset | any color | Secondary fill, light. Exact light-scheme color for `--peak-secondary-fill`: secondary buttons; outside the contrast guarantee. Unset: derived |
| `--peak-secondary-fill-dark` | unset | any color | Secondary fill, dark. Exact dark-scheme color for `--peak-secondary-fill`: secondary buttons; outside the contrast guarantee. Unset: derived |
| `--peak-font-family` | unset | System, Humanist sans, Geometric sans, Transitional serif, Old-style serif, Monospace | Font. Body font stack; unset uses Blades' system stack |
| `--peak-font-family-heading` | unset | Same as body, Humanist sans, Geometric sans, Transitional serif, Old-style serif, Monospace | Heading font. Unset uses `--peak-font-family` |
| `--peak-font-family-mono` | unset | System, Code, Typewriter | Monospace font. Font stack for code, kbd, pre and samp; unset uses Blades' monospace stack |
| `--peak-font-size-min` | `1rem` | 0.875–1.125rem | Text size, small screens. Lower bound of the fluid root size `0.875rem + 0.5vw` |
| `--peak-font-size-max` | `1.3125rem` | 1–1.5rem | Text size, large screens. Upper bound of the fluid root size |
| `--peak-type-ratio` | `1.15` | 1.05–1.5 | Heading scale. h6 is 1rem, each level up multiplies by this |
| `--peak-line-height` | `1.5` | 1.2–1.9 | Line height |
| `--peak-heading-line-height` | `1.2` | 1–1.5 | Heading line height. Line height of `h4`; each level up is 0.025 tighter, each level down 0.025 looser, as in Blades |
| `--peak-font-weight` | `400` | 300–500 | Font weight |
| `--peak-heading-font-weight` | `700` | 400–900 | Heading weight |
| `--peak-display-weight` | unset | 300–900 | H1 weight. Weight of `h1` and `.peak-display`; unset follows `--peak-heading-font-weight` |
| `--peak-subheading-font-weight` | unset | 300–900 | H4–h6 weight. Weight of `h4`–`h6`; unset follows `--peak-heading-font-weight` |
| `--peak-heading-tracking` | `0em` | -0.05–0.05em | Heading letter-spacing. Letter-spacing of `h2`–`h4` and the site title; `h1` gets 4/3 of it and `.peak-display` 5/3, `h5`/`h6` none |
| `--peak-display-size-min` | `2.25rem` | 1.5–3rem | Display size, small screens. Lower bound of `.peak-display`'s fluid size `1rem + 4vw` |
| `--peak-display-size-max` | `3.5rem` | 2.5–5rem | Display size, large screens. Upper bound of `.peak-display`'s fluid size |
| `--peak-button-font-weight` | unset | 300–800 | Button weight. Weight of buttons; unset follows the body weight |
| `--peak-font-smoothing` | `auto` | System default, Antialiased | Font smoothing. `antialiased` renders lighter, thinner text on macOS (WebKit and Chromium) |
| `--peak-code-max-height` | unset | 10–50rem | Code block height. Maximum height of `pre`; taller blocks scroll. Unset: no limit |
| `--peak-spacing` | `1rem` | 0.5–2rem | Spacing. Base rhythm: block spacing, grid gaps, `--peak-space-*` |
| `--peak-section-spacing` | unset | 1–8rem | Section spacing. Space after each `section`; unset follows `--peak-spacing` |
| `--peak-density` | `1` | 0.75–1.25 | Density. Multiplies form, nav and text spacing |
| `--peak-radius` | `0.375rem` | 0–1.5rem | Corner radius |
| `--peak-border-width` | `0.0625rem` | 0–0.25rem | Border width |
| `--peak-outline-width` | `0.125rem` | 0.0625–0.25rem | Focus ring width |
| `--peak-container-sm` | `510px` | 360–544px | Content width ≥ 576px. `.container` width from the 576px breakpoint |
| `--peak-container-md` | `700px` | 480–736px | Content width ≥ 768px |
| `--peak-container-lg` | `950px` | 640–992px | Content width ≥ 1024px |
| `--peak-container-xl` | `1200px` | 800–1248px | Content width ≥ 1280px |
| `--peak-container-2xl` | `1450px` | 960–1504px | Content width ≥ 1536px |
| `--peak-container-max` | `1450px` | 600–2000px | Maximum content width. Caps every breakpoint |
| `--peak-measure` | `65ch` | 40–90ch | Text width. Maximum line length of `.peak-lead` and other running text |
| `--peak-grid-min` | `15rem` | 8–30rem | Grid column minimum. Narrowest column of `.peak-grid-auto`, which fits as many columns as there is room for; set it per grid with `style="--peak-grid-min: …"` |
| `--peak-sidebar-width` | `16rem` | 10–24rem | Sidebar width. Width of the aside in `.peak-with-sidebar` (and the theme's sidebar navigation); set it per layout with `style="--peak-sidebar-width: …"` |
| `--peak-duration` | `200ms` | 0–600ms | Transition duration. 0s under `prefers-reduced-motion: reduce` |
| `--peak-easing` | `ease-in-out` | Ease in-out, Ease, Ease out, Emphasized, Linear | Transition easing |
<!-- tokens:end -->

Lightness is pinned per color scheme, so every text/background pair meets WCAG 2 contrast for any
hue, chroma, neutral tint and status hue in the ranges above (checked by `test/contrast.test.mjs`).

Derived tokens are readable in your own CSS: `--peak-bg`, `--peak-surface`,
`--peak-surface-raised`, `--peak-surface-sunken`, `--peak-text`, `--peak-heading`,
`--peak-muted`, `--peak-border`, `--peak-border-strong`, `--peak-primary` (with `-hover`,
`-hover-bg`, `-focus`, `-subtle`, `-underline`, and `--peak-on-primary`), the same for
`secondary` and `contrast`, `--peak-accent` (with `-hover`, `-fill`, `-hover-bg`, `-subtle`,
and `--peak-on-accent`), `--peak-{success,warning,danger,info}` (with `-hover`, `-subtle`,
`-border`, `--peak-on-*`), `--peak-h1` … `--peak-h6`, and `--peak-space-3xs` … `--peak-space-3xl`.

Peak lives in sub-layers of `@layer peak`, after `@layer blades`:
`peak.tokens`, `peak.base`, `peak.layout`, `peak.components`, `peak.utilities` (later ones win).
Any unlayered CSS overrides all of them; to slot your own rules between Peak's, write them into
a Peak sub-layer, e.g. `@layer peak.components { … }`.

## Layout, cards and badges

```html
<!-- As many columns of at least --peak-grid-min (15rem) as fit; cards line up, footers at the bottom -->
<div class="peak-grid-auto" style="--peak-grid-min: 18rem">
  <article>
    <header><small>Content</small> <span class="peak-badge accent">New</span></header>
    <h3>Poster CMS</h3>
    <p>Blog and multi-purpose content.</p>
    <footer><a href="/poster/" class="peak-card-link">Learn more →</a></footer>
  </article>
</div>

<!-- A wrapping row; the gap is a per-element knob -->
<div class="peak-cluster align-end" style="--peak-gap: 2rem">…</div>

<!-- Full-bleed background band, content stays in the container; a hero -->
<section class="peak-band"><section class="peak-hero">…</section></section>
```

More layouts: `.peak-grid` (at most `--peak-cols` columns, fewer when narrow; `.peak-span-2`,
`-3`, `-full`), `.peak-with-sidebar` (an `aside` beside the content, wrapping when narrow;
`.sticky`), `.peak-media` (image beside text), `.peak-switcher` (one row from
`--peak-switch-at`, 40rem, all stacked below it) and `.peak-card.horizontal` (its image beside
the content from a 32rem card width, a container query).

```html
<!-- Tabs from exclusive details, CSS only (an accordion where ::details-content is missing) -->
<div class="peak-tabs">
  <details name="tabs" open><summary>Overview</summary><p>…</p></details>
  <details name="tabs"><summary>Specs</summary><p>…</p></details>
</div>

<!-- Chips: a link, a filter (hidden checkbox), removable; a callout -->
<label class="peak-chip"><input type="checkbox"> Poster CMS</label>
<aside class="peak-callout warning"><strong>Heads up</strong><p>…</p></aside>
```

Accordions (`<details>`, exclusive with `name`, grouped in `.peak-accordion`) open and close with
an animation where the browser supports it, except with reduced motion. Callouts take the badge
variants.

`.peak-card-link` on one link makes the whole card clickable (other links stay clickable) and
lifts it on hover. Badges: `.peak-badge` with `.secondary`, `.contrast`, `.accent`, `.success`,
`.warning`, `.danger`, `.info`, plus `.solid`, `.outline`, `.dot`; a long label wraps inside its
container. `.peak-card` gives any element
the card look. All of these classes also work on a Stacks container stack's class field.

## Typography

```html
<!-- An eyebrow line before a heading: classless inside hgroup -->
<hgroup>
  <p>Mock-up</p>
  <h2>Our stacks</h2>
</hgroup>
<p class="peak-eyebrow secondary">Elsewhere, with the class</p>

<!-- Display headline (fluid, above h1) and a lead paragraph -->
<h1 class="peak-display">Stacks that <span class="peak-text-primary">just work</span></h1>
<p class="peak-lead">One step of the type scale up, muted, at a readable width.</p>

<!-- A heading's size apart from its level; tabular numbers -->
<h3 class="peak-h5">Small h3</h3>
<p class="peak-tabular">€ 49,00 · 1.284 downloads</p>
```

Code blocks that scroll get a shade along each edge with more code beyond it (CSS only).
`.peak-prose` sets running text (CMS output) at a readable width with media and tables that fit;
`<a class="peak-anchor" href="#id">#</a>` in a heading is a link to it, shown on hover and focus.

Text colors: `.peak-text-primary`, `-secondary`, `-contrast`, `-muted`, `-success`, `-danger`,
`-info`. Alignment by writing direction: `.peak-text-start`, `-center`, `-end`; margin resets
`.peak-mt-0` and `.peak-mb-0`; image fit `.peak-fit-cover` / `.peak-fit-contain` in a box of
`--peak-ratio`. Headings get balanced line breaks, letter-spacing from `--peak-heading-tracking` (h1 4/3
of it, `.peak-display` 5/3) and Blades' per-level line heights around `--peak-heading-line-height`.
Optional weights for h1 (`--peak-display-weight`), h4–h6 (`--peak-subheading-font-weight`) and
buttons (`--peak-button-font-weight`) fall back to the heading or body weight while unset.

## Components

All of these work without JavaScript.

```html
<!-- Menu, anchored to its button, flips at the viewport edges -->
<button popovertarget="actions">Actions</button>
<ul id="actions" popover>
  <li><a href="#">Edit</a></li>
</ul>

<!-- Generic popover: centered by default, anchored with data-peak-anchor -->
<span data-peak-anchor>
  <button popovertarget="info">Info</button>
  <div id="info" popover>…</div>
</span>

<!-- Dialog that fades in and out -->
<button command="show-modal" commandfor="d">Open</button>
<dialog id="d" closedby="any"><article>…</article></dialog>

<!-- Tooltips: anchored and flipping where supported -->
<span data-tooltip="Saved" data-placement="bottom">Status</span>

<!-- Legacy dropdowns keep Pico's positioning unless opted in -->
<details class="dropdown" data-peak-anchor>…</details>

<!-- A drawer at the inline end (.start for the other side); also dialog.peak-wide, .peak-full -->
<dialog class="peak-drawer" id="cart"><article>…</article></dialog>

<!-- A toast in the corner; showing it after an action needs showPopover() -->
<div class="peak-toast success" popover="manual" role="status" id="saved">Saved.</div>

<!-- Stats, steps, avatars, pagination, sidebar navigation -->
<dl class="peak-stats"><div><dt>Downloads</dt><dd>1,284</dd></div></dl>
<ol class="peak-steps"><li>Download</li><li aria-current="step">Install</li><li>Activate</li></ol>
<span class="peak-avatar" role="img" aria-label="Ada Lovelace">AL</span>
<nav class="peak-pagination" aria-label="Pages"><ul><li><a aria-current="page">1</a></li>…</ul></nav>
<aside><nav class="peak-sidebar-nav"><ul><li><a aria-current="page">…</a></li></ul></nav></aside>
```

Two small scripts ship for what CSS can't do. `@instacks/peak/scheme` (`dist/peak-scheme.js`)
remembers a `<select class="peak-scheme">` light/dark choice across pages. Load it in `<head>`
without `defer`; the select works for the current page without it. `@instacks/peak/commands`
(`dist/peak-commands.js`) makes `command`/`commandfor` buttons and `closedby="any"` work in
browsers that don't have them yet (they arrived in 2025); where the browser has them it does
nothing.

## Accessibility preferences

Peak follows the visitor's settings: reduced motion (no transitions, slides or animated
accordions), more contrast (muted text and borders get stronger), reduced transparency (no
blur behind dialogs), and forced colors such as Windows High Contrast (borders where shadows
drew a shape, outline focus rings, highlighted current and selected states). Printing uses the
light scheme, drops the site's navigation and shadows, and prints external link addresses in
prose.

## Browser support

Chrome/Edge 123+, Firefox 128+, Safari 18+. Anchor positioning, `@starting-style` and `overlay`
are progressive enhancements: without them, menus open centered and closing is instant.

## Development

```bash
npm ci
npm run build   # dist/peak(.min).css and dist/peak.scoped(.min).css
npm run watch   # rebuild on change
npm run tokens  # after editing tokens.json: regenerate src/inputs.css and this table
npm test        # Chromium checks; needs Playwright installed (see docs/PLAN.md §8.4)
npm run serve   # http://localhost:8000/index.html
npm run docs    # the documentation site, in _site/ (sources in site/)
```

See `docs/PLAN.md` for the design and roadmap.

## License

MIT
