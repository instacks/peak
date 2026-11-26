/*!
 * peak-commands.js: command/commandfor and closedby="any" for browsers that don't have them yet
 * (docs: site/pages/dialogs.html).
 *
 * Peak's dialogs and drawers open and close with attributes only (Invoker Commands,
 * <button command="show-modal" commandfor="id">), which reached the major browsers during 2025,
 * after Peak's browser baseline. Load this anywhere on the page (defer is fine) to make those
 * buttons work in older browsers too. Where the browser has both features it does nothing.
 */
(() => {
  if (!("command" in HTMLButtonElement.prototype)) {
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[commandfor]");
      if (!button) return;
      const target = document.getElementById(button.getAttribute("commandfor"));
      const command = button.getAttribute("command");
      if (!target) return;
      if (command === "show-modal") target.showModal();
      else if (command === "close") target.close(button.value || undefined);
      else if (command === "request-close") (target.requestClose ?? target.close).call(target);
      else if (command === "toggle-popover") target.togglePopover();
      else if (command === "show-popover") target.showPopover();
      else if (command === "hide-popover") target.hidePopover();
    });
  }

  // closedby="any": a click on the dialog's own box outside its content (the backdrop) closes it
  if (typeof HTMLDialogElement !== "undefined" && !("closedBy" in HTMLDialogElement.prototype)) {
    document.addEventListener("click", (event) => {
      const dialog = event.target;
      if (dialog instanceof HTMLDialogElement && dialog.open && dialog.getAttribute("closedby") === "any") dialog.close();
    });
  }
})();
