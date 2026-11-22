// Builds dist/peak.scoped.css and dist/peak.scoped.min.css: Peak and Blades applied only inside
// .peak, and not inside .peak-ignore (docs/PLAN.md §7.2, R2). For pages
// shared with third-party code, such as other vendors' stacks in Stacks 6, which must not be restyled.
//
// Lightning CSS can't wrap imports in @scope, so this post-processes its bundle:
//   - each `@layer name { … }` body is wrapped in @scope, except @keyframes, @property and
//     @font-face, which are global and are kept outside the wrapper;
//   - src/inputs.css stays unscoped, so input defaults live on :root as in the global build;
//   - the layer order statement, which Lightning CSS drops from bundles, is put back (taken from
//     src/peak.css), and the order the layers first appear in is checked against it.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "@scope (.peak) to (.peak-ignore)";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "node_modules", ".bin", "lightningcss");
const lightningcss = (...args) => execFileSync(bin, ["--browserslist", ...args], { cwd: root, encoding: "utf8" });

// Splits CSS into top-level statements: `prelude { block }` or `prelude;`, plus comments.
function statements(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated comment");
      if (depth === 0 && css.slice(start, i).trim() === "") {
        out.push(css.slice(i, end + 2));
        start = end + 2;
      }
      i = end + 1;
    } else if (ch === '"' || ch === "'") {
      for (i++; i < css.length && css[i] !== ch; i++) if (css[i] === "\\") i++;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth < 0) throw new Error(`Unbalanced "}" at ${i}`);
      if (depth === 0) {
        out.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      out.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error("Unbalanced braces");
  if (css.slice(start).trim()) out.push(css.slice(start).trim());
  return out.filter(Boolean);
}

const isGlobal = (s) => /^@(-webkit-)?(keyframes|property|font-face)\b/.test(s);

function scopeLayer(statement) {
  const open = statement.indexOf("{");
  const prelude = statement.slice(0, open).trim();
  const body = statement.slice(open + 1, -1);
  const parts = statements(body);
  const global = parts.filter(isGlobal);
  const scoped = parts.filter((s) => !isGlobal(s));
  for (const s of scoped) {
    const code = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    if (/@(keyframes|property|font-face)\b/.test(code)) {
      throw new Error(`Nested global at-rule would end up inside @scope:\n${s.slice(0, 200)}`);
    }
  }
  return `${prelude} {\n${global.join("\n\n")}\n\n${SCOPE} {\n${scoped.join("\n\n")}\n}\n}`;
}

// The layer order is declared once, at the top of src/peak.css; the scoped entry must match it.
const order = (file) => readFileSync(path.join(root, "src", file), "utf8").match(/^@layer\s+([^;{]+);/m)?.[1];
const layerOrder = order("peak.css").split(",").map((s) => s.trim());
if (order("peak.scoped.css")?.replace(/\s+/g, " ") !== layerOrder.join(", ")) {
  throw new Error("src/peak.scoped.css must start with the same @layer statement as src/peak.css");
}

const bundle = statements(lightningcss("--bundle", "src/peak.scoped.css"));
const inputs = lightningcss("src/inputs.css");

const layerName = (s) => s.match(/^@layer\s+([\w.-]+)/)?.[1];
const banner = bundle.filter((s) => s.startsWith("/*"));
// `@layer name { … }` blocks, and `@layer name;` for sub-layers that are still empty
const layers = bundle.filter((s) => layerName(s) && (s.endsWith("}") || /^@layer\s+[\w.-]+;$/.test(s)));
const other = bundle.filter((s) => !s.startsWith("/*") && !layers.includes(s));
if (other.length) throw new Error(`Unexpected top-level CSS outside a layer:\n${other.join("\n").slice(0, 300)}`);
// Minifiers drop the order statement, so the order of first appearance has to be the declared one
const seen = [...new Set(layers.map(layerName))];
if (seen.join() !== layerOrder.join()) throw new Error(`Layers out of order: ${seen} (expected ${layerOrder})`);
if (!seen.includes("peak.tokens")) throw new Error("No peak.tokens layer for src/inputs.css");

// Inputs stay unscoped, in the first peak.tokens block, so their defaults live on :root
let inputsPlaced = false;
const body = layers.map((s) => {
  if (!s.endsWith("}")) return s;
  const scoped = scopeLayer(s);
  if (layerName(s) !== "peak.tokens" || inputsPlaced) return scoped;
  inputsPlaced = true;
  return `@layer peak.tokens {\n${inputs}\n}\n\n${scoped}`;
});
if (!inputsPlaced) throw new Error("peak.tokens has no rules; src/inputs.css was not placed");

const css = [
  "/*! Peak scoped build: applies inside .peak, not inside .peak-ignore */",
  ...banner,
  `@layer ${layerOrder.join(", ")};`,
  ...body,
].join("\n\n");

mkdirSync(path.join(root, "dist"), { recursive: true });
writeFileSync(path.join(root, "dist", "peak.scoped.css"), css + "\n");
lightningcss("--minify", "dist/peak.scoped.css", "-o", "dist/peak.scoped.min.css");
console.log("[peak] built dist/peak.scoped.css and dist/peak.scoped.min.css");
