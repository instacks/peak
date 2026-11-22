// Generates everything in this package that describes Peak's inputs from tokens.json
// (docs/PLAN.md §7.5):
//   src/inputs.css                                   @property rules and :root defaults
//   README.md, between the tokens:start/end markers  the inputs table
// tokens.json ships in the npm package (@instacks/peak/tokens.json), so editors built on Peak
// (the documentation's customizer, themes for page builders) generate their controls from it as well.
//
// `node scripts/tokens.mjs --check` writes nothing and fails if any output is stale (npm test).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const spec = JSON.parse(read("tokens.json"));

const tokens = spec.groups.flatMap((group) =>
  Object.entries(group.tokens).map(([name, t]) => ({ ...t, name, group: group.title, css: `--peak-${name}` })),
);
const byName = Object.fromEntries(tokens.map((t) => [t.name, t]));
for (const t of tokens) {
  if (t.optionsFrom) t.options = [{ ...byName[t.optionsFrom].options[0], title: t.firstOptionTitle }, ...byName[t.optionsFrom].options.slice(1)];
}

function wrap(text, width) {
  const lines = [""];
  for (const word of text.split(" ")) {
    if (lines.at(-1) && lines.at(-1).length + word.length + 1 > width) lines.push(word);
    else lines[lines.length - 1] = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
  }
  return lines;
}

const cssValue = (t, v) => (t.unit ? `${v}${t.unit}` : String(v));
// Inputs without a default (an optional hue) stay unregistered, so that unset they are invalid and
// the var() fallback in tokens.css applies.
const registered = (t) => ["number", "time", "flag"].includes(t.type) && t.default != null;
const syntax = { number: "<number>", time: "<time>", flag: "<number>" };

// ---------------------------------------------------------------------------------------------
// src/inputs.css

function inputsCss() {
  const props = tokens
    .filter(registered)
    .map((t) => `@property ${t.css} {\n  syntax: "${syntax[t.type]}";\n  inherits: true;\n  initial-value: ${cssValue(t, t.default)};\n}`);
  const defaults = tokens.filter((t) => !registered(t) && t.default != null).map((t) => `  ${t.css}: ${cssValue(t, t.default)};`);
  const fallbacks = tokens
    .filter((t) => !registered(t) && t.default == null)
    .map((t) => wrap(t.doc, 68).map((line, i) => ` *   ${(i ? "" : t.css).padEnd(27)} ${line}`).join("\n"));
  return `/*
 * Peak inputs: the --peak-* scalars a slider or picker sets (docs/PLAN.md §1.2).
 * Generated from tokens.json by scripts/tokens.mjs. Edit tokens.json, then run \`npm run tokens\`.
 *
 * Kept out of tokens.css so the scoped build can leave this file unscoped: defaults live on the
 * document root in both builds, so \`:root { --peak-hue: 30 }\` works the same way everywhere and
 * only --peak-* names are set outside the scope.
 *
 * Unitless numbers and times with a default are registered, so an invalid slider value falls back
 * to the initial value instead of invalidating every color derived from it.
 *
 * Lengths are NOT registered: an @property initial-value must be computationally independent, so
 * \`1rem\` is rejected, and a registered length computes to px where it's declared. On :root that
 * freezes \`rem\` at the browser default and stops spacing from following the fluid root font size.
 * Unregistered lengths stay token streams and resolve where they're used, like --pico-spacing does.
 */

${props.join("\n\n")}

/*
 * Unregistered inputs. These have no default here and are read with a var() fallback, so leaving
 * them unset keeps a derived default (and, in the scoped build, a default that can refer to
 * Blades variables that only exist inside the scope):
${fallbacks.join("\n")}
 */
:where(:root, :host) {
${defaults.join("\n")}
}

/* Blades' !important rule already zeroes transitions; this keeps JS that reads the token in step */
@media (prefers-reduced-motion: reduce) {
  :where(:root, :host) {
    --peak-duration: 0s;
  }
}
`;
}

// ---------------------------------------------------------------------------------------------
// README table

function readme() {
  const current = read("README.md");
  const start = "<!-- tokens:start (generated from tokens.json) -->";
  const end = "<!-- tokens:end -->";
  const range = (t) => {
    if (t.options) return t.options.map((o) => o.title).join(", ");
    if (t.type === "flag") return "0 or 1";
    if (t.min == null) return "any color";
    return `${t.min}–${t.max}${t.unit ?? ""}`;
  };
  const def = (t) => (t.default == null ? "unset" : `\`${cssValue(t, t.default)}\``);
  const rows = tokens.map((t) => `| \`${t.css}\` | ${def(t)} | ${range(t)} | ${t.label}${t.doc ? `. ${t.doc}` : ""} |`);
  const table = `${start}\n| Input | Default | Range | |\n|---|---|---|---|\n${rows.join("\n")}\n${end}`;
  const i = current.indexOf(start);
  const j = current.indexOf(end);
  if (i < 0 || j < 0) throw new Error("README.md is missing the tokens:start/end markers");
  return current.slice(0, i) + table + current.slice(j + end.length);
}

// ---------------------------------------------------------------------------------------------

const outputs = {
  "src/inputs.css": inputsCss(),
  "README.md": readme(),
};

const check = process.argv.includes("--check");
const stale = [];
for (const [file, content] of Object.entries(outputs)) {
  let current = null;
  try {
    current = read(file);
  } catch {}
  if (current === content) continue;
  if (check) stale.push(file);
  else writeFileSync(path.join(root, file), content);
}
if (stale.length) {
  console.error(`[peak] out of date with tokens.json: ${stale.join(", ")}. Run \`npm run tokens\`.`);
  process.exit(1);
}
if (!check) console.log(`[peak] generated ${Object.keys(outputs).join(", ")}`);
