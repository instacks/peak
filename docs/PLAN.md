# Peak — Implementation Plan

Status: steps 1–7 implemented; step 3 resolved as both builds (§8.5), step 7 in §8.6. See §8 for where the
implementation departs from this plan. · Scope: `src/tokens.css`, `src/popover-anchor.css`, `src/starting-style.css`, build config.
Upstream baseline: `@sveti/blades@3.1.4`, `lightningcss-cli@1.33.0`.

Every claim marked **(verified)** below was reproduced against this repository: either by building
with the installed Lightning CSS and grepping `dist/`, or by loading the output in headless Chromium
and reading `getComputedStyle()`. Browser-version numbers not marked verified are from memory and
must be re-checked before they are written into docs.

---

## 0. What Blades already does (don't duplicate it)

Blades 3.1 already ships several features this plan could otherwise reimplement:

| Feature | Upstream location | What it does |
|---|---|---|
| Popover dropdowns | `src/blades/components/_dropdown-popover.css` | Styles `:is(ul, menu)[popover]`. Fades with `overlay`/`display` `allow-discrete`. Has an `@starting-style` entry. Anchors to the **implicit** invoker anchor under `@supports (position-area: bottom)` with `position-try-fallbacks: flip-block, flip-inline`. Falls back to a centered popover. |
| Dialog entry transition | `src/blades/components/_modal-modern.css` | `dialog:modal` opacity fade plus `> article` `transform: scale(.96)` entry. **No exit**: `close()` is instant. |
| `closedby` dialogs | same file | Transparent dialog box. Overlay on `::backdrop` with an `@starting-style` fade-in and its own reduced-motion rule. |
| Legacy dropdown | `src/pico/components/_dropdown.css` | `details.dropdown > summary + ul`, absolutely positioned, `z-index: 99`. |
| Tooltips | `src/pico/components/_tooltip.css` | `[data-tooltip]::before/::after` from `attr(data-tooltip)`. Physical `left/bottom` plus `transform`, and `tooltip-slide` keyframes on hover-capable devices. |
| One palette | `src/pico/_variables.css` | Every `--pico-*` color is a `light-dark()`, declared on `:scope, :host, [data-theme="light"], [data-theme="dark"]`. Dark mode only flips `color-scheme`. |
| Reduced motion | `src/pico/_utilities.css` | `transition-duration: 0s !important` (and 1ms animations) on `*:not([aria-busy=true]):not(.unreduce-motion)` and `::before/::after`. |

Peak's job is to theme, extend, and fix the gaps in these. It should not fork them.

---

## 1. Public token API (`src/tokens.css`)

### 1.1 Design rules

1. **Three tiers.**
   - **Inputs** are scalars a slider or picker sets. They are declared only on `:root` and inherit.
   - **Semantic tokens** are colors and sizes derived from the inputs. Authors may override them; consumers read them.
   - **Bridge** declarations assign `--pico-*`. They are private and never documented as API.
2. **Every input is one value with one unit.** That gives a 1:1 mapping to a slider (`min/max/step`) or color well in any editor. No shorthands, no lists, except font stacks.
3. **Register numeric inputs with `@property`** (`syntax`, `inherits: true`, `initial-value`). A bad slider value then falls back to the initial value instead of invalidating every derived color, and the inputs become animatable. Lightning CSS passes `@property` through untouched **(verified)**. **Only `<number>` and `<time>` inputs are registered; lengths are not (§8.1).**
4. **Redeclare semantic and bridge tokens on every theme root:**
   ```css
   :where(:root, :host, [data-theme], [data-peak-scope]) { /* semantic + bridge */ }
   ```
   This is required, not optional. It fixes current bug B3 (see §5). Blades redeclares every `--pico-*` on each `[data-theme]` element, so Peak must redeclare there too or nested themes revert to Pico blue. It also makes per-section inputs work: `<div data-peak-scope style="--peak-hue: 30">`. A token declared on an element is resolved on that element, so derived tokens are only recomputed where they are redeclared. `:where()` keeps specificity at 0, so unlayered Stacks or user CSS still wins, and `@layer peak` still beats `@layer blades` because layer order is compared before specificity.
5. **Naming:** `--peak-<group>-<name>[-<variant>]`. Variants are `hover`, `focus`, `subtle`, `border`, and `on` (the foreground color for text on that color). Private helpers use `--_peak-*` and are never documented.

### 1.2 Inputs (slider / picker surface)

| Token | Type (`@property`) | Default | Suggested UI range | Notes |
|---|---|---|---|---|
| `--peak-hue` | `<number>` | `250` | 0–360, step 1 | Brand hue |
| `--peak-chroma` | `<number>` | `0.16` | 0–0.30, step 0.005 | Brand chroma; above ~0.3 is out of gamut for most hues |
| `--peak-neutral-chroma` | `<number>` | `0.012` | 0–0.04 | Tints surfaces, text and borders toward the brand hue |
| `--peak-brand` | unregistered | `oklch(60% var(--peak-chroma) var(--peak-hue))` | color well | **Picker path.** Takes any color (hex from a picker). Hue and chroma are read from it; lightness is re-imposed per scheme, see 1.3. When set, the hue and chroma sliders stop having an effect (document this). |
| `--peak-success-hue` | `<number>` | `150` | 0–360 | |
| `--peak-warning-hue` | `<number>` | `80` | 0–360 | |
| `--peak-danger-hue` | `<number>` | `27` | 0–360 | |
| `--peak-info-hue` | `<number>` | `235` | 0–360 | |
| `--peak-status-chroma` | `<number>` | `0.15` | 0–0.25 | Shared chroma for all statuses |
| `--peak-neutral-hue` | unregistered | unset (brand hue) | 0–360 | Hue of the neutral tint, when it shouldn't follow the brand |
| `--peak-secondary-hue` | unregistered | unset (neutral ramp ×4) | 0–360 | Makes secondary a color of its own |
| `--peak-secondary-chroma` | `<number>` | `0.05` | 0–0.3 | Only with `--peak-secondary-hue` |
| `--peak-dark-fills` | `<number>` | `0` | 0 or 1 | 1: deep primary/secondary button fills with white text in dark mode |
| `--peak-font-family` | unregistered | Blades sans stack | font menu | → `--pico-font-family` |
| `--peak-font-family-heading` | unregistered | `var(--peak-font-family)` | font menu | |
| `--peak-font-family-mono` | unregistered | Blades monospace stack | font menu | → `pre, code, kbd, samp` |
| `--peak-font-size-min` | `<length>` | `1rem` | 0.875–1.125rem | Root size at 320px |
| `--peak-font-size-max` | `<length>` | `1.3125rem` | 1–1.5rem | Root size cap |
| `--peak-type-ratio` | `<number>` | `1.15` | 1.067–1.5 | Modular heading scale. 1.15 reproduces Pico's h1–h6 sizes to within 0.03rem. |
| `--peak-line-height` | `<number>` | `1.5` | 1.2–1.9 | |
| `--peak-heading-line-height` | `<number>` | `1.2` | 1–1.5 | |
| `--peak-font-weight` | `<number>` | `400` | 300–500 | |
| `--peak-heading-font-weight` | `<number>` | `700` | 400–900 | |
| `--peak-spacing` | `<length>` | `1rem` | 0.5–2rem | Base rhythm |
| `--peak-density` | `<number>` | `1` | 0.75–1.25 | Multiplier for form, nav and typography spacing |
| `--peak-radius` | `<length>` | `0.375rem` | 0–1.5rem | |
| `--peak-border-width` | `<length>` | `0.0625rem` | 0–0.25rem | |
| `--peak-outline-width` | `<length>` | `0.125rem` | 0.0625–0.25rem | Focus ring width |
| `--peak-container-sm` … `--peak-container-2xl` | `<length>` | `510px 700px 950px 1200px 1450px` | px sliders | Widths at Pico's fixed 576/768/1024/1280/1536 breakpoints |
| `--peak-container-max` | `<length>` | `1450px` | 600–2000px | Single "max content width" slider that caps all breakpoints |
| `--peak-duration` | `<time>` | `200ms` | 0–600ms | |
| `--peak-easing` | unregistered | `ease-in-out` | menu | |

> `@property` caveat: `initial-value` must be computationally independent. `250` and `200ms` are
> fine; `var()` **and `rem`/`em` are not**, so the length inputs stay unregistered (§8.1). That is
> also why `--peak-brand` and the font stacks stay unregistered. The optional hues
> (`--peak-neutral-hue`, `--peak-secondary-hue`) are unregistered for a different reason: unset,
> they make `--_peak-neutral-origin` / `--_peak-secondary-origin` invalid, so the `var()` fallback
> (brand hue, tinted neutral ramp) applies. A registered input would always have a value.

### 1.3 Semantic tokens

Derived colors use relative color syntax. Relative color from a `light-dark()` origin resolves per
scheme in Chromium **(verified: `oklch(from light-dark(red, blue) l c h)` gives red in light and
blue in dark)**. Re-check this in Safari 18+ and Firefox 128+ before publishing the browser floor.

```css
/* Brand: picker hue/chroma, lightness pinned per scheme for predictable contrast */
--peak-primary: light-dark(
  oklch(from var(--peak-brand) 0.54 c h),
  oklch(from var(--peak-brand) 0.70 c h)
);
--peak-primary-hover: light-dark(                     /* TEXT hover: away from the background */
  oklch(from var(--peak-primary) calc(l - 0.07) c h),
  oklch(from var(--peak-primary) calc(l + 0.07) c h)
);
--peak-primary-hover-bg: oklch(from var(--peak-primary) calc(l - 0.06) c h);   /* button hover */
--peak-primary-focus: var(--peak-primary);            /* OPAQUE: keep Blades' WCAG 1.4.11 fix */
--peak-primary-subtle: oklch(from var(--peak-primary) l c h / 0.2);   /* selection, tints */
--peak-primary-underline: oklch(from var(--peak-primary) l c h / 0.5);
--peak-on-primary: light-dark(oklch(0.99 0 0), oklch(0.15 0 0));
```

Renames from the current `tokens.css`: `--peak-card-bg` → `--peak-surface` and
`--peak-primary-inverse` → `--peak-on-primary`. Keep the old names as aliases through 0.x.

Neutrals keep today's formulas: `oklch(L var(--peak-neutral-chroma) var(--peak-hue))` inside
`light-dark()`. Add:

| Token | Light L | Dark L |
|---|---|---|
| `--peak-bg` | 99% | 17% |
| `--peak-surface` (card) | 100% | 21% |
| `--peak-surface-raised` (dropdown, popover) | 100% | 23% |
| `--peak-surface-sunken` (code, inputs) | 97.5% | 19% |
| `--peak-text` | 24% | 91% |
| `--peak-heading` | 20% | 95% |
| `--peak-muted` | 48% | 68% |
| `--peak-border` | 88% | 30% |
| `--peak-border-strong` (form borders) | 82% | 36% |
| `--peak-secondary` | 50% / 4× neutral chroma | 72% |
| `--peak-contrast` | 18% | 94% |

**Status colors.** For each `s` in `success | warning | danger | info`:

```css
--peak-danger: light-dark(
  oklch(0.52 var(--peak-status-chroma) var(--peak-danger-hue)),
  oklch(0.72 var(--peak-status-chroma) var(--peak-danger-hue))
);
--peak-danger-hover:  light-dark(oklch(from var(--peak-danger) calc(l - 0.06) c h),
                                 oklch(from var(--peak-danger) calc(l + 0.06) c h));
--peak-danger-subtle: light-dark(oklch(from var(--peak-danger) 0.96 calc(c * 0.25) h),
                                 oklch(from var(--peak-danger) 0.26 calc(c * 0.35) h));
--peak-danger-border: oklch(from var(--peak-danger) l c h / 0.55);
--peak-on-danger:     light-dark(oklch(0.99 0 0), oklch(0.15 0 0));
```

Warning is the exception. Amber at L≈0.52 reads as brown, so use L≈0.75 / 0.80 and a **dark**
`--peak-on-warning` in both schemes.

**Typography scale** (read-only, derived from the ratio):
`--peak-h6: 1rem; --peak-h5: calc(1rem * var(--peak-type-ratio)); … --peak-h1: calc(1rem * pow(var(--peak-type-ratio), 5))`.
With ratio 1.15 this gives h1 2.01, h2 1.75, h3 1.52, h4 1.32, h5 1.15 and h6 1rem, close to
Pico's 2 / 1.75 / 1.5 / 1.25 / 1.125 / 1. Lightning CSS leaves `pow(var(…))` alone **(verified)**.

**Spacing scale** (read-only): `--peak-space-3xs … --peak-space-3xl` as
`calc(var(--peak-spacing) * {0.25, 0.5, 0.75, 1, 1.5, 2, 3})`.

**Root font size.** `clamp(var(--peak-font-size-min), 0.875rem + 0.5vw, var(--peak-font-size-max))`
reproduces Blades' stepped ramp (17 / 18 / 19 / 20 / 21px at 576 / 768 / 1024 / 1280 / 1536px).
Because it has a `rem` term it still scales with the user's font-size preference (WCAG 1.4.4).

### 1.4 Bridge: `--pico-*` mapping

Everything goes in `@layer peak`. Rows marked *(element)* must be written on that element's
selector, because Blades sets them per element and a `:root` value would be overridden there.

| Pico variable(s) | ← Peak |
|---|---|
| `--pico-background-color` | `--peak-bg` |
| `--pico-color` | `--peak-text` |
| `--pico-muted-color` | `--peak-muted` |
| `--pico-muted-border-color`, `--pico-table-border-color`, `--pico-blockquote-border-color` | `--peak-border` |
| `--pico-text-selection-color` | `--peak-primary-subtle` |
| `--pico-primary` | `--peak-primary` |
| `--pico-primary-background`, `--pico-primary-border` | `--peak-primary` |
| `--pico-primary-underline` | `--peak-primary-underline` |
| `--pico-primary-hover`, `--pico-primary-hover-underline` | `--peak-primary-hover` |
| `--pico-primary-hover-background`, `--pico-primary-hover-border` | `--peak-primary-hover-bg` |
| `--pico-primary-focus` | `--peak-primary-focus` (opaque) |
| `--pico-primary-inverse` | `--peak-on-primary` |
| `--pico-secondary*` (same 9 keys) | `--peak-secondary` family (same derivations as primary) |
| `--pico-contrast*` (same 9 keys) | `--peak-contrast` family |
| `--pico-h1-color` … `--pico-h6-color` | `--peak-heading` for h1–h2, then `color-mix(in oklch, var(--peak-heading), var(--peak-muted) {15,30,45,60}%)` for h3–h6 |
| `--pico-card-background-color`, `--pico-card-sectioning-background-color` | `--peak-surface`, `--peak-surface-sunken` |
| `--pico-card-border-color` | `--peak-border` |
| `--pico-dropdown-background-color` / `-border-color` / `-hover-background-color` / `-color` | `--peak-surface-raised` / `--peak-border` / `--peak-primary-subtle` / `--peak-text` |
| `--pico-code-background-color`, `--pico-code-color` | `--peak-surface-sunken`, `--peak-muted` |
| `--pico-form-element-background-color`, `-active-background-color` | `--peak-surface-sunken`, `--peak-surface` |
| `--pico-form-element-border-color` | `--peak-border-strong` |
| `--pico-form-element-color`, `-placeholder-color` | `--peak-text`, `--peak-muted` |
| `--pico-form-element-selected-background-color` | `--peak-primary-subtle` |
| `--pico-form-element-invalid-border-color` / `-invalid-active-border-color` / `-invalid-focus-color` | `--peak-danger` / `--peak-danger-hover` / `--peak-danger` |
| `--pico-form-element-valid-*` (same 3) | `--peak-success` family |
| `--pico-del-color`, `--pico-ins-color` | `--peak-danger`, `--peak-success` |
| `--pico-mark-background-color`, `--pico-mark-color` | `--peak-warning-subtle`, `--peak-text` |
| `--pico-switch-checked-background-color`, `--pico-range-thumb-active-color`, `--pico-progress-color` | `--peak-primary` |
| `--pico-tooltip-background-color`, `--pico-tooltip-color` | `--peak-contrast`, `--peak-bg` |
| `--pico-modal-overlay-background-color` | `oklch(from var(--peak-bg) l c h / 0.75)` |
| `--pico-border-radius` / `--pico-border-width` / `--pico-outline-width` | `--peak-radius` / `--peak-border-width` / `--peak-outline-width` |
| `--pico-spacing` (also drives block spacing and grid gaps) | `--peak-spacing` |
| `--pico-typography-spacing-vertical` | `calc(1rem * var(--peak-density))` |
| `--pico-form-element-spacing-vertical` / `-horizontal` | `calc(0.75rem * d)` / `calc(1rem * d)` |
| `--pico-nav-element-spacing-*`, `--pico-nav-link-spacing-*` | ×`--peak-density` |
| `--pico-font-family` | `--peak-font-family` |
| `--pico-font-size` (`:root`) | the clamp() above. This replaces Blades' media-query steps, which is intended. |
| `--pico-line-height`, `--pico-font-weight` (`:root`) | `--peak-line-height`, `--peak-font-weight` |
| *(element)* `h1…h6 { --pico-font-size; --pico-line-height; --pico-font-weight; --pico-font-family }` | `--peak-h1…h6`, `--peak-heading-line-height`, `--peak-heading-font-weight`, `--peak-font-family-heading` |
| `--pico-transition` | `var(--peak-duration) var(--peak-easing)` |

**Containers.** Blades hard-codes `.container { max-width: 510px … }` per breakpoint; there is no
variable. Peak redeclares the same five media queries:
`.container { max-width: min(var(--peak-container-md), var(--peak-container-max)); }`.
Breakpoints themselves can't come from `var()`, because media queries don't accept it. Either
document them as fixed or centralize them with `@custom-media` and the CLI's `--custom-media` flag,
which exists in this Lightning CSS version.

**Not mappable:** `--pico-icon-valid`, `--pico-icon-invalid` and `--pico-icon-chevron` are SVG
data URIs with hard-coded strokes, and `var()` can't reach inside `url()`. Either keep Blades'
contrast-checked defaults, or replace them with `mask-image` + `background-color: var(--peak-…)`
in a later phase.

### 1.5 Theme switching

Delete Peak's `color-scheme` declarations and its duplicated `[data-theme]` rules. Blades already
sets `color-scheme: light` on the root, `dark` under `@media only screen and (prefers-color-scheme: dark)`,
and handles `[data-theme]`. Peak's `:root { color-scheme: light dark }` overrides Blades' `only screen`
gate, so print can follow a dark preference (see bug B7). A theme switch emits
`data-theme="light|dark"` on `<html>`, or on a wrapper for per-section themes. That works
once §1.1 rule 4 is in place.

---

## 2. `src/popover-anchor.css`

### 2.1 Gating strategy

- **Use positive `@supports` for enhancements**, and `@supports not` only for fallback-specific fixes.
  The fallback should be "Blades as-is" wherever possible.
- **Gate on the exact properties you use.** `anchor-name` alone isn't enough: Chrome 125–128 shipped
  `anchor-name` with the old `inset-area` / `position-try-options` names. A browser there passes
  `@supports (anchor-name: --a)` but ignores `position-area`. Use:
  ```css
  @supports (anchor-name: --a) and (position-area: block-end) and (position-try-fallbacks: flip-block) { … }
  @supports not ((anchor-name: --a) and (position-area: block-end)) { /* fallback */ }
  ```
- **Gate anything that reuses one anchor name on `anchor-scope`**:
  `@supports (anchor-scope: --a)`. Without `anchor-scope`, every element with
  `anchor-name: --peak-trigger` competes, and **every popover anchors to the last one in the
  document**. That is the most likely real-world bug.
- Lightning CSS keeps `@supports not (anchor-name: --a)`, `anchor()`, `anchor-size()`,
  `anchor-scope`, `position-anchor`, `position-area` and `position-try-fallbacks` intact
  **(verified)**.

### 2.2 Dropdown menus: `:is(ul, menu)[popover]`

Markup contract (unchanged from Blades):
```html
<button popovertarget="m1">Actions</button>
<ul id="m1" popover>…</ul>
```

Peak layers these on top of Blades:

1. **Logical placement.** Use `position-area: block-end span-inline-end` instead of Blades'
   `bottom span-right` plus a `:dir(rtl)` override. Logical keywords follow direction by themselves,
   which also removes the `:dir()` downlevel problem (bug B1).
2. **Better fallbacks.** `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline`.
   The comma list is three separate tries; the last one is the diagonal corner case Blades misses.
3. **Size to the trigger and the viewport.** `min-inline-size: anchor-size(inline)`,
   `max-block-size: calc(100dvh - 2 * var(--peak-spacing))`, `overflow-y: auto`.
4. **Hide when the trigger scrolls away.** `position-visibility: anchor-visible` (renamed from `anchors-visible`, B33).
5. **Explicit scoped anchor as a backup to the implicit one**, inside `@supports (anchor-scope: --a)`:
   ```css
   :where(li, [data-peak-anchor]):has(> [popovertarget]) { anchor-scope: --peak-trigger; }
   :where(li, [data-peak-anchor]) > [popovertarget]      { anchor-name: --peak-trigger; }
   :where(li, [data-peak-anchor]) > [popover]            { position-anchor: --peak-trigger; }
   ```
   This covers popovers opened by `showPopover()` without `{ source }`, and engines that don't
   create an implicit anchor from `popovertarget`. Verify implicit-anchor support per engine; don't
   assume it.
6. **Open-state affordance on the trigger:**
   `[popovertarget]:has(+ :popover-open)` rotates a chevron and sets `--pico-…-background`.
7. **Specificity inside the layer.** Blades' `nav :is(ul,menu)[popover]:not(.does-not-exist)` hack
   doesn't matter to Peak, because the later layer wins. Inside `@layer peak`, though, source order
   matters: keep the base rule, then `@supports` blocks, then `@starting-style`.

Fallback (`@supports not …`): keep Blades' centered popover, and add
`max-inline-size: min(24rem, 100vw - 2 * var(--peak-spacing))` and a light `::backdrop`, so a
centered menu reads as modal-ish rather than lost. On `(pointer: coarse)`, optionally show it as a
bottom sheet (`inset: auto 0 0; margin-inline: auto`).

### 2.3 Legacy `<details class="dropdown">`, backward compatible

- **The default is untouched.** Peak must not set `anchor-name` on bare `summary`. Peak's
  `[popover]` selectors can't match it, because there's no `popover` attribute. It still gets
  Peak's colors through the `--pico-dropdown-*` bridge.
- **Opt-in enhancement** with `details.dropdown[data-peak-anchor]`, inside
  `@supports (anchor-scope: --a) and (position-area: block-end)`:
  ```css
  details.dropdown[data-peak-anchor]                  { anchor-scope: --peak-dd; }
  details.dropdown[data-peak-anchor] > summary        { anchor-name: --peak-dd; }
  details.dropdown[data-peak-anchor] > summary + ul   {
    position: fixed;            /* see below */
    position-anchor: --peak-dd;
    inset: auto; margin: 0;
    position-area: block-end span-inline-end;
    position-try-fallbacks: flip-block, flip-inline;
  }
  ```
  `position: fixed` is needed. With Pico's `position: absolute`, the containing block is the tiny
  `details` box, so position-area and the flip overflow test are measured against it instead of the
  viewport.
- **Known limit:** any ancestor with `transform`, `filter`, `backdrop-filter`, `contain` or
  `will-change: transform` becomes the containing block for `fixed`. Stacks stacks often have one,
  for animations or parallax. That's why this is opt-in. The real fix is to migrate the markup to
  `popover`.

### 2.4 Tooltips: `[data-tooltip]`

**Constraint:** tooltip content is `::before` / `::after` generated from `attr(data-tooltip)`.
CSS can't give a pseudo-element the `popover` attribute, so `[data-tooltip]` can't enter the top
layer. Its upgrade is anchor positioning, not popover. Native popover tooltips need new markup.

**A. Anchored pseudo-element tooltips** (default-on inside `@supports (anchor-scope: --a) and (position-area: block-start)`):
```css
[data-tooltip] { anchor-scope: --peak-tip; anchor-name: --peak-tip; }
[data-tooltip]::before {
  position: fixed;                       /* viewport CB: flip against the viewport, escape overflow clipping */
  position-anchor: --peak-tip;
  inset: auto; left: auto; bottom: auto; transform: none;   /* neutralize Pico's physical offsets */
  margin: 0.25rem;
  position-area: block-start;            /* data-placement=bottom/left/right → block-end/inline-start/inline-end */
  position-try-fallbacks: flip-block;    /* flip-inline for left/right */
  max-inline-size: min(20rem, 100vw - 2rem);
  white-space: normal;
}
[data-tooltip]::after { content: none; } /* caret: see below */
```
Notes for implementing this:
- Pico's hover animation (`tooltip-slide`, `tooltip-caret-slide`) animates `transform` with
  `translate(-50%, …)`. That fights `position-area`. In the anchored block, replace it with a
  Peak keyframe that animates `opacity` and `translate` only.
- **Caret:** `::after` is a second positioned box that flips independently of the bubble, so it
  can point the wrong way. Drop it in anchored mode, or style it only when
  `@container anchored(fallback: flip-block)` is supported. Spike that query before relying on it.
- Spike first: confirm that `::before` can anchor to its originating element in Chromium and
  Safari 26. It should work, because the host is not the containing block once the pseudo is
  `position: fixed`. Add a Playwright fixture that checks the rect.
- Without `anchor-scope`, leave Blades' tooltips completely alone.

**B. Native popover tooltips** (new, opt-in, Chromium-first):
```html
<button interestfor="tip-1">Save</button>
<span id="tip-1" popover="hint" role="tooltip">Saves the draft</span>
```
Style `[popover="hint"], [role="tooltip"][popover]` with the tooltip tokens. Anchor with the
implicit anchor plus `position-area: block-start; position-try-fallbacks: flip-block`. Be honest
in the docs: hover-to-open with zero JS needs `interestfor`, which is Chromium-only as of writing.
Elsewhere the popover only opens via `popovertarget`, which means click. An unknown `popover`
value is treated as `manual`.

### 2.5 Generic `[popover]`

`<div popover>` (as in `index.html`) gets no Blades styling. Peak themes
`[popover]:not(:is(ul, menu, [popover="hint"]))` as a raised surface: `--peak-surface-raised`,
`--peak-border`, `--peak-radius`, padding `--peak-space-s`. It is **not** anchored by default,
because generic popovers are often meant to be centered. Opt in with `[data-peak-anchor]` on the
popover.

### 2.6 Test fixtures (add to `index.html` or `test/fixtures/`)

- Menu near the right edge (flip-inline), near the bottom (flip-block), and in the corner (both).
- Menu inside `nav`, inside `overflow: hidden`, inside a `transform`ed parent, and under `dir="rtl"`.
- Two menus side by side, which catches anchor-name collisions.
- Legacy `details.dropdown`, with and without `data-peak-anchor`.
- Tooltips in all four placements, at the viewport edges, with long text.

---

## 3. `src/starting-style.css`

### 3.1 Rules that apply to the whole file

1. **Write `allow-discrete` per item inside the `transition` shorthand. Never use the
   `transition-behavior` longhand.** Lightning CSS reorders `transition-behavior` *before* the
   shorthand, and the shorthand then resets it **(verified: the source computes
   `allow-discrete`; the Lightning CSS output computes `normal, normal` in Chromium)**. This happens
   with and without `--minify` and targets, and exit transitions silently stop working. Blades'
   style (`display var(--pico-transition) allow-discrete`) survives intact **(verified)**.
2. Put **`@starting-style` blocks after** the rules they modify. They add no specificity, so
   source order decides.
3. **Layer trap.** `@starting-style` rules cascade like normal rules. A Peak rule in the later layer,
   such as `:is(ul,menu)[popover]:popover-open { opacity: 1 }`, beats Blades' `@starting-style`
   in the earlier layer, and Blades menus stop fading in. **Any property Peak sets on an open state
   needs its own Peak `@starting-style` for that property.**
4. Prefer top-level `@starting-style { selector {…} }` over nesting `@starting-style` inside rules.
   That avoids depending on how Lightning CSS flattens nesting if targets ever broaden.
5. Reuse the **same properties Blades animates**: `opacity`, and `transform` on `dialog > article`.
   Overriding them is then clean. Using `scale` while Blades uses `transform: scale()` would
   compound to 0.96 × 0.96.

### 3.2 `<dialog>`: entry and exit

```css
dialog {
  opacity: 0;                                     /* closed state */
  transition:
    opacity var(--pico-transition),
    overlay var(--pico-transition) allow-discrete,
    display var(--pico-transition) allow-discrete;
}
dialog[open] { opacity: 1; }
dialog > article { transform: scale(var(--peak-dialog-scale, 0.96)); transition: transform var(--pico-transition); }
dialog[open] > article { transform: none; }
@starting-style {
  dialog:modal { opacity: 0; }                    /* entry for showModal() only */
  dialog:modal > article { transform: scale(var(--peak-dialog-scale, 0.96)); }
}

dialog::backdrop {
  background-color: transparent;
  transition:
    background-color var(--pico-transition),
    backdrop-filter var(--pico-transition),
    overlay var(--pico-transition) allow-discrete,
    display var(--pico-transition) allow-discrete;
}
dialog:modal::backdrop { background-color: var(--pico-modal-overlay-background-color); }
@starting-style { dialog:modal::backdrop { background-color: transparent; } }
```

Things to handle:
- **Why the transition lives on `dialog`, not `dialog:modal`:** `:modal` stops matching the moment
  `close()` runs. If transitions are only declared there, the exit has none. Blades' entry-only
  behavior comes from exactly this.
- **Why entry uses `:modal` and not `[open]`:** `@starting-style` also applies on the first style
  pass at page load, so `dialog[open]` in the markup would fade in on load. Blades deliberately
  doesn't animate those dialogs either.
- **Pico paints the overlay on the dialog element itself.** It is full-viewport with
  `--pico-modal-overlay-background-color`. So for classic dialogs, fading the dialog fades the
  overlay. Only Blades' `dialog:modal[closedby]` uses `::backdrop`; the backdrop rules above give it
  an exit as well.
- **`overlay` is Chromium-only.** In Safari and Firefox, the exit runs outside the top layer. Pico's
  `position: fixed; z-index: 999` keeps it on top in practice. Document it as "exit may be instant
  or unlayered in non-Chromium browsers".
- **Pico modal JS compatibility:** the `.modal-is-opening` / `.modal-is-closing` keyframes would
  double-animate with these transitions. Add
  `:root:is(.modal-is-opening, .modal-is-closing) :is(dialog, dialog > article, dialog::backdrop) { transition: none; }`.

### 3.3 `[popover]`: entry and exit

```css
[popover] {
  opacity: 0;
  transition:
    opacity var(--pico-transition),
    overlay var(--pico-transition) allow-discrete,
    display var(--pico-transition) allow-discrete;
}
[popover]:popover-open { opacity: 1; }
@starting-style { [popover]:popover-open { opacity: 0; } }   /* covers Blades' ul/menu too (rule 3.1.3) */

@media (prefers-reduced-motion: no-preference) {
  [popover]           { translate: 0 calc(var(--peak-popover-offset, 0.25rem) * -1); }
  [popover]:popover-open { translate: none; }
  @starting-style { [popover]:popover-open { translate: 0 calc(var(--peak-popover-offset, 0.25rem) * -1); } }
}
[popover="hint"] { --pico-transition: calc(var(--peak-duration) * 0.6) var(--peak-easing); }
```

- Slide direction: after a `flip-block`, a downward slide looks wrong. Keep the slide subtle, or
  make it opacity-only. Make it direction-aware only where `@container anchored(fallback: flip-block)`
  is supported.

### 3.4 Reduced motion

- **Blades already wins this, and Peak can't override it.** Blades' reduced-motion rule is
  `!important`. For `!important` declarations, **earlier layers beat later layers**, so nothing in
  `@layer peak` can soften it, not even `!important`. All Peak transitions are already 0s under
  `reduce`. Discrete `display` / `overlay` flips still work at 0s. The only escape hatch is Blades'
  `.unreduce-motion` class.
- **Gap Peak must fill:** Blades' selector is `*`, `::before` and `::after`. It does **not** match
  `::backdrop`. Add
  `@media (prefers-reduced-motion: reduce) { dialog::backdrop, [popover]::backdrop { transition: none; } }`.
- Put movement (translate and scale) under `prefers-reduced-motion: no-preference` so the start
  frame is never a transformed state, and set `--peak-duration: 0s` under `reduce` so any JS that
  reads it agrees.

### 3.5 Out of scope / later

`details::details-content` with `interpolate-size: allow-keywords` for animated accordions
(Chromium-only at the time of writing).

---

## 4. Lightning CSS: configuration and caveats

### 4.1 The current targets break modern behavior (verified)

`--targets '>= 0.5%'` pulls in browsers without `light-dark()`, so Lightning CSS rewrites **every**
`light-dark()` into its `--lightningcss-light` / `--lightningcss-dark` space-toggle polyfill.
`dist/peak.css` has 0 native `light-dark(` and 182 toggle variables.

Consequences, all reproduced in Chromium:

| Symptom | Current build | Modern-targets build |
|---|---|---|
| `color: var(--peak-text)` inside `<section data-theme="dark">` on a light page | `oklch(0.24 …)`: **dark text on dark** | `oklch(0.91 …)` ✓ |
| `color: var(--peak-text)` inside a user's `.x { color-scheme: dark }` (e.g. a Stacks section) | `oklch(0.24 …)` ✗ | `oklch(0.91 …)` ✓ |
| `:dir(rtl)` in Blades' popover rule | rewritten to a 19-language `:lang()` list, which breaks `dir="rtl"` pages without one of those `lang`s | kept as `:dir(rtl)` ✓ |
| Output size | 153 KB | ~99 KB |

The cause is that the polyfill resolves the light/dark choice where a custom property is
**declared** (`:root`), not where it's used. It also only toggles on `color-scheme` declarations
that Lightning CSS itself compiled, so it never sees CSS written by Stacks or by users.

### 4.2 Recommended configuration

```jsonc
// package.json
"browserslist": ["chrome >= 123", "edge >= 123", "firefox >= 128", "safari >= 18", "ios_saf >= 18"],
"scripts": {
  "build:css": "lightningcss --bundle --browserslist src/peak.css -o dist/peak.css",
  "build:min": "lightningcss --bundle --minify --browserslist src/peak.css -o dist/peak.min.css",
  "build": "npm run build:css && npm run build:min",
  "prepublishOnly": "npm run build"
}
```
- `--browserslist` reads the `browserslist` field **(verified: with that field, the output keeps
  `light-dark()` and `:dir()`)**.
- The floor is set by `light-dark()` (Chrome 123, Firefox 120, Safari 17.5) and by relative color
  channel math (Firefox 128, Safari 18). Anchor positioning, `@starting-style` and `overlay` are
  progressive enhancements behind `@supports`, so they don't raise the floor.
- Drop `--nesting`. It's a hidden no-op in this CLI version (it isn't in `--help`).
- The **CLI has no `--watch`** **(verified: `npm run watch` exits 2, "Found argument '--watch'
  which wasn't expected")**. Use `node --watch-path=src` with a build script, `chokidar-cli`, or
  the JS API.
- If a broad-compat build is ever needed, publish it as a **separate** `peak.compat.css`, and
  document that nested themes and author `color-scheme` don't work in it. The CLI can't exclude
  single features. The JS API (`lightningcss` package: `bundle({ targets, exclude: Features.LightDark })`)
  can; check the exact `Features` flag names against the installed version.

### 4.3 Feature-by-feature behavior (verified with this CLI)

| Syntax | Behavior | Guidance |
|---|---|---|
| `light-dark()` | Polyfilled when any target lacks support | Modern targets only (4.2) |
| `oklch(from var(--x) …)` | Passed through untouched; it can't be resolved at build time | Fine. No fallback is generated, so engines without relative color get an invalid value, so keep those engines out of the targets. |
| `oklch(from #hex …)` (static origin) | **Computed to a static color at build time** | Harmless, but don't expect it to stay dynamic. Always use a `var()` origin for themeable tokens. |
| `oklch()` literals | With broad targets, rewritten to hex plus a `@supports (color: lab())` override (with float noise such as `lab(98.84% .0000298 …)`) | Modern targets keep `oklch` |
| `anchor-name`, `position-anchor`, `position-area`, `position-try-fallbacks`, `anchor-scope`, `anchor()`, `anchor-size()` | Passed through. Declarations may be **reordered** (`inset`, `position` moved). | Don't mix `inset` shorthands with `top: anchor()` longhands in one rule where order matters; split them into separate rules. |
| `@supports not (anchor-name: --a)` | Preserved | — |
| `transition-behavior: allow-discrete` | **Reordered before the `transition` shorthand, so it's lost** | Write `allow-discrete` inside the shorthand (§3.1) |
| `@starting-style`, `overlay`, `:popover-open` | Preserved | — |
| `:dir()` | Rewritten to `:lang()` lists with broad targets | Modern targets, or logical `position-area` keywords |
| `@property`, `pow()` with `var()` | Preserved | — |
| `@layer blades, peak;` statement | **Dropped** from the output. Order still holds because `@layer blades {…}` appears first. | Keep `blades` imported first. Don't add a layered import above it. |

### 4.4 Bundling

- The CLI bundler only resolves relative paths, which is why `../node_modules/@sveti/blades/css/blades.css`
  is used. That path breaks under pnpm or hoisted workspaces. If that ever matters, switch to the
  JS API with a `resolver`.
- `css/blades.css` is the full bundle, including float-label and the standalone kit. If size
  matters, import the modular files Blades exports (each wrapped in `@layer blades`). Upstream
  files stay untouched either way.

---

## 5. Current repository: issues found

| # | Severity | Issue | Evidence | Fix (section) |
|---|---|---|---|---|
| B1 | **High** | Broad targets polyfill `light-dark()`. Nested `[data-theme="dark"]` and author `color-scheme: dark` show dark-on-dark text for Peak tokens. `:dir(rtl)` becomes a `:lang()` list. Output is +55% bigger. | Chromium probe and grep counts (§4.1) | §4.2 |
| B2 | **High** | `npm run watch` is broken: `--watch` isn't a CLI flag. It also had no targets, so dev output would differ from prod. | exit 2 | §4.2 |
| B3 | **High** | Peak bridges `--pico-*` only on `:root`, but Blades redeclares them on every `[data-theme]` element, so nested themed sections revert to Pico blue. Setting `--peak-hue` on a descendant has no effect. | Nested text = `rgb(194,199,208)` (Pico `#c2c7d0`). The button inside the `--peak-hue: 30` section is unchanged. | §1.1 rule 4 |
| B4 | Medium | The bridge is incomplete, so Pico colors leak: link underline, text selection, h1–h6 colors, secondary, contrast, form, dropdown, code, mark, valid/invalid. | Link underline `rgba(1,114,173,.5)`, h1 `rgb(45,49,56)` with a hue-250 theme | §1.4 |
| B5 | Medium | Accessibility regression: `--peak-primary-focus` is 25% alpha. Blades made focus rings opaque on purpose for WCAG 1.4.11 (comment in `_variables.css`). | `tokens.css:39` | §1.3 |
| B6 | Medium | One `--peak-primary-hover` is used for both text and background hover. In dark mode it makes link text darker, which lowers contrast on the dark background. | `tokens.css:38,49-51` | §1.3 |
| B7 | Low | `:root { color-scheme: light dark }` overrides Blades' `@media only screen` dark gate, so print may use the dark palette. The `[data-theme]` rules duplicate Blades. | `tokens.css:2,58-65` | §1.5 (needs a print check to confirm) |
| B8 | Low | `files: ["dist"]`, but `dist/` is gitignored and there is no `prepublishOnly`, so `npm publish` from a clean checkout ships no CSS. | `package.json`, `.gitignore:83` | §4.2 |
| B9 | Low | `--nesting` is a hidden no-op flag. | Not in `--help` | §4.2 |
| B10 | Low | `allowScripts` pins `lightningcss-cli@1.33.0` while the range is `^1.29.0`, so it will drift silently on update. npm 10 ignores it anyway (install scripts ran). | `package.json:29` | Remove, or match whatever tool consumes it |
| B11 | Low | `@layer blades, peak;` is dropped from the output; it's harmless today but fragile. | grep `dist/peak.css` | §4.3 |
| B12 | Info | `index.html` uses the absolute `/dist/peak.css`, so it only works via `npm run serve`. There are no fixtures for dropdowns, tooltips or dialogs, and the sample `<div popover>` is unstyled. | — | §2.5, §2.6 |
| B13 | Info | `src/popover-anchor.css` and `src/starting-style.css` are empty. `README.md` is a single heading. | — | This plan |
| B17 | High | With `closedby` on a dialog, Blades' modern modal makes the dialog itself a centered, fit-content box (at most 700px wide), so `.peak-drawer` opened as a small centered card and `.peak-wide`/`.peak-full` kept the narrow box. The tests opened dialogs without `closedby`. | Found while building the docs (22 Nov 2026) | **Fixed:** `src/components/dialog.css` gives those dialogs their box back under `:modal[closedby]`; `test/patterns.test.mjs` covers both forms |
| B18 | Medium | An `<img>` with `width`/`height` attributes at the top of a card kept the attribute's height while Peak widened it to the card edges: letterboxed, with empty bands. Pico only sets `height: auto` on images without the attribute. | Found while building the docs (22 Nov 2026) | **Fixed:** `block-size: auto` on the bleeding image; `test/layout.test.mjs` checks the aspect ratio |
| B19 | Medium | The header's `surface` and `bordered` nav styles never drew their bottom rule: the background's spread shadow covered the rule's shadow on every side. The test only checked that a shadow was set. | Found while building the docs (22 Nov 2026) | **Fixed:** both shadows are shifted up by their spread, so the rule shows below the header; `test/stacks.test.mjs` samples the pixels |
| B20 | Medium | A site title with a logo was out of line: the logo made the title an inline-flex box whose baseline is the image's bottom edge, so the subtitle and links sat low. On phones Pico's `img { max-width: 100% }` let the logo shrink to nothing in the flex row, and the title text slid under the subtitle (the Stacks theme writes the same markup). | Found on the published docs (22 Nov 2026) | **Fixed:** `src/site.css` centers the title's item and keeps the logo and title from shrinking; `test/patterns.test.mjs` checks alignment at 1280px and 360px |
| B21 | Medium | A long badge label ran out of a narrow card: `.peak-badge` had `white-space: nowrap` and a 999px radius. | Found in a Stacks 6 preview by the theme's stack probe (23 Nov 2026) | **Fixed:** the label wraps inside its container (`max-inline-size: 100%`, `overflow-wrap: anywhere`), with a radius of half a line plus the padding: a pill on one line, round corners when wrapped. `test/layout.test.mjs` checks a badge in a 12rem card |
| B22 | Medium | Cards in `.peak-grid` and `.peak-switcher` didn't line up: the equal-height and pinned-footer rules covered only `.peak-grid-auto` and `.grid`, so a card kept its bottom margin inside the cell and its footer floated. | Found while building the Stacks theme's Grid stack (23 Nov 2026) | **Fixed:** the card rules cover every Peak grid; in a switcher without `flex: 1`, which would reset the switcher's flex-basis. `test/layout.test.mjs` checks both |
| B23 | Low | A `<div class="peak-cluster">` had no space below it, unlike a `<p class="peak-cluster">`: the next block touched the row of buttons (a Stacks Row stack writes a `div`). | Seen in a Stacks 6 preview (23 Nov 2026) | **Fixed:** `:where(.peak-cluster)` gets the typography spacing below; zero specificity, so grid and cluster children still reset it |
| B24 | Medium | An `<img width height>` (the markup that reserves an image's space while it loads) kept its full width and ran off a phone screen. Blades makes only images without a `height` attribute fluid. | Found while building the example pages (23 Nov 2026) | **Fixed:** `src/typography.css` makes `img[width][height]` fluid with `:where()` (a height alone stays a fixed icon); `test/typography.test.mjs` |
| B25 | Medium | A stacked `.peak-switcher` item was as wide as its widest content (a code line, an image), so the page scrolled sideways on phones. | Example pages (23 Nov 2026) | **Fixed:** `min-inline-size: 0` on switcher items; `test/layout.test.mjs` |
| B26 | Medium | On a `.peak-band.primary` or `.contrast`, headings, `.peak-lead`, eyebrows and links kept the page's colors: dark or primary on the fill. The docs worked around it with an inline style. | Example pages (23 Nov 2026) | **Fixed:** the filled band sets the heading, muted, primary and focus colors to its text color; `test/layout.test.mjs` checks colors and contrast in both schemes |
| B27 | Medium | The full-width backgrounds of `.peak-band` and the header's `surface`/`bordered` styles were spread shadows trimmed by `clip-path`, which also clipped every descendant: a `<details>` dropdown in the header was cut off at its bottom edge. | Example pages (23 Nov 2026) | **Fixed:** a `border-image` with an outset (ink overflow: no scrollbar, no clipping); off in forced colors and print. Lightning CSS compiles `border-image: none` to an empty declaration, so the overrides use `border-image-source`. `test/patterns.test.mjs` samples the header pixels again (the B19 test was gone) and both tests click a dropdown below the edge |
| B28 | Low | Below the mobile menu's breakpoint, the menu toggle sat at the top of the bar, not centered with the title: Blades' nav row doesn't center its items. | Example pages; open point of step 1 (23 Nov 2026) | **Fixed:** `align-self: center` on `.site-menu`; `test/patterns.test.mjs` adds the first mobile menu test |
| B29 | Low | A `<button>` beside a field in `role="group"` wrapped its label onto two lines: Pico lets the 100%-wide field and the button shrink together (its own examples use `<input type="submit">`). | Example pages (23 Nov 2026) | **Fixed:** `src/forms.css` (new, `peak.base`): with a field in the group, buttons don't shrink; `test/patterns.test.mjs` |
| B30 | Medium | `.peak-visually-hidden` (absolute) at the end of a scrolling table, such as an "Actions" column header, sat at its own place far to the right, outside the scroll box, and the whole page scrolled sideways on phones. | Example pages: dashboard (23 Nov 2026) | **Fixed:** pinned to the inline start; `test/typography.test.mjs` |
| B31 | Low | A form's submit button in a dialog footer (`form="…"`) took a full line below the other buttons: Pico makes every `button[type="submit"]` full width. | Example pages: dashboard (23 Nov 2026) | **Fixed:** `src/components/dialog.css`; `test/patterns.test.mjs`. Documented with the pattern on the dialogs page |
| B32 | Medium | Since B21, a squeezed table column broke a one-word badge mid-word ("Pendi/ng"): `overflow-wrap: anywhere` also lowers the minimum width that table layout uses. | Example pages: dashboard (23 Nov 2026) | **Fixed:** `overflow-wrap: break-word`, which breaks only what can't fit; the B21 test still passes, `test/layout.test.mjs` adds the table case |
| B33 | Low | Chromium 158 logs a deprecation warning for `position-visibility: anchors-visible` (renamed `anchor-visible`). It's a warning, not an error, so the docs tests pass. | Console while testing the examples (23 Nov 2026) | **Fixed (1.3.0):** the singular only. Chromium warns wherever the plural appears, even inside an `@supports` block that doesn't apply, so the plural can't be a quiet fallback; engines that only know the plural (reportedly Safari before 27 and Firefox) keep an open menu shown when its trigger scrolls out of view, nothing worse. `test/anchor.test.mjs` checks the hiding and that no deprecation warning is logged |
| B34 | Medium | The footer was meant to be muted, but Pico gives `p` and `ul` their own `color: var(--pico-color)`, so the copyright line and the footer links were in the full text color. The current footer link took the link color: on an `<a>`, `--pico-color` is the primary color. | Example pages: blog (23 Nov 2026) | **Fixed:** `.site-footer` sets `--pico-color` to the muted color; the current link uses `--peak-text`. `test/patterns.test.mjs` |
| B35 | Medium | A `.peak-with-sidebar.sticky` aside stayed sticky after wrapping above the content on a phone, and slid over the text the whole way down. | Example pages: blog post (23 Nov 2026) | **Fixed:** the layout is a query container and the aside is sticky from 45rem, where the default aside stops wrapping (a container query can't read `--peak-sidebar-width`, as with the grid spans). `test/patterns.test.mjs` |
| B36 | Low | A grid of cards had no space below it (the cards drop their margins inside it), so pagination or the next heading touched the last row; the blog post needed `.peak-section` as a workaround. | Example pages: shop (23 Nov 2026) | **Fixed:** zero-specificity block spacing below `.peak-grid-auto`, `.peak-grid` and `.peak-switcher` unless they are the last child; `test/layout.test.mjs` |
| B37 | Medium | Tab labels never wrapped (`max-content` columns, `white-space: nowrap`), so labels too long for one line widened the tab grid and the panel that spans it past the page. The product example scrolled sideways by 28px at 390px on CI, where the font stack falls through to the wider DejaVu Sans (no Carlito for `Calibri`); locally it fit. | CI docs test, Chrome 159 on ubuntu-latest (24 Nov 2026) | **Fixed:** `auto` columns and `text-wrap: balance`, so labels wrap between words only when they must; no mid-word breaks, so tabs whose longest words don't fit side by side still overflow (accordion page notes the limit). `test/patterns.test.mjs` |

---

## 6. Suggested order of work

1. **Build fixes** (B1, B2, B8, B9): the `browserslist` field, a watch script, `prepublishOnly`.
   Re-run the Chromium probe (Appendix A).
2. **Tokens** (B3–B7): inputs with `@property`, semantic tokens, the full bridge, the theme-root
   redeclaration, and containers. Add the **contrast sweep** test at the same time (§7.4), so slider
   ranges are validated before they're published.
3. **Scoping decision for page builders** (§7.2, risk R2): pick global, scoped or both before building
   more components on top of global element styles.
4. **`starting-style.css`**: dialogs, then popovers, then the reduced-motion `::backdrop` gap.
5. **`popover-anchor.css`**: menu enhancements, the opt-in legacy-dropdown anchor, then tooltips
   (spike A first).
6. **Fixtures and a Playwright smoke test** (`npm test`) that asserts computed colors in nested
   themes, `transitionBehavior === "allow-discrete"`, and the popover rect against the anchor rect.
7. **Editor controls**: one control per §1.2 input, using the ranges in that table, generated
   from `tokens.json` (§7.5).
8. Later: the gaps in §7.3, by the priorities given there.

---

## 7. Strategy and gaps

### 7.1 Is Peak worth building?

Yes, if Peak's identity is **a thin, themeable token layer** on top of Blades. If it becomes a
showcase of modern CSS features on top of Blades, it mostly duplicates upstream: Blades 3.1
already ships popover dropdowns, dialog entry transitions, `closedby` backdrops and a
`light-dark()` palette (§0). What makes it worth doing: a sound, maintained base that moves toward
native HTML features; layering that never forks upstream and lets site authors win; and a token
API (a few hue, chroma and lightness inputs producing a full palette with predictable contrast)
that neither Pico nor Blades offers, and that suits slider-driven editors.

### 7.2 Strategic risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Blades is young and moves fast.** Its own `_variables-blades.css` says "NAMING NOT FINALIZED", and it's a small-team fork. | Pin it to `~3.1` instead of `^3.1.3`. Re-check the files listed in §0 at every upgrade (`npm run update:upstream`). Map only to the `--pico-*` contract, which comes from Pico and is stable, never to `--blades-*`. That keeps the option of swapping back to plain Pico open. |
| R2 | **Third-party stacks get restyled.** This is the biggest Stacks-specific risk. Blades styles bare `button`, `input`, `select`, `nav ul`, `article`, `section`, `table` and more globally. Stacks pages contain stacks from other developers, mostly `div` markup with their own buttons and inputs, and Peak's global element styles will restyle them. | Decide before building further. Options: (a) global build plus a documented opt-out wrapper; (b) a **scoped build** like Blades' own `pico.conditional.css` (`@scope (.pico) { … }`), e.g. `@scope (.peak) to (.peak-ignore)`; (c) ship both. Recommended: (c). The scoped build for pages shared with third-party code, the global build otherwise. Check that `@scope` survives Lightning CSS and that `:root` and `[data-theme]` token roots still work inside it. |
| R3 | **A public framework needs stability; themes built on it need fast iteration.** | Semver on the npm package: the `--peak-*` inputs, classes and shipped files are the API, and every rename is a breaking change (§1.3). Themes pin a version range and move up deliberately. |
| R4 | **Size.** The full Blades bundle is about 99 KB with modern targets (153 KB today). | Optionally import only the Blades modules Peak uses (each comes wrapped in `@layer blades`; see §4.4). Add a size budget to CI. |

### 7.3 What is still missing for a modern CSS framework

Priority: **P1** = needed before a public 1.0, **P2** = strong value,
**P3** = nice to have. Browser support notes are from memory; verify them before relying on them.

**Layout**

| Gap | Why | Priority |
|---|---|---|
| Container queries (`container-type: inline-size`, `cqi` units) on landmark and card wrappers | In Stacks the same stack can land in any column width, so components must adapt to their container, not the viewport | P1 |
| Intrinsic layout patterns: auto-fit grid (`repeat(auto-fit, minmax(min(var(--peak-grid-min), 100%), 1fr))`), stack, cluster, sidebar | Pico's `.grid` is minimal | P1 |
| `subgrid` for aligned card headers and footers in grids | Clean card rows without JS | P2 |
| Fluid spacing (`clamp()`), matching the fluid type in §1.3 | Consistent scaling | P2 |

**Accessibility and user preferences**

| Gap | Why | Priority |
|---|---|---|
| `@media (forced-colors: active)`: system colors for borders, focus rings, popovers and the dialog backdrop | Windows High Contrast users; Blades does almost nothing here | P1 |
| Automated contrast sweep across all slider values (§7.4) | Users can choose any hue and chroma. Pinning lightness helps, but yellow and cyan hues will fail somewhere. | P1 |
| 24px minimum touch targets (WCAG 2.2, criterion 2.5.8) for icon buttons, close buttons, checkboxes and small nav links | Compliance | P1 |
| `prefers-contrast: more` (stronger borders, no subtle tints) | Low-vision users | P2 |
| `prefers-reduced-transparency` (removes the dialog backdrop blur and alpha surfaces) | Users who turned off transparency | P2 |
| Logical properties throughout Peak (`margin-inline`, `inset-inline`, logical `position-area`) | Full right-to-left support; Pico is mostly physical | P2 |
| Print stylesheet (force the light scheme, show link URLs, avoid breaks inside cards) | Confirms or fixes B7 | P3 |

**Native HTML and CSS features worth adopting** (all zero-JS)

| Gap | Notes | Priority |
|---|---|---|
| Cross-page view transitions: `@view-transition { navigation: auto; }` | A large win for multi-page Stacks sites. Must respect reduced motion. | P2 |
| Customizable `<select>` (`appearance: base-select`, `::picker(select)`) | Chromium-first; progressive enhancement | P2 |
| `field-sizing: content` for textareas | Auto-growing textareas | P2 |
| `:user-invalid` / `:user-valid` styling | Pico relies on `aria-invalid`; native validation states need no JS | P2 |
| Exclusive accordions (`<details name>`) and animated ones (`::details-content` with `interpolate-size: allow-keywords`) | See also §3.5 | P2 |
| `text-wrap: balance` (headings) and `text-wrap: pretty` (body text) | Cheap typographic win | P2 |
| `scrollbar-gutter: stable` on the root | Avoids layout shift when dialogs lock scrolling | P3 |
| Scroll-driven animations (`animation-timeline: view()`) as opt-in effects | Must be off under reduced motion | P3 |
| Wide-gamut accents: `@media (color-gamut: p3)` raises chroma caps | OKLCH makes this easy | P3 |

**Architecture**

| Gap | Notes | Priority |
|---|---|---|
| ~~Sub-layers: `@layer peak.tokens, peak.base, peak.components, peak.utilities`~~ Done, with `peak.layout` (§8.5, `test/layers.test.mjs`) | Lets users insert their own layer in between | P1 |
| `@scope` for components, and an optional scoped build | See R2 | P1 |
| A small utility set: visually hidden, layout helpers, spacing | Only what a site builder needs | P2 |
| Found by the example pages (docs/EXAMPLES.md), added: `--peak-media-min` on `.peak-media` (a byline in a card), `.site-footer-nav.stacked` and headings in footer navs (link columns), `.peak-hide-below-*` / `.peak-hide-from-*` at sm/md/lg/xl (a sidebar that is a drawer on phones), group labels in `.peak-sidebar-nav` (a paragraph or heading between the lists), `<meter>` as wide as `<progress>`, `a.peak-chip[aria-current]` (the current tag in a tag list); in 1.3.0 also `article.peak-prose` (an article of running text, not a card), fields in a `.peak-cluster` at their own width (`field-sizing: content`), `.peak-card.featured`, `.peak-rating` | — | Done |
| Found by the example pages, deferred: an icon button for table rows and toolbars (`⋯`, close; Pico has one button size on purpose, so a square icon button rather than a size scale); a horizontal scroll-snap row (carousels, logo strips, card rows on phones, a product image gallery; markers to switch images with `::scroll-marker` are Chromium-only so far) | Decide the names first | P3 |
| Found by the example pages, not planned: charts (a component of its own, and anything beyond bars needs SVG or script: the docs point to inline SVG or a CSS-only chart library instead); a quantity stepper's +/− buttons (need script; number inputs have arrows) | — | Won't do |
| Components Pico lacks but a site theme needs: callout/alert (status tokens from §1.3), badge, toast (a `popover="manual"`), tabs (exclusive `details`) | Keep them classless or attribute-driven where possible | P2 |

**Tooling and quality**

| Gap | Notes | Priority |
|---|---|---|
| Single source of truth: `tokens.json` → generated `tokens.css`, docs and editor controls | Otherwise the CSS and an editor's sliders drift apart | P1 |
| Playwright smoke tests (computed styles, see Appendix A) plus visual-regression screenshots in light, dark, nested-theme and RTL modes | No test suite exists yet | P1 |
| Stylelint with a browser-compatibility check against the `browserslist` field | Catches syntax above the browser floor | P2 |
| Size budget in CI | See R4 | P2 |
| Changelog, semver policy for tokens, CDN builds (jsDelivr from npm), documentation page | Needed for a public framework | P2 |

### 7.4 Contrast sweep test (spec)

- Render a fixture with every semantic pair: text on bg, text on surface, muted on bg, primary as
  link text on bg, on-primary on primary, each status text on its subtle background, and each
  on-status color on its status color.
- Sweep `--peak-hue` from 0 to 360 in steps of 10, `--peak-chroma` over {0.05, 0.16, 0.30}, the
  status hues over their defaults ±30, and both light and dark schemes.
- Read computed colors in Chromium, convert them to sRGB, and assert WCAG 2 ratios: 4.5:1 for
  body text, 3:1 for large text, UI components and focus rings. Optionally also report APCA Lc.
- Failures show which slider ranges to clamp, or which lightness anchors to adjust in §1.3.

### 7.5 Single-source tokens (sketch)

```jsonc
// tokens.json (sketch)
{
  "hue":    { "type": "number", "default": 250, "min": 0, "max": 360, "step": 1, "label": "Brand hue" },
  "chroma": { "type": "number", "default": 0.16, "min": 0, "max": 0.3, "step": 0.005, "label": "Brand saturation" },
  "radius": { "type": "length", "unit": "rem", "default": 0.375, "min": 0, "max": 1.5, "step": 0.0625, "label": "Corner radius" }
}
```

A small Node script generates three things from this file: the `@property` rules and `:root`
defaults in `tokens.css`, the token reference table in the docs, and (in downstream editors)
their controls.

### 7.6 Review of the original prompt

The starting prompt for this plan came from another AI tool. It was a good starting point, but it
was written without looking at Blades. Keep this in mind when reusing it:

| The prompt said | Reality | Where it's handled |
|---|---|---|
| Keep upstream untouched; a `--peak-*` API; worry about Lightning CSS | Right instincts | §1, §4, CLAUDE.md |
| Upgrade dropdowns to native popover + anchor positioning | Blades already has this; Peak can only extend it | §0, §2.2 |
| Add `@starting-style` transitions for dialogs and popovers | Blades already has entry transitions; the real gaps are exit transitions and `::backdrop` | §0, §3 |
| Upgrade `[data-tooltip]` to native popover | Not possible in CSS: the tooltip text is a pseudo-element, and `popover` must be an HTML attribute | §2.4 (anchored pseudo-elements, plus an opt-in `popover="hint"` pattern) |
| Use `@supports not (anchor-name: --a)` fallbacks | Not enough: some browsers support `anchor-name` with older property names, and shared names need `anchor-scope` | §2.1 |
| Make sure Lightning CSS doesn't strip `light-dark()` or `oklch(from …)` | Nothing is stripped. The real problems are the build targets polyfilling `light-dark()` and the reordered `transition-behavior`. | §4.1, §4.3, §3.1 |
| Respect `prefers-reduced-motion` | Blades' `!important` rule already enforces it and Peak can't override it; only `::backdrop` is uncovered | §3.4 |

---

## 8. Implementation notes

What was built, where it departs from §1–§3, and why. Everything here is covered by `npm test`
(Chromium only).

### 8.1 Tokens

- **Lengths are not registered.** An `@property` `initial-value` of `1rem` is invalid (not
  computationally independent), which drops the whole rule. Registering with a `px` initial value
  would also compute `rem` to px where the property is declared: on `:root` that is the browser
  default, so spacing would stop following the fluid root size. Unregistered lengths stay token
  streams and resolve where they are used, like `--pico-spacing`.
- **`--peak-brand` and `--peak-font-family-heading` have no default.** They are read as
  `var(--peak-brand, oklch(0.6 var(--peak-chroma) var(--peak-hue)))`. A default declared on
  `:root` would be substituted there, so `--peak-hue` on a `[data-peak-scope]` would not reach the
  brand color, and a redeclaration on theme roots would override a user's picker value.
- **`light-dark()` is always outermost.** Each scheme is derived from a plain origin, never via
  `oklch(from light-dark(…) …)` or `color-mix()` over a `light-dark()` value, so no engine has to
  support those combinations (the plan's Chromium-only verification is no longer load-bearing).
  The cost: overriding `--peak-primary` doesn't recompute its hover, subtle or underline
  variants. Use the inputs to theme. h3–h6 colors are direct lightness steps (15/30/45/60% from
  heading to muted) instead of `color-mix()`.
- **Neutrals follow the brand hue**, including a picked `--peak-brand`
  (`oklch(from var(--_peak-brand) L var(--peak-neutral-chroma) h)`), so the picker tints surfaces
  like the hue slider does.
- **Contrast sweep (§7.4) results.** With the §1.3 anchors, 67 light-scheme brand pairs and 21
  status pairs failed (worst 3.4:1, cyan and green at chroma 0.3: out of sRGB gamut, and clipping
  makes them lighter). Fixes, now passing for hue 0–360 × chroma {0.05, 0.16, 0.30} and status
  hue ±30 × chroma {0.15, 0.25}:
  - light scheme: L is lowered by `c × (0.08 + 0.3 × max(0, cos(h − 180°)))` (`--_peak-gamut-shift`,
    a token stream using the `c`/`h` channel keywords, so it is only valid inside relative color).
    Default hue 250 / chroma 0.16 lands at L ≈ 0.515 instead of 0.54;
  - dark scheme: chroma is capped at 0.26 (a clipped red can't get lighter), primary L 0.72, text
    hover 0.79, and **button hover goes lighter (0.80)** instead of darker, which keeps the dark
    on-primary text readable on violet hues.
- **Bridge scope.** Variables Blades derives from others on `:root` only (accordion, range,
  switch, card and dropdown shadows, code `kbd`, group focus rings, block spacing, grid gaps) are
  redeclared, so `[data-peak-scope]` sections recompute them. Size and spacing bridges skip
  Blades' `[data-compact]` areas (`:not([data-compact], [data-compact] *)`) so compact mode keeps
  working; Peak's size inputs don't apply there. Root typography (`--pico-font-family`,
  `-line-height`, `-font-weight`, `-font-size`) is bridged on `:root` only, because Blades sets
  those per element (`code`, `kbd`, `small`, `thead th`).
- **Extra bridge rows** beyond §1.4: `--pico-box-shadow` (new `--peak-shadow`), table stripes,
  switch track, range track and thumb, progress track. The test "no --pico-* color keeps Blades'
  default value" guards against leaks; only `--pico-switch-color` (white thumb) is kept on purpose.
- **Spacing scale values:** 3xs 0.25, 2xs 0.5, xs 0.75, s 1, m 1.5, l 2, xl 3, 2xl 4, 3xl 6 ×
  `--peak-spacing` (§1.3 listed seven factors for nine names).
- **B7 confirmed fixed:** with a dark preference, print media now computes `color-scheme: light`.

### 8.2 Transitions (`src/starting-style.css`)

- **`::backdrop` fades by `opacity`, not `background-color`.** A closing `[closedby]` dialog stops
  matching Blades' `dialog:modal[closedby]::backdrop`, so a color transition would snap to the UA
  backdrop first. Peak keeps Blades' overlay color and blur on `dialog[closedby]::backdrop` and
  fades the box. Classic dialogs keep the UA backdrop and fade it too.
- **A closing `[closedby]` dialog would paint Pico's full-screen overlay on itself** (it falls back
  to the classic `dialog` rules). `dialog[closedby]:not([open])` clears that; the box geometry of
  both layouts matches, so nothing else jumps.
- `translate` was missing from the §3.3 `transition` list, so the slide never animated.
- `::backdrop` can't go inside `:is()`; the Pico-JS rule lists it as a separate selector.
- **Known limit with Pico's modal JS:** it calls `close()` after removing `.modal-is-closing`, so
  the exit transition runs once more after its own animation. There's no CSS hook for that
  moment; pages using the script can set `dialog { transition: none }`.

### 8.3 Popovers and anchoring (`src/popover-anchor.css`)

- Spike A confirmed in Chromium 157: a `position: fixed` `::before` anchors to its own element.
  Safari is not verified.
- **Anchored tooltips are only rendered while shown** (`display: none` otherwise). Anchor
  positioning remembers the last fallback that fit, so a hidden bubble that was below the fold at
  load flipped to the top and stayed there after scrolling.
- Tooltip placements use physical `position-area` keywords (`top`, `bottom`, `left`, `right`),
  matching the physical `data-placement` values the author wrote.
- A `[data-peak-anchor]` wrapper also opts its generic child popover into anchoring, not only the
  attribute on the popover itself.
- The explicit scoped anchor takes precedence over the implicit one, so a popover opened from a
  button elsewhere still sits by its sibling trigger.
- **Not done:** the open-state trigger affordance (§2.2 item 6; Pico's button state variables are
  per variant, so it can't be done without copying those selectors), the coarse-pointer bottom
  sheet fallback, and the direction-aware slide / caret via `@container anchored(…)` (supported
  in Chromium 157).

### 8.4 Tooling

- `npm test` builds `dist/peak.css` and runs `node --test "test/*.test.mjs"` against fixtures in
  `test/fixtures/`. Playwright is **not** a dependency: the tests use the copy installed in the
  environment (preinstalled in cloud sessions; locally `npm i -g playwright`, then
  `npx playwright install chromium`, with `NODE_PATH` pointing at global modules).
- `npm run watch` uses `node --watch-path=src` to drive the CLI.
- `lightningcss-cli` is pinned to `1.33.0` to match `allowScripts`; Blades to `~3.1.4` (R1).

### 8.5 Scoping (step 3, R2): both builds

Decision: option (c). `dist/peak.css` stays global for the public framework;
`dist/peak.scoped.css` (`@instacks/peak/scoped`) is for pages shared with third-party code.

- **Mechanism.** Lightning CSS can't wrap imports in `@scope`, so `scripts/build-scoped.mjs`
  bundles `src/peak.scoped.css` and wraps each layer's body in
  `@scope (.peak) to (.peak-ignore)`. `@keyframes`, `@property` and `@font-face` stay outside the
  wrapper (Chromium accepts them inside, other engines are unverified); the script fails on a
  nested one. It also restores the `@layer` order statement (B11; now `blades, peak.tokens, … peak.utilities`, read from `src/peak.css`) and keeps Blades first,
  because the minifier drops the statement again and merges the `peak` blocks.
- **Theme roots are `:scope`.** Blades already writes `:scope`, which is `:root` at the top level
  and the scope root inside `@scope`, so Peak switched from `:root` to `:scope`. Verified in
  Chromium: selectors inside `@scope` can't match ancestors outside the scope root (`.outer .x`
  fails), and `:where(:scope, …)` matches the root.
- **Inputs stay global.** `src/inputs.css` (`@property` and the `:root` defaults, only `--peak-*`
  names) is added unscoped, so `:root { --peak-hue: … }` works in both builds. Its defaults can't
  reference `--pico-*`, which only exist inside the scope; `--peak-font-family` is now read with a
  fallback like `--peak-brand`.
- **Root size.** `rem` refers to `<html>`. On a nested `.peak` the fluid size is turned off
  (`src/scoped.css`: `:scope:not(:root) { --pico-font-size: 100% }`), so text, rem-based headings
  and spacing stay in proportion; `.peak` on `<html>` keeps it.
- **Limits.** Inherited properties (color, font) flow into `.peak-ignore`. Pico's modal-JS classes
  live on `<html>`, so that rule only matches with `.peak` on `<html>` (Blades' own conditional
  build has the same limit). `@scope` needs Chrome 118, Safari 17.4 and **Firefox 146** (December
  2025), above the Firefox 128 floor of the global build; older browsers drop the whole scoped
  stylesheet.
- Covered by `test/scoped.test.mjs` for both the plain and the minified file.

### 8.6 Page builders

Peak keeps what any page builder needs: the scoped build (§8.5) and the `.stacks_in` overrides
for Stacks 6 in `src/stacks.css`. Theme-specific notes (and issues B14–B16) live with that theme.

### 8.7 Issue status (§5)

B1, B2, B3, B4, B5, B6, B7, B8, B9, B10 and B12 are fixed. B11 (`@layer` statement dropped from
the output) is unchanged; with sub-layers the order comes from first appearance, which
`test/layers.test.mjs` checks in all four dist files; the scoped build restores the statement. B13: both files are implemented and the README documents
the inputs and markup. B14, B15 and B16 concerned a theme built on Peak and are tracked there.
B17, B18 and B19 (found while building the documentation site), B20 (found on the published docs) B21 (found by the Stacks theme's stack probe), and B22 and B23 (found while building its stacks) are fixed.

---

## Appendix A: How the findings were verified

Environment: Node 22, `lightningcss-cli@1.33.0`, `@sveti/blades@3.1.4`, and headless Chromium
via the globally installed Playwright.

**Build checks** (run after `npm run build`, or with alternative targets):
```bash
grep -c 'lightningcss-light' dist/peak.css      # light-dark() polyfill count: 182 today, must be 0
grep -c 'light-dark(' dist/peak.css             # native light-dark() count: 0 today
grep -c ':lang(ae)' dist/peak.css               # :dir() rewritten into :lang() lists
npx lightningcss --bundle --targets 'chrome 125, firefox 128, safari 18' src/peak.css -o /tmp/modern.css
```

**Computed-style probe.** This is a CommonJS script kept outside the repo, so it can use the global
Playwright. Load the page with `page.goto('file://…')`; `setContent()` runs on `about:blank`, which
can't load `file://` stylesheets.
```js
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const css = process.argv[2];
  const html = `<link rel="stylesheet" href="file://${css}">
    <section data-theme="dark"><p id="t" style="color: var(--peak-text)">x</p></section>
    <section style="color-scheme: dark"><p id="u" style="color: var(--peak-text)">x</p></section>`;
  fs.writeFileSync('/tmp/probe.html', html);
  const browser = await chromium.launch();
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ colorScheme });
    await page.goto('file:///tmp/probe.html');
    console.log(colorScheme, await page.evaluate(() => ({
      nestedDataTheme: getComputedStyle(t).color,  // expect the dark-mode text (L ≈ 0.91)
      nestedColorScheme: getComputedStyle(u).color
    })));
  }
  await browser.close();
})();
```

The same pattern verified these other findings:
- link underline and h1 colors (B4);
- the `--peak-hue` override on a section having no effect (B3);
- relative color from a `light-dark()` origin resolving per scheme in Chromium;
- `fill="var(--peak-primary)"` working on an SVG `<rect>` in Chromium.

**`transition-behavior` reorder** (§3.1). Source:
`.c { transition: opacity .2s, display .2s; transition-behavior: allow-discrete; }`.
- The source CSS computes `transitionBehavior` as `allow-discrete`.
- After `npx lightningcss in.css -o out.css`, which emits the longhand first, it computes as
  `normal, normal`.

**CLI flags** (B2, B9). `npx lightningcss --help` lists neither `--watch` nor `--nesting`.
`--watch` exits with code 2. `--nesting` is accepted silently and does nothing. `--browserslist`
reads the `browserslist` field from `package.json`; tested in a scratch directory, the output kept
`light-dark()` and `:dir()`.

**Upstream facts** used in §0 and §2–3 were read from `node_modules/@sveti/blades/src/`:
`blades/components/_dropdown-popover.css`, `blades/components/_modal-modern.css`,
`pico/components/{_tooltip,_dropdown,_card}.css`, `pico/_variables.css`,
`pico/_utilities.css` (the reduced-motion rule) and `pico/layout/_container.css`.
