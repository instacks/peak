// Builds the documentation site (site/ → _site/) for GitHub Pages. No dependencies: the pages are
// plain HTML with a small front matter block, styled by Peak itself (dist/peak.min.css, so run
// `npm run build` first).
//
//   node scripts/docs.mjs [--out <dir>]
//
// Custom elements in the page sources, expanded at build time:
//   <peak-example [preview-class="…"] [preview-style="…"] [code="hidden"]>HTML</peak-example>
//       a live preview of the HTML plus its source, highlighted, with a copy button
//   <peak-code lang="html|css|js|bash">text</peak-code>
//       a code block; the text is escaped here, so it's written as is
//   <peak-inputs [group="Color"]></peak-inputs>
//       the --peak-* inputs from tokens.json as a table (all groups, or one)
//   <peak-swatches names="--peak-bg --peak-surface …"></peak-swatches>
//       live color swatches of tokens
//   <peak-customizer></peak-customizer>
//       the controls of the theme customizer, generated from tokens.json (site/assets/docs.js)
//   <peak-examples></peak-examples>
//       the gallery of site/examples/*.html: per example an h2, its description, a live preview in
//       an iframe, links to the full page and its source, the docs pages it uses (front matter
//       `uses`) and its theme (the contents of its <style data-peak-theme>)
// h2 and h3 outside examples get an id (from their text) and a .peak-anchor link; the h2s make
// the page's table of contents.
//
// site/examples/*.html are complete documents (front matter, then doctype, head and body), styled
// by Peak alone: they're copied to _site/examples/ with the front matter stripped and the
// customizer's theme script added to <head>, and never get docs.css or docs.js.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argOut = process.argv.indexOf("--out");
const out = path.resolve(argOut > 0 ? process.argv[argOut + 1] : path.join(root, "_site"));
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");

const pkg = JSON.parse(read("package.json"));
const tokens = JSON.parse(read("tokens.json"));
const repoUrl = "https://github.com/instacks/peak";

// Sidebar groups, in order. A page's `group` must be one of these.
const GROUPS = ["Getting started", "Foundations", "Layout", "Components", "Examples", "Reference"];

// A theme saved by the customizer, applied before the first paint (docs pages and examples)
const THEME_SCRIPT =
  `<script>/* A theme saved by the customizer, before the first paint */try{const t=JSON.parse(localStorage.getItem("peak-docs-theme")||"{}");for(const k in t)if(k.startsWith("--peak-"))document.documentElement.style.setProperty(k,t[k])}catch{}</script>`;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slug = (s) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Strip the indentation the source lines share, and leading/trailing blank lines
function dedent(text) {
  const lines = text.replace(/\t/g, "  ").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
}

function attrs(source) {
  const result = {};
  for (const m of source.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)) result[m[1]] = m[2] ?? "";
  return result;
}

// ---------------------------------------------------------------------------------------------
// Syntax highlighting (build time, a few token classes; docs.css colors them)
// ---------------------------------------------------------------------------------------------

const span = (cls, text) => `<span class="tok-${cls}">${text}</span>`;

function highlightHtml(src) {
  const tag = /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w-]*(?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/g;
  let html = "";
  let last = 0;
  for (const m of src.matchAll(tag)) {
    html += esc(src.slice(last, m.index));
    if (m[0].startsWith("<!--")) {
      html += span("c", esc(m[0]));
    } else {
      const [, open, name, rest, close] = m[0].match(/^(<\/?)([\w-]+)([\s\S]*?)(\/?>)$/);
      const attrsHtml = rest.replace(
        /([^\s=]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]+)?|(\s+)/g,
        (all, n, eq, value, space) => {
          if (space) return space;
          return span("a", esc(n)) + (eq ? esc(eq) : "") + (value ? span("s", esc(value)) : "");
        },
      );
      html += esc(open) + span("t", name) + attrsHtml + esc(close);
    }
    last = m.index + m[0].length;
  }
  return html + esc(src.slice(last));
}

function highlightCss(src) {
  return src
    .split(/(\/\*[\s\S]*?\*\/)/)
    .map((part, i) => {
      if (i % 2) return span("c", esc(part));
      return part
        .split("\n")
        .map((line) => {
          const decl = line.match(/^(\s*)(--?[\w-]+|[a-z-]+)(\s*:\s*)(.*?)(;?)(\s*)$/);
          if (decl && !line.trimEnd().endsWith("{") && !line.trimEnd().endsWith(",")) {
            const [, indent, prop, colon, value, semi, tail] = decl;
            return indent + span("p", esc(prop)) + esc(colon) + span("v", esc(value)) + semi + tail;
          }
          const at = line.match(/^(\s*)(@[\w-]+)(.*)$/);
          if (at) return at[1] + span("t", esc(at[2])) + esc(at[3]);
          if (/[{,]\s*$/.test(line)) {
            const m = line.match(/^(\s*)(.*?)(\s*[{,]\s*)$/);
            return m[1] + span("sel", esc(m[2])) + esc(m[3]);
          }
          return esc(line);
        })
        .join("\n");
    })
    .join("");
}

function highlightJs(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|of|new|import|from|export|await|async|true|false|null)\b/g;
  let html = "";
  let last = 0;
  for (const m of src.matchAll(re)) {
    html += esc(src.slice(last, m.index));
    html += m[1] ? span("c", esc(m[1])) : m[2] ? span("s", esc(m[2])) : span("t", m[3]);
    last = m.index + m[0].length;
  }
  return html + esc(src.slice(last));
}

function highlightBash(src) {
  return src
    .split("\n")
    .map((line) => (line.trimStart().startsWith("#") ? span("c", esc(line)) : esc(line).replace(/(\s#.*)$/, (c) => span("c", c))))
    .join("\n");
}

const highlighters = { html: highlightHtml, css: highlightCss, js: highlightJs, bash: highlightBash };

function codeBlock(text, lang = "html") {
  const highlighted = (highlighters[lang] ?? esc)(text);
  return (
    `<div class="docs-code" data-lang="${lang}">` +
    `<button type="button" class="docs-copy secondary outline" aria-label="Copy code">Copy</button>` +
    `<pre><code class="language-${lang}">${highlighted}</code></pre></div>`
  );
}

// ---------------------------------------------------------------------------------------------
// Generated content: token tables, swatches and the customizer
// ---------------------------------------------------------------------------------------------

function formatValue(def, value) {
  if (value === null || value === undefined) return null;
  if (def.type === "length") return `${value}${def.unit}`;
  if (def.type === "time") return `${value}${def.unit}`;
  return String(value);
}

function range(def) {
  if (def.type === "color") return "any color";
  if (def.type === "flag") return "0 or 1";
  if (def.options || def.optionsFrom) {
    const options = def.options ?? tokens.groups.flatMap((g) => Object.entries(g.tokens)).find(([k]) => k === def.optionsFrom)[1].options;
    return options.map((o, i) => (i === 0 && def.firstOptionTitle ? def.firstOptionTitle : o.title)).join(", ");
  }
  const unit = def.type === "length" || def.type === "time" ? def.unit : "";
  return `${def.min}–${def.max}${unit}`;
}

// Inline code spans from the backticks in tokens.json docs
const inline = (text) => esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");

function inputsTable(groupTitle) {
  const groups = tokens.groups.filter((g) => !groupTitle || g.title === groupTitle);
  if (!groups.length) throw new Error(`<peak-inputs group="${groupTitle}">: no such group in tokens.json`);
  return groups
    .map((g) => {
      const rows = Object.entries(g.tokens)
        .map(([name, def]) => {
          const value = formatValue(def, def.default);
          return (
            `<tr><td><code>--peak-${name}</code></td>` +
            `<td>${value === null ? "<small>unset</small>" : `<code>${esc(value)}</code>`}</td>` +
            `<td><small>${esc(range(def))}</small></td>` +
            `<td><strong>${esc(def.label)}.</strong> ${inline(def.doc ?? "")}</td></tr>`
          );
        })
        .join("\n");
      const heading = groupTitle ? "" : `<h3 id="inputs-${slug(g.title)}">${esc(g.title)}</h3>\n`;
      return (
        heading +
        `<div class="overflow-auto docs-table"><table class="striped"><thead><tr>` +
        `<th scope="col">Input</th><th scope="col">Default</th><th scope="col">Range</th><th scope="col">Description</th>` +
        `</tr></thead><tbody>\n${rows}\n</tbody></table></div>`
      );
    })
    .join("\n");
}

function swatches(names) {
  return (
    `<ul class="docs-swatches">` +
    names
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => `<li><span class="docs-swatch" style="background: var(${n})"></span><code>${esc(n)}</code></li>`)
      .join("") +
    `</ul>`
  );
}

// The customizer's form; docs.js wires it up. Each control carries the token name and how to
// write its value.
function customizer() {
  const controls = tokens.groups
    .map((g, gi) => {
      const fields = Object.entries(g.tokens)
        .map(([name, def]) => {
          const id = `c-${name}`;
          // Unset by default: a checkbox sets it. Selects have an "unset" option of their own.
          const optional = def.default === null && !(def.options || def.optionsFrom);
          const start = def.default ?? def.start;
          const data = `data-token="--peak-${name}" data-type="${def.type}" data-unit="${esc(def.unit ?? "")}"`;
          const help = `<small id="${id}-help">${inline(def.doc ?? "")}</small>`;
          let control;
          if (def.type === "color") {
            control = `<input type="color" id="${id}" value="${esc((start ?? "#000000").toLowerCase())}" ${data} aria-describedby="${id}-help">`;
          } else if (def.type === "flag") {
            return (
              `<div class="docs-field"><label><input type="checkbox" role="switch" id="${id}" ${data} aria-describedby="${id}-help"> ${esc(def.label)}</label>${help}</div>`
            );
          } else if (def.options || def.optionsFrom) {
            const options =
              def.options ?? tokens.groups.flatMap((x) => Object.entries(x.tokens)).find(([k]) => k === def.optionsFrom)[1].options;
            control =
              `<select id="${id}" ${data} aria-describedby="${id}-help">` +
              options
                .map((o, i) => {
                  const title = i === 0 && def.firstOptionTitle ? def.firstOptionTitle : o.title;
                  const selected = (def.default ?? "") === o.value ? " selected" : "";
                  return `<option value="${esc(o.value)}"${selected}>${esc(title)}</option>`;
                })
                .join("") +
              `</select>`;
          } else {
            const unit = def.type === "length" || def.type === "time" ? def.unit : (def.units ?? "");
            control =
              `<div class="docs-range"><input type="range" id="${id}" min="${def.min}" max="${def.max}" step="${def.step}" value="${start}" ${data} aria-describedby="${id}-help">` +
              `<output for="${id}">${start}${esc(unit)}</output></div>`;
          }
          const label = `<label for="${id}">${esc(def.label)}</label>`;
          const toggle = optional
            ? `<label class="docs-toggle"><input type="checkbox" data-enables="${id}"> ${esc(def.toggle ?? "Set")}</label>`
            : "";
          return `<div class="docs-field${optional ? " is-optional" : ""}">${toggle}${label}${control}${help}</div>`;
        })
        .join("\n");
      return `<details name="customizer"${gi === 1 ? " open" : ""}><summary>${esc(g.title)}</summary>\n${fields}\n</details>`;
    })
    .join("\n");
  return `<form class="docs-customizer" id="customizer">${controls}</form>`;
}

// ---------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------

function frontMatter(source, file) {
  const m = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = Object.fromEntries(
    m[1].split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  return { ...meta, order: Number(meta.order ?? 0), body: source.slice(m[0].length) };
}

function parsePage(file) {
  const page = { file, ...frontMatter(read("site", "pages", file), file) };
  if (!GROUPS.includes(page.group)) throw new Error(`${file}: unknown group "${page.group}"`);
  return page;
}

// ---------------------------------------------------------------------------------------------
// Examples: whole pages built with Peak (site/examples/)
// ---------------------------------------------------------------------------------------------

function parseExample(file) {
  const name = `examples/${file}`;
  const example = { file, ...frontMatter(read("site", "examples", file), name) };
  for (const key of ["title", "description"]) if (!example[key]) throw new Error(`${name}: no ${key} in the front matter`);
  if (!/^<!doctype html>/i.test(example.body)) throw new Error(`${name}: not a complete document`);
  if (/docs\.(css|js)/.test(example.body)) throw new Error(`${name}: examples are styled by Peak alone, no docs.css or docs.js`);
  const themes = [...example.body.matchAll(/<style data-peak-theme>([\s\S]*?)<\/style>/g)];
  if (themes.length !== 1) throw new Error(`${name}: needs exactly one <style data-peak-theme>`);
  // Inline styles may only set Peak's knobs (--peak-grid-min…), as a user would
  const custom = [...example.body.matchAll(/\sstyle="([^"]*)"/g)]
    .flatMap((m) => m[1].split(";"))
    .filter((d) => d.trim() && !/^\s*--peak-[\w-]+\s*:/.test(d));
  if ((example.body.match(/<style\b/g) ?? []).length !== 1 || custom.length) {
    throw new Error(`${name}: no CSS besides <style data-peak-theme> and --peak-* knobs (a gap in Peak goes in docs/PLAN.md)`);
  }
  example.theme = dedent(themes[0][1]);
  example.uses = (example.uses ?? "").split(/\s+/).filter(Boolean);
  return example;
}

function renderExample(example) {
  if (!/<\/head>/i.test(example.body)) throw new Error(`examples/${example.file}: no </head>`);
  return example.body.replace(/<\/head>/i, `${THEME_SCRIPT}\n</head>`);
}

// The gallery; `hold` keeps the generated markup out of the heading pass, the h2s go through it
function gallery(examples, pages, hold) {
  return examples
    .map((x) => {
      const href = `examples/${x.file}`;
      const uses = x.uses
        .map((file) => {
          const page = pages.find((p) => p.file === file);
          if (!page) throw new Error(`examples/${x.file}: uses "${file}", which is no docs page`);
          return `<a href="${file}">${esc(page.title)}</a>`;
        })
        .join(", ");
      return (
        `<h2>${esc(x.title)}</h2>\n` +
        hold(
          `<p>${esc(x.description)}</p>\n` +
            `<div class="docs-frame"><iframe src="${href}" loading="lazy" title="${esc(x.title)} (example)"></iframe></div>\n` +
            `<div class="peak-cluster docs-frame-actions"><a href="${href}" role="button">Open full page</a>` +
            `<a href="${repoUrl}/blob/main/site/examples/${x.file}" role="button" class="secondary outline">View source</a></div>\n` +
            (uses ? `<p><small>Built with: ${uses}</small></p>\n` : "") +
            `<p><small>Its theme:</small></p>\n${codeBlock(x.theme, "css")}`,
        )
      );
    })
    .join("\n");
}

function renderBody(page, pages, examples) {
  // Examples and code first, kept out of the heading pass by placeholders
  const held = [];
  const hold = (html) => `\u0000${held.push(html) - 1}\u0000`;

  let body = page.body
    .replace(/<peak-example([^>]*)>([\s\S]*?)<\/peak-example>/g, (all, attrSource, inner) => {
      const a = attrs(attrSource);
      const code = dedent(inner);
      const preview =
        `<div class="docs-preview${a["preview-class"] ? ` ${a["preview-class"]}` : ""}"` +
        `${a["preview-style"] ? ` style="${a["preview-style"]}"` : ""}>\n${code}\n</div>`;
      return hold(`<div class="docs-example">${preview}${a.code === "hidden" ? "" : codeBlock(code, "html")}</div>`);
    })
    .replace(/<peak-code(?:\s+lang="(\w+)")?>([\s\S]*?)<\/peak-code>/g, (all, lang, inner) =>
      hold(codeBlock(dedent(inner), lang ?? "html")),
    )
    .replace(/<peak-inputs(?:\s+group="([^"]*)")?><\/peak-inputs>/g, (all, group) => hold(inputsTable(group)))
    .replace(/<peak-swatches names="([^"]*)"><\/peak-swatches>/g, (all, names) => hold(swatches(names)))
    .replace(/<peak-customizer><\/peak-customizer>/g, () => hold(customizer()))
    .replace(/<peak-examples><\/peak-examples>/g, () => gallery(examples, pages, hold));

  // Headings: ids, anchor links, table of contents
  const toc = [];
  const seen = new Set();
  body = body.replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/g, (all, level, attrSource, text) => {
    let id = attrSource.match(/\bid="([^"]+)"/)?.[1];
    if (!id) {
      id = slug(text);
      attrSource += ` id="${id}"`;
    }
    if (seen.has(id)) throw new Error(`${page.file}: duplicate heading id "${id}"`);
    seen.add(id);
    if (level === "h2") toc.push({ id, text: text.replace(/<[^>]*>/g, "") });
    return `<${level}${attrSource}>${text} <a class="peak-anchor" href="#${id}" aria-label="Link to this section">#</a></${level}>`;
  });

  body = body.replace(/\u0000(\d+)\u0000/g, (all, i) => held[i]);
  if (body.includes("<peak-")) throw new Error(`${page.file}: unexpanded <peak-…> element`);
  return { body, toc };
}

function sidebarNav(pages, current) {
  return GROUPS.map((group) => {
    const items = pages
      .filter((p) => p.group === group)
      .map((p) => {
        const currentAttr = p.file === current.file ? ' aria-current="page"' : "";
        return `<li><a href="${p.file}"${currentAttr}>${esc(p.title)}</a></li>`;
      })
      .join("");
    return `<p class="docs-nav-group">${esc(group)}</p><ul>${items}</ul>`;
  }).join("\n");
}

function layout(page, pages, { body, toc }) {
  const index = pages.indexOf(page);
  const prev = pages[index - 1];
  const next = pages[index + 1];
  const nav = sidebarNav(pages, page);
  const pager = [
    prev ? `<article class="docs-pager-prev"><small>Previous</small><a class="peak-card-link" href="${prev.file}">${esc(prev.title)}</a></article>` : "",
    next ? `<article class="docs-pager-next"><small>Next</small><a class="peak-card-link" href="${next.file}">${esc(next.title)}</a></article>` : "",
  ].join("");
  const tocHtml = toc.length && page.toc !== "false"
    ? `<nav class="docs-toc" aria-labelledby="toc-title"><p id="toc-title">On this page</p><ul>${toc
        .map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`)
        .join("")}</ul></nav>`
    : "";
  const title = page.file === "index.html" ? `Peak · ${page.title}` : `${page.title} · Peak`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description ?? "")}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/peak.min.css">
<link rel="stylesheet" href="assets/docs.css">
<script src="assets/peak-scheme.js"></script>
${THEME_SCRIPT}
<script src="assets/docs.js" defer></script>
</head>
<body id="top" class="docs" data-page="${page.file.replace(/\.html$/, "")}">
<a class="peak-skip-link" href="#content">Skip to content</a>
<header class="site-header docs-header" data-nav-style="bordered">
<nav class="site-nav container-fluid" aria-label="Site">
<ul>
<li><button type="button" class="docs-menu-button secondary outline" command="show-modal" commandfor="docs-drawer" aria-label="Open the page list">☰</button></li>
<li><a class="site-title" href="index.html"><img src="assets/favicon.svg" alt="" width="28" height="28"> Peak</a><small class="docs-version">v${esc(pkg.version)}</small></li>
</ul>
<ul>
<li class="docs-header-link"><a href="getting-started.html" class="secondary">Docs</a></li>
<li class="docs-header-link"><a href="customize.html" class="secondary">Customize</a></li>
<li class="docs-header-link"><a href="examples.html" class="secondary">Examples</a></li>
<li class="docs-header-link"><a href="${repoUrl}" class="secondary">GitHub</a></li>
<li><select class="peak-scheme" aria-label="Color scheme"><option value="">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></li>
</ul>
</nav>
</header>
<dialog class="peak-drawer start docs-drawer" id="docs-drawer" closedby="any" aria-label="Pages">
<article>
<header><button aria-label="Close" rel="prev" command="close" commandfor="docs-drawer"></button><strong>Peak</strong></header>
<nav class="peak-sidebar-nav docs-nav" aria-label="Pages">${nav}
<p class="docs-nav-group">Links</p><ul><li><a href="${repoUrl}">GitHub</a></li><li><a href="https://www.npmjs.com/package/${pkg.name}">npm</a></li></ul>
</nav>
</article>
</dialog>
<div class="docs-layout container-fluid${page.wide === "true" ? " is-wide" : ""}">
<aside class="docs-sidebar">
<nav class="peak-sidebar-nav docs-nav" aria-label="Pages">${nav}</nav>
</aside>
<main id="content" class="docs-main" tabindex="-1">
<header class="docs-page-header">
<hgroup><p>${esc(page.group)}</p><h1>${esc(page.title)}</h1></hgroup>
${page.description ? `<p class="peak-lead">${esc(page.description)}</p>` : ""}
</header>
${body}
<nav class="docs-pager peak-grid-auto" aria-label="Previous and next page">${pager}</nav>
<footer class="docs-footer">
<p>Peak ${esc(pkg.version)} · MIT licensed · built on <a href="https://blades.dev/">Blades CSS</a>, a fork of <a href="https://picocss.com/">Pico CSS</a>.
<a href="${repoUrl}/edit/main/site/pages/${page.file}">Edit this page</a></p>
</footer>
</main>
${tocHtml ? `<aside class="docs-aside">${tocHtml}</aside>` : ""}
</div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------

const css = path.join(root, "dist", "peak.min.css");
if (!existsSync(css)) {
  console.error("dist/peak.min.css is missing: run `npm run build` first.");
  process.exit(1);
}

const pages = readdirSync(path.join(root, "site", "pages"))
  .filter((f) => f.endsWith(".html"))
  .map(parsePage)
  .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.order - b.order);

const examples = readdirSync(path.join(root, "site", "examples"))
  .filter((f) => f.endsWith(".html"))
  .map(parseExample)
  .sort((a, b) => a.order - b.order);

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "assets"), { recursive: true });
mkdirSync(path.join(out, "examples"), { recursive: true });

for (const page of pages) writeFileSync(path.join(out, page.file), layout(page, pages, renderBody(page, pages, examples)));
for (const example of examples) writeFileSync(path.join(out, "examples", example.file), renderExample(example));

copyFileSync(css, path.join(out, "assets", "peak.min.css"));
copyFileSync(path.join(root, "src", "js", "peak-scheme.js"), path.join(out, "assets", "peak-scheme.js"));
for (const f of readdirSync(path.join(root, "site", "assets"))) {
  copyFileSync(path.join(root, "site", "assets", f), path.join(out, "assets", f));
}
// GitHub Pages: serve files as they are (no Jekyll, which would skip paths starting with _)
writeFileSync(path.join(out, ".nojekyll"), "");

console.log(`docs: ${pages.length} pages, ${examples.length} examples → ${path.relative(root, out) || out}`);
