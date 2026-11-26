// Documentation helpers: copy buttons, the customizer and the table of contents highlight
// (command/commandfor in older browsers: Peak's peak-commands.js). Nothing here is part of Peak.
(() => {
  const KEY = "peak-docs-theme";
  const root = document.documentElement;

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.fromEntries(Object.entries(saved).filter(([k, v]) => k.startsWith("--peak-") && typeof v === "string"));
    } catch {
      return {};
    }
  };
  const save = (theme) => {
    try {
      if (Object.keys(theme).length) localStorage.setItem(KEY, JSON.stringify(theme));
      else localStorage.removeItem(KEY);
    } catch {
      // Storage blocked: the theme still applies to this page
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Copy buttons
  // ---------------------------------------------------------------------------------------------
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".docs-copy");
    if (!button) return;
    const code = button.parentElement.querySelector("code");
    try {
      await navigator.clipboard.writeText(code.innerText.replace(/\n$/, ""));
      button.textContent = "Copied";
    } catch {
      button.textContent = "Press Ctrl+C";
      getSelection().selectAllChildren(code);
    }
    button.dataset.copied = "";
    setTimeout(() => {
      button.textContent = "Copy";
      delete button.dataset.copied;
    }, 1600);
  });

  // ---------------------------------------------------------------------------------------------
  // A theme made in the customizer applies to every page (it's saved in this browser only)
  // ---------------------------------------------------------------------------------------------
  const theme = load();
  for (const [name, value] of Object.entries(theme)) root.style.setProperty(name, value);

  const headerList = document.querySelector(".docs-header .site-nav > ul:last-child");
  if (Object.keys(theme).length && headerList && document.body.dataset.page !== "customize") {
    const li = document.createElement("li");
    li.innerHTML = '<a class="peak-badge accent docs-custom-theme" href="customize.html">Custom theme</a>';
    headerList.prepend(li);
  }

  // ---------------------------------------------------------------------------------------------
  // Customizer
  // ---------------------------------------------------------------------------------------------
  const form = document.getElementById("customizer");
  if (form) {
    const output = document.getElementById("customizer-css");
    const controls = [...form.querySelectorAll("[data-token]")];
    const toggleFor = (control) => form.querySelector(`[data-enables="${control.id}"]`);
    const defaults = new Map(controls.map((c) => [c, c.type === "checkbox" ? c.checked : c.value]));

    const valueOf = (control) => {
      const toggle = toggleFor(control);
      if (toggle && !toggle.checked) return null;
      const { type, unit } = control.dataset;
      if (control.type === "checkbox") return control.checked ? "1" : null;
      if (control.tagName === "SELECT") return control.value === defaults.get(control) ? null : control.value || null;
      if (!toggle && control.value === defaults.get(control)) return null;
      if (type === "length" || type === "time") return `${control.value}${unit}`;
      return control.value;
    };

    const render = () => {
      const current = {};
      for (const control of controls) {
        const value = valueOf(control);
        const name = control.dataset.token;
        if (value === null) root.style.removeProperty(name);
        else {
          root.style.setProperty(name, value);
          current[name] = value;
        }
        const out = control.parentElement.querySelector("output");
        if (out) out.textContent = control.value + (control.dataset.unit || out.dataset.units || "");
      }
      const lines = Object.entries(current).map(([k, v]) => `  ${k}: ${v};`);
      output.textContent = lines.length ? `:root {\n${lines.join("\n")}\n}` : "/* All inputs are at their defaults */";
      save(current);
    };

    // Restore the saved theme into the controls
    for (const control of controls) {
      const value = theme[control.dataset.token];
      const toggle = toggleFor(control);
      if (value === undefined) continue;
      if (toggle) toggle.checked = true;
      if (control.type === "checkbox") control.checked = value === "1";
      else if (control.type === "range") control.value = parseFloat(value);
      else control.value = value;
    }
    // The output shows the unit for sliders whose CSS value has none (degrees)
    for (const out of form.querySelectorAll("output")) out.dataset.units = out.textContent.replace(/^[\d.-]+/, "");

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("submit", (event) => event.preventDefault());

    const reset = () => {
      for (const control of controls) {
        if (control.type === "checkbox") control.checked = defaults.get(control);
        else control.value = defaults.get(control);
        const toggle = toggleFor(control);
        if (toggle) toggle.checked = false;
      }
    };
    document.getElementById("customizer-reset")?.addEventListener("click", () => {
      reset();
      render();
    });

    // Presets: a few starting points
    for (const button of document.querySelectorAll("[data-preset]")) {
      button.addEventListener("click", () => {
        const preset = JSON.parse(button.dataset.preset);
        reset();
        for (const control of controls) {
          const value = preset[control.dataset.token];
          const toggle = toggleFor(control);
          if (value === undefined) continue;
          if (toggle) toggle.checked = true;
          if (control.type === "checkbox") control.checked = value === "1";
          else if (control.type === "range") control.value = parseFloat(value);
          else control.value = value;
        }
        render();
      });
    }

    render();
  }

  // ---------------------------------------------------------------------------------------------
  // Table of contents: mark the section being read
  // ---------------------------------------------------------------------------------------------
  const tocLinks = [...document.querySelectorAll(".docs-toc a")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const headings = tocLinks.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
    const mark = () => {
      const offset = 120;
      let current = headings[0];
      for (const h of headings) if (h.getBoundingClientRect().top - offset <= 0) current = h;
      for (const a of tocLinks) {
        if (a.hash === `#${current.id}`) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      }
    };
    addEventListener("scroll", mark, { passive: true });
    mark();
  }
})();
