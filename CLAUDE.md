# CLAUDE.md

Peak (`@instacks/peak`) is a public, CSS-first layer on top of `@sveti/blades` (a Pico CSS
fork), published on npm. It is CSS only, bundled with Lightning CSS. Downstream projects (themes
for page builders) build on the published package and read `dist/*` and `tokens.json`: treat
those files as API, so changing their names or shape is a breaking change. The roadmap and analysis are in `docs/PLAN.md`; read it before changing tokens,
popovers, transitions or the build. Strategy, risks (notably the scoping risk for third-party
stacks) and the prioritized list of missing features are in PLAN §7; verification recipes are in
PLAN Appendix A.

## Layout

```
src/peak.css            entry, global build: layer order + imports (no rules here)
src/peak.scoped.css     entry, scoped build (see below)
tokens.json             single source for the --peak-* inputs (ranges, labels, editor hints); in the npm package
src/inputs.css          GENERATED from tokens.json: @property + :root defaults (never scoped)
src/tokens.css          semantic --peak-* tokens and the --pico-* bridge
src/typography.css      peak.base: headings, eyebrow, .peak-display/-lead/-prose, .peak-anchor, section, pre, img
src/forms.css           peak.base: form element defaults (a field and a button in role="group")
src/utilities.css       peak.utilities: .peak-text-*, .peak-h1…h6, .peak-tabular
src/media.css           peak.utilities: forced colors and print
src/layout.css          peak.layout: section/band/hero, .peak-grid-auto/.peak-grid, cluster, sidebar, media
src/stacks.css          peak.layout: Peak classes on Stacks 6 wrappers (.stacks_in.peak-*, !important)
src/components/*.css    peak.components: card, badge, table, accordion, tabs, chip, callout,
                        pagination, dialog (drawer), toast, stats, steps, avatar, rating, icon
src/js/peak-scheme.js   remembers the light/dark switch (build:js copies src/js/* to dist/)
src/js/peak-commands.js command/commandfor and closedby="any" where the browser lacks them
src/nav.css             peak.components: mobile menu (popover, per-breakpoint blocks), sidebar nav
src/scoped.css          rules for the scoped build only
src/popover-anchor.css  popovers, menus, tooltips and CSS anchor positioning
src/starting-style.css  @starting-style entry/exit transitions for dialog and popover
src/site.css            site chrome classes (.site-nav, .site-main…), stable names for themes
index.html              manual test page (loads dist/peak.css)
test/*.test.mjs         node:test + Playwright checks; fixtures in test/fixtures/
scripts/tokens.mjs      generates src/inputs.css and the README table
scripts/build-scoped.mjs  wraps the scoped bundle in @scope (.peak) to (.peak-ignore)
scripts/watch.mjs       dev rebuild, driven by `node --watch-path=src`
site/pages/*.html       documentation pages: front matter + HTML with <peak-example>, <peak-code>…
site/examples/*.html    example pages: complete documents + front matter, gallery in site/pages/examples.html
site/assets/            docs chrome only (docs.css, docs.js, images); the pages are styled by Peak
scripts/docs.mjs        builds the docs into _site/ (gitignored); .github/workflows/docs.yml
                        publishes it on GitHub Pages from main
docs/PLAN.md            plan, known issues (B1…B20), implementation notes (§8)
.github/workflows/      ci.yml (tests), release.yml (npm publish on a v* tag), docs.yml (Pages)
dist/                   build output (gitignored; published to npm with tokens.json)
```

## Hard rules

- **Never edit upstream.** `node_modules/@sveti/blades/**` is read-only. It is imported whole into
  `@layer blades` from `src/peak.css`. Override it from Peak; don't patch or copy it.
- **All Peak code lives in a `peak.*` sub-layer**, after Blades:
  `@layer blades, peak.tokens, peak.base, peak.layout, peak.components, peak.utilities;` (the
  same statement starts both entries). `peak.tokens`: inputs, tokens and the bridge; `peak.base`:
  element defaults; `peak.layout`: page structure and layout patterns; `peak.components`;
  `peak.utilities` (wins over components regardless of specificity). Every new file is imported
  into one of them in both entries, in that order. Never add unlayered rules: unlayered CSS is
  reserved for Stacks and end users, so they can override Peak.
- **Inputs are edited in `tokens.json`, never in the generated files.** Run `npm run tokens`
  afterwards; `npm test` fails if a generated file is stale. Keep slider ranges within what the
  contrast sweep covers, and extend the sweep when a color range grows. Every input has a `label`
  and a `doc`; one without a default has a `toggle` and a `start` value (the docs' customizer
  and downstream editors build their controls from these). Editor-specific hints don't belong in
  `tokens.json`: downstream projects keep their own, keyed by token name. Adding an input or
  changing a range, step or option is a minor release; renaming or removing one is a major one.
- **Public API = `--peak-*` custom properties**, the classes, and the files in the npm package.
  Inputs are single-unit scalars that map 1:1 to a slider or picker. `--pico-*` assignments are private bridge code. Private helpers use
  `--_peak-*`. Renaming or removing a `--peak-*` token is a breaking change.
- **Redeclare derived tokens and the bridge on theme roots:**
  `:where(:root, :host, [data-theme], [data-peak-scope])`. Blades redeclares `--pico-*` on every
  `[data-theme]`, so a `:root`-only bridge breaks nested themes.
- **Keep Blades' accessibility choices.** Focus rings (`--pico-primary-focus`) stay opaque
  (WCAG 1.4.11). Blades' `prefers-reduced-motion` rule is `!important` in an earlier layer, so it
  always wins; don't try to override it from Peak's layers.

## Two builds

- `dist/peak.css` is global. `dist/peak.scoped.css` applies only inside `.peak` and not inside
  `.peak-ignore`, for pages shared with third-party code (PLAN §8.5).
  A part of a page that is a scope root of its own (a header or footer with class `peak`) needs
  `:scope.x` next to `.x` for rules on the root itself.
- Keep `:(` out of Peak's CSS: a Stacks template that embeds a build would read it as a template
  token (`test/layers.test.mjs` checks).
- Stacks' unlayered `.stacks_in { display: block; margin: 0; padding: 0; overflow: hidden }`
  beats every Peak layer, and a stack's class field puts its class on that `.stacks_in`. Peak
  overrides it only in `src/stacks.css`, with `!important` on `.stacks_in.peak-*` selectors.
- Write theme roots as `:scope`, never `:root`: at the top level `:scope` is the root, inside
  `@scope` it's `.peak`. Selectors can't reach ancestors outside the scope root.
- Keep `@keyframes`, `@property` and `@font-face` at the top level of a file (not inside
  `@supports`/`@media`): the scope script moves them outside `@scope` and fails on nested ones.
- Input defaults belong in `src/inputs.css`, which stays unscoped. They must not reference
  `--pico-*` (those only exist inside the scope there); read such defaults with a `var()` fallback.
- New `src` files must be imported by both entries (or only `src/scoped.css` for scoped-only rules).

## Modern-CSS gotchas (verified; details in docs/PLAN.md §3–4)

- Build targets must be modern (`browserslist` field: Chrome/Edge 123+, Firefox 128+, Safari 18+).
  Broad targets make Lightning CSS polyfill `light-dark()`, which breaks nested and author
  `color-scheme`, and rewrite `:dir()` into `:lang()` lists. After any build-config change, check
  `grep -c 'lightningcss-light' dist/peak.css`; it must be `0`.
- Write `allow-discrete` **inside** the `transition` shorthand
  (`display var(--pico-transition) allow-discrete`). Never use the `transition-behavior` longhand:
  Lightning CSS moves it before the shorthand and it gets reset.
- `@starting-style` blocks go **after** the rules they modify. If Peak sets a property on an open
  state (`:popover-open`, `:modal`, `[open]`), Peak must also provide `@starting-style` for that
  property, because Peak's layer beats Blades' starting styles.
- Gate anchor positioning on the properties actually used:
  `@supports (anchor-name: --a) and (position-area: block-end)`. Gate any reused anchor name on
  `@supports (anchor-scope: --a)`; without it, every popover anchors to the last trigger.
- Use a `var()` origin in relative colors (`oklch(from var(--peak-x) …)`). Static origins are
  computed to fixed colors at build time.
- Logical values (`position-area: block-end span-inline-end`, `inset-inline-*`) are better than
  physical values plus a `:dir()` override.
- `@property` can't register `rem` lengths (initial-value must be computationally independent),
  and registering would freeze `rem` to px at `:root`. Register only `<number>`/`<time>` inputs.
- An unregistered token with `var()` is resolved where it's declared. Derived tokens and the
  bridge must be redeclared on every theme root, and inputs that should stay overridable per
  section (`--peak-brand`) are read with a `var()` fallback instead of getting a `:root` default.
- Keep `light-dark()` outermost; derive each scheme from a plain origin.
- Anchor positioning remembers the last fallback that fit. Don't keep hidden anchored boxes
  rendered (opacity 0): they flip while off-screen and stay flipped. Use `display: none`.
- `::backdrop` (or any pseudo-element) is invalid inside `:is()`; it voids the whole rule.
- Leave legacy `<details class="dropdown">` and `[data-tooltip]` working unchanged. Enhancements
  are behind `@supports` and opt-in where they change positioning (`[data-peak-anchor]`).

## Commands

```bash
npm ci                 # install (Blades + lightningcss-cli)
npm run tokens         # regenerate src/inputs.css and the README table
npm run build          # tokens + dist/peak(.min).css + dist/peak.scoped(.min).css + dist/peak-scheme.js + dist/peak-commands.js
npm test               # stale-output check + build + Chromium checks (incl. scoped and docs)
npm run watch          # rebuild dist/peak.css on change
npm run serve          # http://localhost:8000/index.html (serves repo root; index links dist/peak.css)
npm run docs           # documentation site → _site/ (needs a build first)
npm run docs:serve     # http://localhost:8001/ (serves _site/)
```

- `npm run watch` rebuilds `dist/peak.css` on changes under `src/` (Node's `--watch-path` drives
  the CLI, which has no `--watch` flag).
- Targets come from the `browserslist` field via `--browserslist`. Don't pass `--targets`.
- `npm run update:upstream` bumps Blades and rebuilds. After that, re-check the Blades files Peak
  depends on (PLAN §0) for renamed selectors or variables.

## Verifying changes

`npm test` builds and runs the suite in headless Chromium. Playwright is not a dependency; the
tests use the environment's copy (preinstalled in cloud sessions, found through `NODE_PATH`).
Add a fixture and a test with each change. To verify a change:

1. `npm test` must pass, including the contrast sweep after any color change.
2. Grep `dist/peak.css` to confirm modern syntax survived: `light-dark(`, `oklch(from`,
   `position-area`, `allow-discrete`, `@starting-style`, `:dir(`.
3. For ad-hoc checks, load pages via `page.goto('file://…')`, not `setContent`, so the stylesheet
   loads. The suite already checks:
   - light and dark `colorScheme`
   - a nested `data-theme="dark"` section
   - `transitionBehavior` on transitioned elements
   - popover and anchor rects
4. Do a visual pass with `index.html` in Chrome and Safari for anchor positioning and exit
   transitions; their support differs (`overlay` is Chromium-only).

## Documentation site

`site/` is the public documentation (GitHub Pages), scoped to the CSS framework: no paid theme
settings or Stacks add-on internals. `scripts/docs.mjs` has no dependencies; its header lists the
custom elements a page can use (`<peak-example>` renders a live preview plus the escaped,
highlighted source; `<peak-inputs>` and the customizer are generated from `tokens.json`).

- **Document every new class, input and component knob** (a `var(--peak-x, …)` read with a
  fallback) in a page: `test/docs.test.mjs` fails otherwise. It also checks internal links and
  anchors, console errors, sideways scroll at 390px, the drawer and the customizer.
- Examples are real markup on the page: ids must be unique per page, and `h2`/`h3` inside an
  example are not part of the table of contents.
- `site/assets/docs.css` is unlayered docs chrome on `.docs-*` classes; never style Peak's own
  classes there to make an example look right. Fix Peak instead (that is how B17–B19 were
  found).
- `site/examples/*.html` are whole pages (plan and rules: `docs/EXAMPLES.md`). Their only CSS is
  one `<style data-peak-theme>` that sets `--peak-*` inputs on `:root`, plus `style` attributes
  that set `--peak-*` knobs; the builder fails on anything else, and they never load `docs.css`
  or `docs.js`. If an example needs more, fix Peak or log the gap in PLAN (B24–B36 came from
  this). Front matter `uses` lists the docs pages it demonstrates; links between examples are
  relative, back to the docs with `../`.

## Publishing

- Versions follow semver for the public API above. `release.yml` publishes when a `v*` tag that
  matches `package.json` is pushed (a prerelease such as `1.1.0-beta.1` goes to the `next`
  dist-tag), after the CI tests pass, through npm trusted publishing (no token in the repository).
  **Currently switched off:** the publish job in `release.yml` is commented out because the npm
  step doesn't work yet; a tag only runs the tests until it's fixed and uncommented.
- To release: bump `version` in `package.json` and `package-lock.json` (`npm version x.y.z
  --no-git-tag-version`), commit, then tag `vx.y.z` on main and push the tag.
- `npm pack --dry-run` lists what ships: `dist/` and `tokens.json` (plus README, LICENSE).
  Blades is a dev dependency: the dist files bundle it, with its license headers.
- Never publish from a dirty tree or without `npm test`.

## Conventions

- 2-space indent, double quotes, one declaration per line, kebab-case custom properties.
- Comment *why* (browser quirk, Blades interaction), not *what*.
- Prefer native HTML features (`popover`, `<dialog>`, `closedby`, `command`/`commandfor`) over
  classes or JS. JavaScript only where CSS can't do the job (e.g. remembering the color scheme
  across pages): small opt-in utility scripts, no dependencies, and the CSS side must work
  without them.
- New classes are prefixed `peak-` (`.peak-badge`); Pico's variant names (`.secondary`,
  `.outline`…) stay unprefixed and only apply together with a Peak class. Existing `.site-*`
  names are kept stable for themes and custom CSS written against them.
- Keep `src/peak.css` and `src/peak.scoped.css` to the layer statement and imports.
