/*!
 * peak-scheme.js: remembers Peak's light/dark switch across pages (docs: site/pages/theming.html).
 *
 * Load it in <head> as a classic script (no module, no defer), so a saved scheme is set on <html>
 * before the first paint. It wires up every <select class="peak-scheme"> (values "", "light",
 * "dark") and sets data-theme on <html> and on every .peak scope root. Without this script the
 * switch still works for the current page: Peak's CSS reads the select with :has().
 */
(() => {
  const KEY = "peak-scheme";
  const valid = (value) => value === "light" || value === "dark";
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode, settings): the switch still works on this page
  }

  const apply = (value) => {
    for (const root of [document.documentElement, ...document.querySelectorAll(".peak")]) {
      if (valid(value)) root.setAttribute("data-theme", value);
      else root.removeAttribute("data-theme");
    }
  };

  if (valid(saved)) document.documentElement.setAttribute("data-theme", saved);

  const ready = () => {
    const selects = [...document.querySelectorAll("select.peak-scheme")];
    if (saved !== null) {
      apply(saved);
      for (const select of selects) select.value = valid(saved) ? saved : "";
    }
    for (const select of selects) {
      select.addEventListener("change", () => {
        const value = select.value;
        try {
          localStorage.setItem(KEY, valid(value) ? value : "");
        } catch {
          // See above
        }
        apply(value);
        for (const other of selects) other.value = value;
      });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
